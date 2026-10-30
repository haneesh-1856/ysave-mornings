import type { DB } from '../data/types';

// Which database the app (or a test) uses. Type-only import: no expo-sqlite here, so tests stay light.
let current: DB | null = null;

export function setDb(db: DB): void {
  current = db;
}

export function getDb(): DB {
  if (!current) throw new Error('Database is not ready: setDb() has not been called yet');
  return current;
}

/** Tests only: forget the database. */
export function clearDb(): void {
  current = null;
}
