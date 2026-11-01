import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { DayKey, Epoch, Session } from '../../domain/types';
import { ConflictError, NotFoundError, sqliteMessage } from '../errors';
import { dayTasks, sessions } from '../schema';
import type { DB } from '../types';
import { toSession } from './mappers';

/** The single open session in the whole database (doc 03 invariant), or null. */
export function getOpenSession(db: DB): Session | null {
  const row = db.select().from(sessions).where(isNull(sessions.endedAt)).get();
  return row ? toSession(row) : null;
}

/**
 * Starts a session for a day task (doc 04 §4). `closeSessionId` is StartDecision.closeSessionId: the
 * other running session is closed at `now` first, then the new one is inserted, in one transaction.
 * The partial unique index is the safety net: if another open session still exists, the insert
 * fails and this throws ConflictError (nothing is written).
 */
export function startSession(
  db: DB,
  input: { dayTaskId: string; closeSessionId: string | null; now: Epoch; newId: () => string },
): Session {
  const { dayTaskId, closeSessionId, now, newId } = input;
  const row = {
    id: newId(),
    dayTaskId,
    startedAt: now,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    db.transaction((tx) => {
      if (closeSessionId !== null) {
        tx.update(sessions)
          .set({ endedAt: now, updatedAt: now })
          .where(and(eq(sessions.id, closeSessionId), isNull(sessions.endedAt)))
          .run();
      }
      tx.insert(sessions).values(row).run();
    });
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(sqliteMessage(e))) {
      throw new ConflictError('Another session is already running');
    }
    throw e;
  }
  return toSession(row);
}

/** Closes a running session at `now` (Pause/Stop). Throws NotFoundError if it does not exist. */
export function endSession(db: DB, sessionId: string, now: Epoch): Session {
  db.update(sessions)
    .set({ endedAt: now, updatedAt: now })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)))
    .run();
  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!row) throw new NotFoundError(`Session ${sessionId} not found`);
  return toSession(row);
}

/**
 * Focused ms per day for every day before `beforeDayKey` that has a session, in ONE query (sessions joined to
 * day_tasks, grouped by dayKey). An open session counts up to `at`; a negative length counts as 0 (same as focusedMs).
 */
export function focusTotalsByDay(db: DB, beforeDayKey: DayKey, at: Epoch): Record<DayKey, number> {
  const rows = db
    .select({
      dayKey: dayTasks.dayKey,
      ms: sql<number>`sum(max(0, coalesce(${sessions.endedAt}, ${at}) - ${sessions.startedAt}))`,
    })
    .from(sessions)
    .innerJoin(dayTasks, eq(sessions.dayTaskId, dayTasks.id))
    .where(lt(dayTasks.dayKey, beforeDayKey))
    .groupBy(dayTasks.dayKey)
    .all();
  return Object.fromEntries(rows.map((r) => [r.dayKey, Number(r.ms)]));
}
