import { and, eq, isNull } from 'drizzle-orm';
import type { Epoch, Session } from '../../domain/types';
import { ConflictError, NotFoundError, sqliteMessage } from '../errors';
import { sessions } from '../schema';
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
