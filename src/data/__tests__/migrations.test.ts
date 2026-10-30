/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

describe('migrations', () => {
  it('upgrades an existing database: days.planDraftedAt is added, old rows read null', () => {
    const folders = fs.readdirSync(MIGRATIONS).filter((f) => fs.statSync(path.join(MIGRATIONS, f)).isDirectory()).sort();
    expect(folders.length).toBeGreaterThanOrEqual(2);

    // an "installed" app: only the first migration was ever applied
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.cpSync(path.join(MIGRATIONS, folders[0]), path.join(tmp, folders[0]), { recursive: true });
    const sqlite = new Database(':memory:');
    try {
      migrate(drizzle({ client: sqlite }), { migrationsFolder: tmp });
      sqlite
        .prepare('INSERT INTO days (dayKey, planConfirmedAt, dayStartHour, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
        .run('2026-10-29', 5, 4, 1, 1);

      migrate(drizzle({ client: sqlite }), { migrationsFolder: MIGRATIONS });
      const row = sqlite.prepare('SELECT planConfirmedAt, planDraftedAt FROM days').get();
      expect(row).toEqual({ planConfirmedAt: 5, planDraftedAt: null });
    } finally {
      sqlite.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
