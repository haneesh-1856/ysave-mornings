import { addDays, compareDayKeys, repeatsOn } from './dayKey';
import { MINUTES } from './types';
import type { ColorKey, Day, DayKey, DayTask, DayTaskDraft, Session, Task, TaskKind, Topic } from './types';

/** Doc 04 §2, §3, §11. Pure: no ids, no clock. */

export type PlanReason = 'default' | 'repeats' | 'not_on_day' | 'forwarded' | 'one_off' | 'saved';

export interface PlanRow {
  /** Stable: the dayTask id, the task id, or 'oneoff:<n>'. */
  key: string;
  taskId: string | null;
  topicId: string;
  name: string;
  colorKey: ColorKey;
  kind: TaskKind;
  minutes: number;
  cue: string | null;
  treat: string | null;
  /** This day's note for the row (ADR-011); never the library note. */
  note: string | null;
  ticked: boolean;
  reason: PlanReason;
  forwardedFromDayKey: DayKey | null;
  /** Set when the row already exists in day_tasks. */
  dayTaskId: string | null;
}

export interface PlanDraft {
  dayKey: DayKey;
  groups: { topicId: string; rows: PlanRow[] }[];
  notOn: PlanRow[];
}

export interface PlanInput {
  dayKey: DayKey;
  topics: Topic[];
  tasks: Task[];
  day: Day | null;
  dayTasks: DayTask[];
}

const FALLBACK_MINUTES = 15;

const clampMinutes = (m: number): number => Math.min(MINUTES.max, Math.max(MINUTES.min, m));

interface Entry {
  row: PlanRow;
  notOn: boolean;
  bucket: number; // 0 = library position, 1 = forwarded / one-off / orphan (after library rows)
  order: number;
}

/**
 * Per-day minutes of a day row: budgetSec/60, kept as is (1..MINUTES.max) because time carried from a closed day
 * (ADR-014) can be any whole minute, e.g. 2 or 13; check rows (budgetSec 0) use the task's minutes, else 15.
 */
function dayMinutes(d: DayTask, lib: Task | undefined): number {
  return d.budgetSec > 0 ? Math.min(MINUTES.max, Math.max(1, Math.round(d.budgetSec / 60))) : (lib?.minutes ?? FALLBACK_MINUTES);
}

function libraryRow(t: Task, topic: Topic, reason: PlanReason, ticked: boolean): PlanRow {
  return {
    key: t.id,
    taskId: t.id,
    topicId: topic.id,
    name: t.name,
    colorKey: topic.colorKey,
    kind: t.kind,
    minutes: t.minutes,
    cue: t.cue,
    treat: t.treat,
    note: null,
    ticked,
    reason,
    forwardedFromDayKey: null,
    dayTaskId: null,
  };
}

/**
 * Builds the editable plan for `dayKey` (doc 04 §2).
 * - No confirmed plan (day null or planConfirmedAt null): library tasks are sorted by weekday/default;
 *   dayTasks with forwardedFromDayKey are pre-ticked rows (reason 'forwarded'). Other existing rows (the
 *   §3 prefill) attach to their visible library task's row by taskId: same key, reason and position,
 *   but ticked, with dayTaskId and the day row's minutes/cue/treat, so Confirm updates instead of
 *   inserting a duplicate (dayKey, taskId). One with no visible library task becomes a 'saved' row.
 * - A draft (planDraftedAt set, planConfirmedAt null; ADR-010) is shown like a confirmed plan: its rows are
 *   ticked, library tasks not in it are unticked, and no defaults are re-added.
 * - Confirmed plan: every existing dayTask is a ticked row (reason 'saved', or 'forwarded' if it was
 *   forwarded); library tasks not already in it appear unticked.
 * - In a confirmed or drafted plan, a task whose isDefault changed AFTER the plan time (planUpdatedAt ?? planConfirmedAt ?? planDraftedAt,
 *   compared with task.defaultChangedAt) moves its tick: default turned on and repeating that day -> a library row
 *   ticked ('default'); default turned off -> its existing row unticked (not for forwarded or completed rows).
 *   Choices made at or before the plan win; other edits never move a tick.
 * - A deleted task keeps its row only if a used dayTask refers to it (§11).
 * - A library task that already has a used dayTask is not listed twice.
 * Check-kind saved rows have budgetSec 0, so their minutes come from the library task (else 15).
 */
export function buildPlan(input: PlanInput): PlanDraft {
  const { dayKey, topics, tasks, day, dayTasks } = input;
  const confirmed = day != null && (day.planConfirmedAt != null || day.planDraftedAt != null);
  // When the plan was last saved (confirm, re-confirm or draft); a task whose default changed after it moves
  // its tick (chunk 9). planUpdatedAt is null on rows from before it existed.
  const planAt = day?.planUpdatedAt ?? day?.planConfirmedAt ?? day?.planDraftedAt ?? null;
  const defaultChangedAfterPlan = (t: Task | undefined): boolean =>
    planAt != null && t?.defaultChangedAt != null && t.defaultChangedAt > planAt;

  const liveTopics = topics
    .filter((t) => t.deletedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const topicById = new Map(liveTopics.map((t) => [t.id, t]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const visible = (t: Task | undefined): t is Task =>
    t != null && t.deletedAt == null && t.name.trim() !== '' && topicById.has(t.topicId);

  // Unconfirmed day: non-forwarded rows attach to their visible library task by taskId.
  const attached = new Map<string, DayTask>();
  if (!confirmed) {
    for (const d of dayTasks) {
      if (d.forwardedFromDayKey == null && d.taskId != null && visible(taskById.get(d.taskId))) {
        attached.set(d.taskId, d);
      }
    }
  }
  const attachedIds = new Set([...attached.values()].map((d) => d.id));
  const used = dayTasks.filter((d) => !attachedIds.has(d.id));
  const usedTaskIds = new Set(used.map((d) => d.taskId).filter((id): id is string => id != null));

  const entries: Entry[] = [];

  // Existing / forwarded rows.
  for (const d of used) {
    const lib = d.taskId != null ? taskById.get(d.taskId) : undefined;
    const minutes = dayMinutes(d, lib);
    const forwarded = d.forwardedFromDayKey != null;
    const inLibraryOrder = !forwarded && lib != null;
    entries.push({
      row: {
        key: d.id,
        taskId: d.taskId,
        topicId: d.topicId,
        name: d.name,
        colorKey: d.colorKey,
        kind: d.kind,
        minutes,
        cue: d.cue,
        treat: d.treat,
        note: d.note,
        // default turned off after the plan: shown unticked (Confirm then drops it, unless it has progress)
        ticked: forwarded || d.completedAt != null || lib?.isDefault !== false || !defaultChangedAfterPlan(lib),
        reason: forwarded ? 'forwarded' : 'saved',
        forwardedFromDayKey: d.forwardedFromDayKey,
        dayTaskId: d.id,
      },
      notOn: false,
      bucket: inLibraryOrder ? 0 : 1,
      order: inLibraryOrder ? lib.sortOrder : d.sortOrder,
    });
  }

  // Library tasks not already represented by a used dayTask.
  for (const t of tasks) {
    if (!visible(t)) continue;
    const att = attached.get(t.id);
    if (att == null && usedTaskIds.has(t.id)) continue;
    const topic = topicById.get(t.topicId)!;
    const repeats = repeatsOn(t.repeatMask, dayKey);
    let row: PlanRow;
    if (!repeats) row = libraryRow(t, topic, 'not_on_day', false);
    else if (!confirmed && t.isDefault) row = libraryRow(t, topic, 'default', true);
    else if (confirmed && t.isDefault && defaultChangedAfterPlan(t)) row = libraryRow(t, topic, 'default', true);
    else row = libraryRow(t, topic, t.isDefault ? 'default' : 'repeats', false);
    if (att) {
      row = { ...row, ticked: true, dayTaskId: att.id, minutes: dayMinutes(att, t), cue: att.cue, treat: att.treat, note: att.note };
    }
    entries.push({ row, notOn: !repeats, bucket: 0, order: t.sortOrder });
  }

  entries.sort((a, b) => a.bucket - b.bucket || a.order - b.order);

  const groupMap = new Map<string, PlanRow[]>();
  const notOn: PlanRow[] = [];
  for (const e of entries) {
    if (e.notOn) {
      notOn.push(e.row);
      continue;
    }
    const rows = groupMap.get(e.row.topicId);
    if (rows) rows.push(e.row);
    else groupMap.set(e.row.topicId, [e.row]);
  }
  const topicRank = new Map(liveTopics.map((t, i) => [t.id, i]));
  // Array.prototype.sort is stable, so task order within a topic is kept.
  notOn.sort((a, b) => topicRank.get(a.topicId)! - topicRank.get(b.topicId)!);

  // Groups: library topics in order, then topics only referenced by dayTasks, in first-appearance order.
  const known = liveTopics.filter((t) => groupMap.has(t.id)).map((t) => t.id);
  const orphans = [...groupMap.keys()].filter((id) => !topicById.has(id));
  const groups = [...known, ...orphans].map((topicId) => ({ topicId, rows: groupMap.get(topicId)! }));
  return { dayKey, groups, notOn };
}

function mapRow(d: PlanDraft, key: string, fn: (r: PlanRow) => PlanRow): PlanDraft {
  let found = false;
  const m = (r: PlanRow): PlanRow => {
    if (r.key !== key) return r;
    found = true;
    return fn(r);
  };
  const groups = d.groups.map((g) => ({ ...g, rows: g.rows.map(m) }));
  const notOn = d.notOn.map(m);
  return found ? { ...d, groups, notOn } : d;
}

/**
 * Ticking never moves a row between sections: a ticked "Not on <weekday>" row stays in `notOn`
 * (the UI shows it ticked). Unknown key returns the draft unchanged.
 */
export function setTicked(d: PlanDraft, key: string, ticked: boolean): PlanDraft {
  return mapRow(d, key, (r) => ({ ...r, ticked }));
}

/** An off-grid length (carried time, e.g. 13) snaps to the grid in the step's direction (15 or 10); below the minimum it only grows. */
export function stepMinutes(d: PlanDraft, key: string, delta: 5 | -5): PlanDraft {
  return mapRow(d, key, (r) => {
    if (r.minutes % MINUTES.step === 0) return { ...r, minutes: clampMinutes(r.minutes + delta) };
    const snapped = (delta > 0 ? Math.ceil : Math.floor)(r.minutes / MINUTES.step) * MINUTES.step;
    return { ...r, minutes: snapped < MINUTES.min ? r.minutes : clampMinutes(snapped) };
  });
}

export function setCue(d: PlanDraft, key: string, cue: string | null): PlanDraft {
  return mapRow(d, key, (r) => ({ ...r, cue }));
}

export function setTreat(d: PlanDraft, key: string, treat: string | null): PlanDraft {
  return mapRow(d, key, (r) => ({ ...r, treat }));
}

/** The day note of one row (ADR-011); blank (whitespace only) is null. Never touches the library task. */
export function setNote(d: PlanDraft, key: string, note: string | null): PlanDraft {
  return mapRow(d, key, (r) => ({ ...r, note: note == null || note.trim() === '' ? null : note }));
}

function allRows(d: PlanDraft): PlanRow[] {
  return [...d.groups.flatMap((g) => g.rows), ...d.notOn];
}

/**
 * Adds a ticked one-off ('one_off', taskId null) to its topic's group (created at the end if missing).
 * A blank (trimmed) name returns the draft unchanged. Minutes are clamped to MINUTES. A blank or missing note is null.
 */
export function addOneOff(
  d: PlanDraft,
  row: { topicId: string; name: string; colorKey: ColorKey; kind: TaskKind; minutes: number; note?: string | null },
): PlanDraft {
  const name = row.name.trim();
  if (name === '') return d;
  let max = 0;
  for (const r of allRows(d)) {
    const m = /^oneoff:(\d+)$/.exec(r.key);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const newRow: PlanRow = {
    key: `oneoff:${max + 1}`,
    taskId: null,
    topicId: row.topicId,
    name,
    colorKey: row.colorKey,
    kind: row.kind,
    minutes: clampMinutes(row.minutes),
    cue: null,
    treat: null,
    note: row.note == null || row.note.trim() === '' ? null : row.note,
    ticked: true,
    reason: 'one_off',
    forwardedFromDayKey: null,
    dayTaskId: null,
  };
  const has = d.groups.some((g) => g.topicId === row.topicId);
  const groups = has
    ? d.groups.map((g) => (g.topicId === row.topicId ? { ...g, rows: [...g.rows, newRow] } : g))
    : [...d.groups, { topicId: row.topicId, rows: [newRow] }];
  return { ...d, groups };
}

export function canConfirm(d: PlanDraft): boolean {
  return allRows(d).some((r) => r.ticked);
}

/**
 * Turns the draft into writes. `existing` = that day's current day_tasks.
 * - ticked row with dayTaskId (found in `existing`) -> update (budgetSec = minutes*60, or 0 for check;
 *   cue, treat, note, sortOrder replaced; everything else kept).
 * - ticked row otherwise -> insert draft (snapshot of name/colorKey/kind).
 * - existing row not ticked -> deleteIds, unless it has any session or completedAt: then it is kept
 *   untouched (no delete, no update).
 * sortOrder = the row's position in the overall plan order (groups in order, then notOn), counting
 * unticked rows too, so kept rows never collide with new ones.
 * Guard (unique (dayKey, taskId), doc 03): a would-be insert whose non-null taskId already exists in
 * `existing` becomes an update of that row instead; if that row is already updated, or claimed by
 * another ticked draft row's dayTaskId, the duplicate is dropped. No insert ever collides.
 * The CALLER sets days.planConfirmedAt if empty (this function is pure and has no clock).
 */
export function confirmPlan(
  d: PlanDraft,
  existing: DayTask[],
  sessions: Session[],
): { insert: DayTaskDraft[]; update: DayTask[]; deleteIds: string[] } {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const withSessions = new Set(sessions.map((s) => s.dayTaskId));
  const insert: DayTaskDraft[] = [];
  const update: DayTask[] = [];
  const updated = new Set<string>();
  const rows = allRows(d);
  const existingByTaskId = new Map<string, DayTask>();
  for (const e of existing) if (e.taskId != null) existingByTaskId.set(e.taskId, e);
  const claimed = new Set(rows.filter((r) => r.ticked && r.dayTaskId != null).map((r) => r.dayTaskId));

  rows.forEach((r, sortOrder) => {
    if (!r.ticked) return;
    const budgetSec = r.kind === 'check' ? 0 : r.minutes * 60;
    let ex = r.dayTaskId != null ? existingById.get(r.dayTaskId) : undefined;
    const same = !ex && r.taskId != null ? existingByTaskId.get(r.taskId) : undefined;
    if (same) {
      if (claimed.has(same.id) || updated.has(same.id)) return; // duplicate (dayKey, taskId): drop
      ex = same;
    }
    if (ex) {
      updated.add(ex.id);
      update.push({ ...ex, budgetSec, cue: r.cue, treat: r.treat, note: r.note, sortOrder });
    } else {
      insert.push({
        dayKey: d.dayKey,
        taskId: r.taskId,
        topicId: r.topicId,
        name: r.name,
        colorKey: r.colorKey,
        kind: r.kind,
        budgetSec,
        cue: r.cue,
        treat: r.treat,
        note: r.note,
        forwardedFromDayKey: r.forwardedFromDayKey,
        completedAt: null,
        closeOutcome: null,
        sortOrder,
      });
    }
  });

  const deleteIds = existing
    .filter((e) => !updated.has(e.id) && e.completedAt == null && !withSessions.has(e.id))
    .map((e) => e.id);
  return { insert, update, deleteIds };
}

/**
 * Doc 04 §2 (ADR-009): [today, tomorrow] while today is open, even after its plan was confirmed
 * (re-confirming keeps rows with progress; planConfirmedAt keeps its first value). [tomorrow] once today
 * is closed. Past days are never plannable.
 */
export function plannableDays(todayKey: DayKey, today: Day | null): DayKey[] {
  const tomorrow = addDays(todayKey, 1);
  return today?.closedAt != null ? [tomorrow] : [todayKey, tomorrow];
}

/** ADR-010: days after tomorrow, up to a year ahead, can hold a draft plan. Today and tomorrow use plannableDays. */
export const DRAFT_HORIZON_DAYS = 365;

export function isDraftable(todayKey: DayKey, dayKey: DayKey): boolean {
  return (
    compareDayKeys(dayKey, addDays(todayKey, 1)) > 0 && compareDayKeys(dayKey, addDays(todayKey, DRAFT_HORIZON_DAYS)) <= 0
  );
}

/** Every draftable day, soonest first: [today + 2 .. today + 365]. */
export function draftableDays(todayKey: DayKey): DayKey[] {
  return Array.from({ length: DRAFT_HORIZON_DAYS - 1 }, (_, i) => addDays(todayKey, i + 2));
}

/**
 * Doc 04 §3: the rows Confirm would save with no edits, for a day with no confirmed plan.
 * Only NEW rows: input.dayTasks is passed as `existing`, so rows already there (forwarded rows, an
 * earlier prefill) become updates, and confirmPlan's taskId guard skips any taskId already present.
 * Calling it twice therefore returns [] the second time (idempotent).
 */
export function prefillUnplanned(input: PlanInput): DayTaskDraft[] {
  return confirmPlan(buildPlan(input), input.dayTasks, []).insert;
}
