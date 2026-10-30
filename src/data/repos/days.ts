import { and, asc, eq, gt, gte, inArray, isNull, lt, lte } from 'drizzle-orm';
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

type PlanWrite = {
  dayKey: DayKey;
  dayStartHour: number;
  result: ReturnType<typeof confirmPlan>;
  now: Epoch;
  newId: () => string;
};

/** The shared writes of a confirmPlan() result, inside a transaction. Order matters (unique (dayKey, taskId)): deletes, inserts, updates. */
function applyPlanResult(tx: Executor, input: PlanWrite): void {
  const { dayKey, dayStartHour, result, now, newId } = input;
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new ValidationError('dayStartHour', 'dayStartHour must be an integer 0-23');
  }
  tx.insert(days)
    .values({
      dayKey,
      planConfirmedAt: null,
      planDraftedAt: null,
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
}

/**
 * Applies a confirmPlan() result in ONE transaction (doc 04 §2). Ensures the days row exists
 * (created with `dayStartHour` if missing) and sets planConfirmedAt = now only if it is still null.
 * A draft's planDraftedAt is kept as history (ADR-010).
 */
export function saveConfirmedPlan(db: DB, input: PlanWrite): void {
  db.transaction((tx) => {
    applyPlanResult(tx, input);
    tx.update(days)
      .set({ planConfirmedAt: input.now, updatedAt: input.now })
      .where(and(eq(days.dayKey, input.dayKey), isNull(days.planConfirmedAt)))
      .run();
  });
}

/**
 * Saves a draft plan for a later day (ADR-010) in ONE transaction: the same writes as saveConfirmedPlan, but
 * the day gets planDraftedAt = now and planConfirmedAt stays null. Throws ValidationError if the day already
 * has a confirmed plan, a close, or any session (a draft never touches progress).
 */
export function saveDraftPlan(db: DB, input: PlanWrite): void {
  const { dayKey, now } = input;
  db.transaction((tx) => {
    const day = tx.select().from(days).where(eq(days.dayKey, dayKey)).get();
    if (day && (day.planConfirmedAt !== null || day.closedAt !== null)) {
      throw new ValidationError('dayKey', `${dayKey} already has a final plan`);
    }
    const withSession = tx
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(dayTasks, eq(sessions.dayTaskId, dayTasks.id))
      .where(eq(dayTasks.dayKey, dayKey))
      .get();
    if (withSession) throw new ValidationError('dayKey', `${dayKey} already has progress`);
    applyPlanResult(tx, input);
    tx.update(days).set({ planDraftedAt: now, updatedAt: now }).where(eq(days.dayKey, dayKey)).run();
  });
}

/**
 * Throws a draft away (ADR-010) in ONE transaction: deletes the day's rows and the days row. A day without a
 * draft is left alone; a day that also holds a confirmed plan or a close only has planDraftedAt cleared.
 */
export function discardDraft(db: DB, dayKey: DayKey, now: Epoch): void {
  db.transaction((tx) => {
    const day = tx.select().from(days).where(eq(days.dayKey, dayKey)).get();
    if (!day || day.planDraftedAt === null) return;
    if (day.planConfirmedAt !== null || day.closedAt !== null) {
      tx.update(days).set({ planDraftedAt: null, updatedAt: now }).where(eq(days.dayKey, dayKey)).run();
      return;
    }
    tx.delete(dayTasks).where(eq(dayTasks.dayKey, dayKey)).run();
    tx.delete(days).where(eq(days.dayKey, dayKey)).run();
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

/** Gives every days row after `afterKey` the new snapshot hour (a change never moves today or the past). */
export function setFutureDayStartHour(db: DB, afterKey: DayKey, hour: number, now: Epoch): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ValidationError('dayStartHour', 'dayStartHour must be an integer 0-23');
  }
  db.update(days).set({ dayStartHour: hour, updatedAt: now }).where(gt(days.dayKey, afterKey)).run();
}
