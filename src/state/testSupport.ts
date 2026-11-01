import { createTestDb } from '../data/__tests__/testDb';
import { loadDayBundle } from '../data/repos/days';
import type { CloseOutcome } from '../domain/types';
import { now, setClockOverride } from './clock';
import { clearDb, getDb, setDb } from './dbRef';
import { resetStore } from './store';
import { todayKey } from './today';

/** Fresh in-memory db wired into dbRef, clock fixed, store reset. Call from beforeEach. */
export function setupState(at: number) {
  resetStore();
  const { db } = createTestDb();
  setDb(db);
  setClockOverride(() => at);
  return db;
}

export function teardownState() {
  clearDb();
  setClockOverride(null);
  resetStore();
}

/** Outcomes that let go of every row of today (extra keys are ignored by close), with `over` applied on top. */
export function letGoAll(over: Record<string, CloseOutcome> = {}): Record<string, CloseOutcome> {
  const db = getDb();
  const rows = loadDayBundle(db, todayKey(db, now()))?.dayTasks ?? [];
  return { ...Object.fromEntries(rows.map((d) => [d.id, 'let_go' as const])), ...over };
}
