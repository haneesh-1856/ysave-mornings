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

  it('upgrades a database at the previous version: tasks.defaultChangedAt is added, old rows read null', () => {
    const folders = fs.readdirSync(MIGRATIONS).filter((f) => fs.statSync(path.join(MIGRATIONS, f)).isDirectory()).sort();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    for (const f of folders.filter((x) => x < '20261031072225_chemical_archangel')) fs.cpSync(path.join(MIGRATIONS, f), path.join(tmp, f), { recursive: true });
    const sqlite = new Database(':memory:');
    try {
      migrate(drizzle({ client: sqlite }), { migrationsFolder: tmp });
      sqlite.prepare('INSERT INTO topics (id, name, colorKey, sortOrder, isOpen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run('tp', 'T', 'study', 0, 1, 1, 1);
      sqlite
        .prepare('INSERT INTO tasks (id, topicId, name, kind, minutes, repeatMask, isDefault, note, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('tk', 'tp', 'Read', 'timed', 25, 127, 1, '', 0, 1, 1);
      migrate(drizzle({ client: sqlite }), { migrationsFolder: MIGRATIONS });
      expect(sqlite.prepare('SELECT isDefault, defaultChangedAt FROM tasks').get()).toEqual({ isDefault: 1, defaultChangedAt: null });
    } finally {
      sqlite.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('upgrades a database at the chunk 9 version: days.planUpdatedAt is added, old rows read null', () => {
    const folders = fs.readdirSync(MIGRATIONS).filter((f) => fs.statSync(path.join(MIGRATIONS, f)).isDirectory()).sort();
    expect(folders).toContain('20261031072849_purple_dragon_lord');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    for (const f of folders.filter((x) => x < '20261031072849_purple_dragon_lord')) fs.cpSync(path.join(MIGRATIONS, f), path.join(tmp, f), { recursive: true });
    const sqlite = new Database(':memory:');
    try {
      migrate(drizzle({ client: sqlite }), { migrationsFolder: tmp });
      sqlite
        .prepare('INSERT INTO days (dayKey, planConfirmedAt, planDraftedAt, dayStartHour, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .run('2026-10-29', 5, 3, 4, 1, 1);
      migrate(drizzle({ client: sqlite }), { migrationsFolder: MIGRATIONS });
      expect(sqlite.prepare('SELECT planConfirmedAt, planDraftedAt, planUpdatedAt FROM days').get()).toEqual({
        planConfirmedAt: 5,
        planDraftedAt: 3,
        planUpdatedAt: null,
      });
    } finally {
      sqlite.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('applies all migrations to a fresh database', () => {
    const sqlite = new Database(':memory:');
    try {
      migrate(drizzle({ client: sqlite }), { migrationsFolder: MIGRATIONS });
      const cols = (sqlite.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]).map((c) => c.name);
      expect(cols).toContain('defaultChangedAt');
      const dayCols = (sqlite.prepare('PRAGMA table_info(days)').all() as { name: string }[]).map((c) => c.name);
      expect(dayCols).toContain('planUpdatedAt');
    } finally {
      sqlite.close();
    }
  });
});
