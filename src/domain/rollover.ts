import { addDays, dayEndOf } from './dayKey';
import { prefillUnplanned } from './plan';
import { pendingCompletions } from './timer';
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
}

const emptyOps = (): Ops => ({
  closeSessions: [], completions: [], outcomes: [], closeDays: [], createDays: [], insertDayTasks: [],
});

const bySortOrder = (a: DayTask, b: DayTask): number => a.sortOrder - b.sortOrder;

/** Unticked checklist tasks of a bundle, in sortOrder. */
function untickedChecks(b: DayBundle): DayTask[] {
  return b.dayTasks.filter((t) => t.kind === 'check' && t.completedAt === null).sort(bySortOrder);
}

/** Ids of unticked check tasks that still lack a choice in `outcomes`, in sortOrder. */
export function missingOutcomes(b: DayBundle, outcomes: Record<string, CloseOutcome>): string[] {
  return untickedChecks(b)
    .filter((t) => outcomes[t.id] === undefined)
    .map((t) => t.id);
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
 * Closes a day by hand (doc 04 §6). THROWS if the day is already closed or any unticked check task has
 * no outcome; the Close screen prevents both (it asks for the missing choices and hides the button on a
 * closed day), so a throw means a UI bug.
 *
 * `next` = the next day's state: its `days` row (or null), its existing rows (for the unique
 * (dayKey, taskId) index and sortOrder), and the dayStartHour a new next-day row would snapshot.
 * A moved task whose non-null taskId already has a row in the next day is not inserted again (already
 * planned there); its outcome is still 'moved'. Timed tasks are never forwarded.
 */
export function closeByHand(
  b: DayBundle,
  outcomes: Record<string, CloseOutcome>,
  next: { day: Day | null; dayTasks: DayTask[]; dayStartHour: number },
  now: Epoch,
): Ops {
  if (b.day.closedAt !== null) throw new Error(`Day ${b.day.dayKey} is already closed`);
  const missing = missingOutcomes(b, outcomes);
  if (missing.length > 0) throw new Error(`Missing outcomes for: ${missing.join(', ')}`);

  const { closeSessions, closed } = closeOpenSessions(b, now);
  const ops = emptyOps();
  ops.closeSessions = closeSessions;
  ops.completions = pendingCompletions(b.dayTasks, closed, now);
  ops.closeDays = [{ dayKey: b.day.dayKey, closedAt: now, closedBy: 'user' }];

  const nextKey = addDays(b.day.dayKey, 1);
  const takenTaskIds = new Set(next.dayTasks.map((d) => d.taskId).filter((id): id is string => id !== null));
  let sortOrder = next.dayTasks.reduce((m, d) => Math.max(m, d.sortOrder), -1) + 1;
  for (const t of untickedChecks(b)) {
    const closeOutcome = outcomes[t.id];
    ops.outcomes.push({ dayTaskId: t.id, closeOutcome });
    if (closeOutcome !== 'moved') continue;
    if (t.taskId !== null && takenTaskIds.has(t.taskId)) continue;
    ops.insertDayTasks.push({
      dayKey: nextKey,
      taskId: t.taskId,
      topicId: t.topicId,
      name: t.name,
      colorKey: t.colorKey,
      kind: t.kind,
      budgetSec: 0,
      cue: t.cue,
      treat: t.treat,
      forwardedFromDayKey: b.day.dayKey,
      completedAt: null,
      closeOutcome: null,
      sortOrder: sortOrder++,
    });
  }
  if (next.day === null) {
    ops.createDays = [
      { dayKey: nextKey, planConfirmedAt: null, planDraftedAt: null, closedAt: null, closedBy: null, dayStartHour: next.dayStartHour },
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
        dayKey: todayKey, planConfirmedAt: null, planDraftedAt: null, closedAt: null, closedBy: null, dayStartHour,
      });
    }
    ops.insertDayTasks = prefillUnplanned({
      dayKey: todayKey, topics: input.topics, tasks: input.tasks, day: today.day, dayTasks: today.dayTasks,
    });
  }
  return { ...ops, todayKey, autoClosed };
}
