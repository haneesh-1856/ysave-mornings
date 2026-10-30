import { eq } from 'drizzle-orm';
import type { Ops } from '../../domain/rollover';
import type { Epoch } from '../../domain/types';
import { days, dayTasks, sessions } from '../schema';
import type { DB } from '../types';

/**
 * The single bridge from domain decisions (rollover / closeByHand Ops) to storage: ONE transaction,
 * order createDays -> closeSessions -> completions -> outcomes -> closeDays -> insertDayTasks.
 * Any failure rolls everything back. `now` stamps createdAt/updatedAt; new day_tasks get newId().
 */
export function applyOps(db: DB, ops: Ops, newId: () => string, now: Epoch): void {
  db.transaction((tx) => {
    for (const d of ops.createDays) {
      tx.insert(days).values({ ...d, createdAt: now, updatedAt: now }).run();
    }
    for (const s of ops.closeSessions) {
      tx.update(sessions).set({ endedAt: s.endedAt, updatedAt: now }).where(eq(sessions.id, s.id)).run();
    }
    for (const c of ops.completions) {
      tx.update(dayTasks).set({ completedAt: c.completedAt, updatedAt: now }).where(eq(dayTasks.id, c.dayTaskId)).run();
    }
    for (const o of ops.outcomes) {
      tx.update(dayTasks).set({ closeOutcome: o.closeOutcome, updatedAt: now }).where(eq(dayTasks.id, o.dayTaskId)).run();
    }
    for (const c of ops.closeDays) {
      tx.update(days).set({ closedAt: c.closedAt, closedBy: c.closedBy, updatedAt: now }).where(eq(days.dayKey, c.dayKey)).run();
    }
    for (const draft of ops.insertDayTasks) {
      tx.insert(dayTasks).values({ ...draft, id: newId(), createdAt: now, updatedAt: now }).run();
    }
  });
}
