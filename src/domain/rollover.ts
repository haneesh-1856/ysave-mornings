import { addDays, dayEndOf } from './dayKey';
import { prefillUnplanned } from './plan';
import { minutesLeftLabel, pendingCompletions, remainingMs } from './timer';
import { MINUTES } from './types';
import type {
  ClosedBy, CloseOutcome, Day, DayBundle, DayKey, DayTask, DayTaskDraft, Epoch, Session, Task, Topic,
} from './types';

/** Doc 04 §3, §6. Pure: no ids, no clock. The state layer applies Ops in one transaction (chunk 7). */

export interface Ops {
  closeSessions: { id: string; endedAt: Epoch }[];
  completions: { dayTaskId: string; completedAt: Epoch }[];
  outcomes: { dayTaskId: string; closeOutcome: CloseOutcome }[];
  closeDays: { dayKey: DayKey; closedAt: Epoch; closedBy: ClosedBy }[];
  createDays: Day[];
  insertDayTasks: DayTaskDraft[];
  /** Existing next-day rows that a moved task landed on: they become "from <day>" rows (no duplicate). */
  /** `note` is set only when the moved row's note should fill an empty note on the existing next-day row. */
  /** `addBudgetSec` (timed rows only) is added to the existing row's budgetSec in the same write. */
  forwardDayTasks: { dayTaskId: string; forwardedFromDayKey: DayKey; note?: string; addBudgetSec?: number }[];
}

const emptyOps = (): Ops => ({
  closeSessions: [], completions: [], outcomes: [], closeDays: [], createDays: [], insertDayTasks: [], forwardDayTasks: [],
});

const bySortOrder = (a: DayTask, b: DayTask): number => a.sortOrder - b.sortOrder;

/** Unticked checklist tasks of a bundle, in sortOrder. */
function untickedChecks(b: DayBundle): DayTask[] {
  return b.dayTasks.filter((t) => t.kind === 'check' && t.completedAt === null).sort(bySortOrder);
}

/**
 * Whole minutes (rounded up, at least 1) of budget a timed task still has at `at`, or 0 when it has none
 * or is already completed. Sessions still open count up to `at`.
 */
export function leftoverMinutes(t: DayTask, sessions: Session[], at: Epoch): number {
  if (t.kind !== 'timed' || t.completedAt !== null) return 0;
  const left = remainingMs(t.budgetSec, sessions, at);
  return left > 0 ? Math.max(1, minutesLeftLabel(left)) : 0;
}

/**
 * Unfinished tasks offered a Move / Let go choice at close, in sortOrder: unticked checks plus timed tasks
 * with minutes left at `at` (never started = whole budget). `leftoverMin` is set for timed ones only.
 */
export function unfinishedTasks(b: DayBundle, at: Epoch): { task: DayTask; leftoverMin?: number }[] {
  const out: { task: DayTask; leftoverMin?: number }[] = [];
  for (const t of [...b.dayTasks].sort(bySortOrder)) {
    if (t.kind === 'check') {
      if (t.completedAt === null) out.push({ task: t });
    } else {
      const leftoverMin = leftoverMinutes(t, b.sessionsByDayTask[t.id] ?? [], at);
      if (leftoverMin > 0) out.push({ task: t, leftoverMin });
    }
  }
  return out;
}

/** Ids of unfinished tasks (unticked checks, timed with time left at `at`) that still lack a choice, in sortOrder. */
export function missingOutcomes(b: DayBundle, outcomes: Record<string, CloseOutcome>, at: Epoch): string[] {
  return unfinishedTasks(b, at)
    .filter((u) => outcomes[u.task.id] === undefined)
    .map((u) => u.task.id);
}

/** Open sessions of a bundle, plus a session map where each open one is closed at `at`. */
function closeOpenSessions(
  b: DayBundle,
  at: Epoch,
): { closeSessions: Ops['closeSessions']; closed: Record<string, Session[]> } {
  const closeSessions: Ops['closeSessions'] = [];
  const closed: Record<string, Session[]> = {};
  for (const [dayTaskId, sessions] of Object.entries(b.sessionsByDayTask)) {
    closed[dayTaskId] = sessions.map((s) => {
      if (s.endedAt !== null) return s;
      closeSessions.push({ id: s.id, endedAt: at });
      return { ...s, endedAt: at };
    });
  }
  return { closeSessions, closed };
}

/**
 * Closes a day by hand (doc 04 §6). THROWS if the day is already closed or any unfinished task (unticked
 * check, or timed task with minutes left at `now`) has no outcome; the Close screen prevents both (it asks
 * for the missing choices and hides the button on a closed day), so a throw means a UI bug.
 *
 * `next` = the next day's state: its `days` row (or null), its existing rows (for the unique
 * (dayKey, taskId) index and sortOrder), and the dayStartHour a new next-day row would snapshot.
 * A moved task whose non-null taskId already has a row in the next day (a draft, a plan, a repeat) is not
 * inserted again: that row is marked forwarded instead (forwardDayTasks), so it still arrives "from <day>".
 * A moved timed task carries its leftover minutes (rounded up, >= 1, capped at MINUTES.max): a new row gets
 * budgetSec = leftover; an existing timed row gets it added (forwardDayTasks.addBudgetSec, total capped at
 * MINUTES.max). Auto-close (rollover) never carries time.
 */
export function closeByHand(
  b: DayBundle,
  outcomes: Record<string, CloseOutcome>,
  next: { day: Day | null; dayTasks: DayTask[]; dayStartHour: number },
  now: Epoch,
): Ops {
  if (b.day.closedAt !== null) throw new Error(`Day ${b.day.dayKey} is already closed`);
  const missing = missingOutcomes(b, outcomes, now);
  if (missing.length > 0) throw new Error(`Missing outcomes for: ${missing.join(', ')}`);

  const { closeSessions, closed } = closeOpenSessions(b, now);
  const ops = emptyOps();
  ops.closeSessions = closeSessions;
  ops.completions = pendingCompletions(b.dayTasks, closed, now);
  ops.closeDays = [{ dayKey: b.day.dayKey, closedAt: now, closedBy: 'user' }];

  const nextKey = addDays(b.day.dayKey, 1);
  const taken = new Map<string, DayTask>();
  for (const d of next.dayTasks) if (d.taskId !== null) taken.set(d.taskId, d);
  let sortOrder = next.dayTasks.reduce((m, d) => Math.max(m, d.sortOrder), -1) + 1;
  const maxSec = MINUTES.max * 60;
  for (const { task: t, leftoverMin } of unfinishedTasks(b, now)) {
    const closeOutcome = outcomes[t.id];
    ops.outcomes.push({ dayTaskId: t.id, closeOutcome });
    if (closeOutcome !== 'moved') continue;
    // Timed: the leftover (whole minutes, rounded up) travels, capped at the plan maximum.
    const leftoverSec = Math.min(maxSec, (leftoverMin ?? 0) * 60);
    const existing = t.taskId !== null ? taken.get(t.taskId) : undefined;
    if (existing) {
      if (existing.forwardedFromDayKey === null) {
        // the day note travels; the next-day row keeps its own if it has one (ADR-011)
        const note = existing.note == null && t.note != null ? { note: t.note } : {};
        const add =
          t.kind === 'timed' && existing.kind === 'timed'
            ? { addBudgetSec: Math.max(0, Math.min(leftoverSec, maxSec - existing.budgetSec)) }
            : {};
        ops.forwardDayTasks.push({ dayTaskId: existing.id, forwardedFromDayKey: b.day.dayKey, ...note, ...add });
      }
      continue;
    }
    ops.insertDayTasks.push({
      dayKey: nextKey,
      taskId: t.taskId,
      topicId: t.topicId,
      name: t.name,
      colorKey: t.colorKey,
      kind: t.kind,
      budgetSec: t.kind === 'timed' ? leftoverSec : 0,
      cue: t.cue,
      treat: t.treat,
      note: t.note,
      forwardedFromDayKey: b.day.dayKey,
      completedAt: null,
      closeOutcome: null,
      sortOrder: sortOrder++,
    });
  }
  if (next.day === null) {
    ops.createDays = [
      { dayKey: nextKey, planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: next.dayStartHour },
    ];
  }
  return ops;
}

/**
 * App start / foreground (doc 04 §6, §3). Auto-closes every open past day (dayKey < today, closedAt null),
 * oldest first, using each day's own dayStartHour snapshot for its end; then makes sure today has a
 * `days` row and, while unplanned, its prefill rows (idempotent: only missing rows are returned).
 * Days with no row at all are not created. Running it on its own output yields empty Ops.
 *
 * NOT covered: today's own running timed tasks. The state layer calls pendingCompletions for today.
 */
export function rollover(input: {
  todayKey: DayKey;
  dayStartHour: number;
  openDays: DayBundle[];
  today: { day: Day | null; dayTasks: DayTask[] };
  topics: Topic[];
  tasks: Task[];
}): Ops & { todayKey: DayKey; autoClosed: DayKey[] } {
  const { todayKey, dayStartHour, today } = input;
  const ops = emptyOps();
  const autoClosed: DayKey[] = [];

  const past = input.openDays
    .filter((b) => b.day.closedAt === null && b.day.dayKey < todayKey)
    .sort((a, b) => a.day.dayKey.localeCompare(b.day.dayKey));
  for (const b of past) {
    const end = dayEndOf(b.day.dayKey, b.day.dayStartHour);
    const { closeSessions, closed } = closeOpenSessions(b, end);
    ops.closeSessions.push(...closeSessions);
    ops.completions.push(...pendingCompletions(b.dayTasks, closed, end));
    for (const t of untickedChecks(b)) ops.outcomes.push({ dayTaskId: t.id, closeOutcome: 'let_go' });
    ops.closeDays.push({ dayKey: b.day.dayKey, closedAt: end, closedBy: 'auto' });
    autoClosed.push(b.day.dayKey);
  }

  // A closed today is final (doc 04 §6): never prefill it, even if it was closed before being planned.
  // A drafted today (ADR-010) already has its starting plan: the draft rows are not topped up with defaults.
  if (
    today.day === null ||
    (today.day.planConfirmedAt === null && today.day.closedAt === null && today.day.planDraftedAt === null)
  ) {
    if (today.day === null) {
      ops.createDays.push({
        dayKey: todayKey, planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour,
      });
    }
    ops.insertDayTasks = prefillUnplanned({
      dayKey: todayKey, topics: input.topics, tasks: input.tasks, day: today.day, dayTasks: today.dayTasks,
    });
  }
  return { ...ops, todayKey, autoClosed };
}
