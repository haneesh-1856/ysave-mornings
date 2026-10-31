/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NO_TOPIC_ID } from '../../domain/types';
import { ValidationError } from '../errors';
import { createTask, getTask, updateTask } from '../repos/tasks';
import { createTopic, listTopics, listUserTopics, softDeleteTopic, updateTopic } from '../repos/topics';
import { createTestDb } from './testDb';

const MIGRATIONS = path.join(__dirname, '..', 'migrations');
const input = { name: 'A', kind: 'timed', minutes: 30, repeatMask: 0, isDefault: false, cue: null, treat: null } as const;
let n = 0;
const id = () => `i${++n}`;

describe('No topic (ADR-012): the built-in topic row', () => {
  it('(c) exists on a fresh database, last in order, open, neutral', () => {
    const { db } = createTestDb();
    const t = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, id);
    const all = listTopics(db);
    expect(all.map(x => x.id)).toEqual([t.id, NO_TOPIC_ID]);
    expect(all[1]).toMatchObject({ name: 'No topic', colorKey: 'none', isOpen: true, deletedAt: null });
    expect(listUserTopics(db).map(x => x.id)).toEqual([t.id]);
  });

  it('(c) is added once by upgrading a database from the previous migration, keeping its data', () => {
    const folders = fs.readdirSync(MIGRATIONS).filter(f => fs.statSync(path.join(MIGRATIONS, f)).isDirectory()).sort();
    const last = folders.at(-1)!;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    for (const f of folders.slice(0, -1)) fs.cpSync(path.join(MIGRATIONS, f), path.join(tmp, f), { recursive: true });
    const sqlite = new Database(':memory:');
    try {
      migrate(drizzle({ client: sqlite }), { migrationsFolder: tmp });
      sqlite.prepare('INSERT INTO topics (id, name, colorKey, sortOrder, isOpen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run('tp', 'T', 'study', 0, 1, 1, 1);
      expect(sqlite.prepare('SELECT id FROM topics').all()).toHaveLength(1);
      migrate(drizzle({ client: sqlite }), { migrationsFolder: MIGRATIONS });
      expect(sqlite.prepare('SELECT id FROM topics ORDER BY sortOrder').all()).toEqual([{ id: 'tp' }, { id: NO_TOPIC_ID }]);
      // running the statement again does not duplicate the row
      sqlite.exec(fs.readFileSync(path.join(MIGRATIONS, last, 'migration.sql'), 'utf8').replaceAll('--> statement-breakpoint', ''));
      expect(sqlite.prepare('SELECT COUNT(*) AS c FROM topics WHERE id = ?').get(NO_TOPIC_ID)).toEqual({ c: 1 });
    } finally {
      sqlite.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('(d) cannot be renamed, or recoloured, or deleted', () => {
    const { db } = createTestDb();
    expect(() => updateTopic(db, NO_TOPIC_ID, { name: 'Other' }, 2)).toThrow(ValidationError);
    expect(() => updateTopic(db, NO_TOPIC_ID, { colorKey: 'home' }, 2)).toThrow(ValidationError);
    expect(() => softDeleteTopic(db, NO_TOPIC_ID, 2)).toThrow(ValidationError);
    expect(listTopics(db).map(x => x.id)).toContain(NO_TOPIC_ID);
  });

  it('a user cannot create a topic with the neutral colour', () => {
    const { db } = createTestDb();
    expect(() => createTopic(db, { name: 'X', colorKey: 'none' }, 1, id)).toThrow(ValidationError);
  });

  it('(f) a task can be created in it and moved to a live topic (end of its order) and back', () => {
    const { db } = createTestDb();
    const a = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, id);
    createTask(db, { ...input, topicId: a.id, name: 'First' }, 1, id);
    const t = createTask(db, { ...input, topicId: NO_TOPIC_ID }, 1, id);
    const moved = updateTask(db, t.id, { topicId: a.id }, 2);
    expect(moved.topicId).toBe(a.id);
    expect(moved.sortOrder).toBe(1);
    expect(updateTask(db, t.id, { topicId: NO_TOPIC_ID }, 3).topicId).toBe(NO_TOPIC_ID);
    expect(getTask(db, t.id)!.sortOrder).toBe(0);
  });

  it('(f) a task cannot move to a missing or deleted topic', () => {
    const { db } = createTestDb();
    const a = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, id);
    const t = createTask(db, { ...input, topicId: NO_TOPIC_ID }, 1, id);
    softDeleteTopic(db, a.id, 2);
    expect(() => updateTask(db, t.id, { topicId: a.id }, 3)).toThrow(ValidationError);
    expect(() => updateTask(db, t.id, { topicId: 'nope' }, 3)).toThrow(ValidationError);
    expect(getTask(db, t.id)!.topicId).toBe(NO_TOPIC_ID);
  });
});
