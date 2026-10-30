import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { relations } from '../relations';

const open: Database.Database[] = [];

// Registered once per test file that imports this helper: close every handle after each test.
afterEach(() => {
  for (const s of open.splice(0)) if (s.open) s.close();
});

/** Fresh in-memory database with the real migrations applied and foreign keys ON. Closed automatically after each test. */
export function createTestDb() {
  const sqlite = new Database(':memory:');
  open.push(sqlite);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, relations });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });
  return { db, sqlite };
}
