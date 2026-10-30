import { and, asc, eq, gte, inArray, isNull, lt, lte } from 'drizzle-orm';
import type { confirmPlan } from '../../domain/plan';
import type { Day, DayBundle, DayKey, Epoch, Session } from '../../domain/types';
import { NotFoundError, ValidationError } from '../errors';
import { days, dayTasks, sessions } from '../schema';
import type { DB } from '../types';
import { toDay, toDayTask, toSession, type Executor } from './mappers';

export function getDay(db: DB, dayKey: DayKey): Day | null {
  const row = db.select().from(days).where(eq(days.dayKey, dayKey)).get();
  return row ? toDay(row) : null;
}

/** Days with fromKey <= dayKey <= toKey (inclusive), oldest first. */
export function listDays(db: DB, fromKey: DayKey, toKey: DayKey): Day[] {
  return db
    .select()
    .from(days)
    .where(and(gte(days.dayKey, fromKey), lte(days.dayKey, toKey)))
    .orderBy(asc(days.dayKey))
    .all()
    .map(toDay);
}

/** Builds bundles (day + sorted day tasks + sessions keyed by day task) for the given days. */
function bundlesFor(db: Executor, dayList: Day[]): DayBundle[] {
  if (dayList.length === 0) return [];
  const keys = dayList.map((d) => d.dayKey);
  const taskRows = db
    .select()
    .from(dayTasks)
    .where(inArray(dayTasks.dayKey, keys))
    .orderBy(asc(dayTasks.sortOrder), asc(dayTasks.id))
    .all()
    .map(toDayTask);
  const ids = taskRows.map((t) => t.id);
  const sessionRows: Session[] =
    ids.length === 0
      ? []
      : db
          .select()
          .from(sessions)
          .where(inArray(sessions.dayTaskId, ids))
          .orderBy(asc(sessions.startedAt), asc(sessions.id))
          .all()
          .map(toSession);
  return dayList.map((day) => {
    const own = taskRows.filter((t) => t.dayKey === day.dayKey);
    const sessionsByDayTask: Record<string, Session[]> = {};
    for (const t of own) sessionsByDayTask[t.id] = [];
    for (const s of sessionRows) sessionsByDayTask[s.dayTaskId]?.push(s);
    return { day, dayTasks: own, sessionsByDayTask };
  });
}

/** Day + its tasks (sortOrder) + sessions (startedAt) per day task; null if the day has no row. */
export function loadDayBundle(db: DB, dayKey: DayKey): DayBundle | null {
  const day = getDay(db, dayKey);
  return day ? bundlesFor(db, [day])[0] : null;
}

/** Days with closedAt null and dayKey < beforeDayKey, oldest first, as bundles. */
export function loadOpenPastDays(db: DB, beforeDayKey: DayKey): DayBundle[] {
  const rows = db
    .select()
    .from(days)
    .where(and(isNull(days.closedAt), lt(days.dayKey, beforeDayKey)))
    .orderBy(asc(days.dayKey))
    .all()
    .map(toDay);
  return bundlesFor(db, rows);
}

/**
 * Applies a confirmPlan() result in ONE transaction (doc 04 §2). Order matters because of the unique
 * (dayKey, taskId) index: deletes first, then inserts, then updates. Ensures the days row exists
 * (created with `dayStartHour` if missing) and sets planConfirmedAt = now only if it is still null.
 */
export function saveConfirmedPlan(
  db: DB,
  input: {
    dayKey: DayKey;
    dayStartHour: number;
    result: ReturnType<typeof confirmPlan>;
    now: Epoch;
    newId: () => string;
  },
): void {
  const { dayKey, dayStartHour, result, now, newId } = input;
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new ValidationError('dayStartHour', 'dayStartHour must be an integer 0-23');
  }
  db.transaction((tx) => {
    tx.insert(days)
      .values({
        dayKey,
        planConfirmedAt: null,
        closedAt: null,
        closedBy: null,
        dayStartHour,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    if (result.deleteIds.length > 0) {
      tx.delete(dayTasks)
        .where(and(eq(dayTasks.dayKey, dayKey), inArray(dayTasks.id, result.deleteIds)))
        .run();
    }
    for (const draft of result.insert) {
      tx.insert(dayTasks)
        .values({ ...draft, dayKey, id: newId(), createdAt: now, updatedAt: now })
        .run();
    }
    for (const row of result.update) {
      tx.update(dayTasks)
        .set({
          taskId: row.taskId,
          topicId: row.topicId,
          name: row.name,
          colorKey: row.colorKey,
          kind: row.kind,
          budgetSec: row.budgetSec,
          cue: row.cue,
          treat: row.treat,
          forwardedFromDayKey: row.forwardedFromDayKey,
          sortOrder: row.sortOrder,
          updatedAt: now,
        })
        .where(and(eq(dayTasks.id, row.id), eq(dayTasks.dayKey, dayKey)))
        .run();
    }
    tx.update(days)
      .set({ planConfirmedAt: now, updatedAt: now })
      .where(and(eq(days.dayKey, dayKey), isNull(days.planConfirmedAt)))
      .run();
  });
}

/** Ticks (epoch) or unticks (null) a check task. */
export function setCheckCompleted(db: DB, dayTaskId: string, completedAt: Epoch | null, now: Epoch): void {
  const exists = db.select({ id: dayTasks.id }).from(dayTasks).where(eq(dayTasks.id, dayTaskId)).get();
  if (!exists) throw new NotFoundError(`Day task ${dayTaskId} not found`);
  db.update(dayTasks).set({ completedAt, updatedAt: now }).where(eq(dayTasks.id, dayTaskId)).run();
}

/** Writes completedAt for several day tasks (from pendingCompletions) in one transaction. */
export function setCompletedAt(
  db: DB,
  completions: { dayTaskId: string; completedAt: Epoch }[],
  now: Epoch,
): void {
  if (completions.length === 0) return;
  db.transaction((tx) => {
    for (const c of completions) {
      tx.update(dayTasks).set({ completedAt: c.completedAt, updatedAt: now }).where(eq(dayTasks.id, c.dayTaskId)).run();
    }
  });
}
