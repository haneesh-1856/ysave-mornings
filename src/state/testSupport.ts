import { createTestDb } from '../data/__tests__/testDb';
import { setClockOverride } from './clock';
import { clearDb, setDb } from './dbRef';
import { resetStore } from './store';

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
