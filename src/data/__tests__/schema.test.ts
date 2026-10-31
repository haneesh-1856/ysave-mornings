/** @jest-environment node */
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { createTestDb } from './testDb';
import type { relations } from '../relations';
import type { DB } from '../types';
import * as s from '../schema';

/** Drizzle wraps driver errors in 'Failed query'; the SQLite message is on `cause`. */
function sqliteError(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return `${err.message} | ${err.cause?.message ?? ''}`;
  }
  return '';
}

const T = { createdAt: 1, updatedAt: 1 };

function seed(db: DB) {
  db.insert(s.topics).values({ id: 'tp', name: 'Study', colorKey: 'study', sortOrder: 0, isOpen: true, ...T }).run();
  db.insert(s.tasks)
    .values({ id: 'tk', topicId: 'tp', name: 'Read', kind: 'timed', minutes: 25, repeatMask: 0, isDefault: false, note: '', sortOrder: 0, ...T })
    .run();
  db.insert(s.days).values({ dayKey: '2026-10-29', dayStartHour: 4, ...T }).run();
}

function dayTask(id: string, taskId: string | null) {
  return {
    id, dayKey: '2026-10-29', taskId, topicId: 'tp', name: 'Read', colorKey: 'study' as const,
    kind: 'timed' as const, budgetSec: 1500, sortOrder: 0, ...T,
  };
}

function session(id: string, endedAt: number | null) {
  return { id, dayTaskId: 'dt1', startedAt: 10, endedAt, ...T };
}

describe('schema', () => {
  it('type-level: better-sqlite3 db is assignable to DB', () => {
    const { db } = createTestDb();
    const asDb: DB = db;
    expect(asDb).toBe(db);
  });

  it('creates all tables and columns', () => {
    const { sqlite } = createTestDb();
    const cols = (t: string) =>
      (sqlite.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name).sort();
    const stamps = ['createdAt', 'updatedAt'];
    expect(cols('topics')).toEqual([...stamps, 'colorKey', 'deletedAt', 'id', 'isOpen', 'name', 'sortOrder'].sort());
    expect(cols('tasks')).toEqual(
      [...stamps, 'id', 'topicId', 'name', 'kind', 'minutes', 'repeatMask', 'isDefault', 'cue', 'treat', 'note', 'sortOrder', 'deletedAt', 'defaultChangedAt'].sort(),
    );
    expect(cols('days')).toEqual([...stamps, 'dayKey', 'planConfirmedAt', 'planDraftedAt', 'planUpdatedAt', 'closedAt', 'closedBy', 'dayStartHour'].sort());
    expect(cols('day_tasks')).toEqual(
      [...stamps, 'id', 'dayKey', 'taskId', 'topicId', 'name', 'colorKey', 'kind', 'budgetSec', 'cue', 'treat',
        'forwardedFromDayKey', 'completedAt', 'closeOutcome', 'sortOrder'].sort(),
    );
    expect(cols('sessions')).toEqual([...stamps, 'id', 'dayTaskId', 'startedAt', 'endedAt'].sort());
    expect(cols('settings')).toEqual([...stamps, 'key', 'value'].sort());
  });

  it('allows only one open session', () => {
    const { db } = createTestDb();
    seed(db);
    db.insert(s.dayTasks).values(dayTask('dt1', 'tk')).run();
    db.insert(s.sessions).values(session('s1', null)).run();
    expect(sqliteError(() => db.insert(s.sessions).values(session('s2', null)).run())).toMatch(/UNIQUE/);
  });

  it('allows many closed sessions', () => {
    const { db } = createTestDb();
    seed(db);
    db.insert(s.dayTasks).values(dayTask('dt1', 'tk')).run();
    db.insert(s.sessions).values(session('s1', 20)).run();
    db.insert(s.sessions).values(session('s2', 30)).run();
    db.insert(s.sessions).values(session('s3', null)).run();
    expect(db.select().from(s.sessions).all()).toHaveLength(3);
  });

  it('rejects duplicate (dayKey, taskId) but allows multiple one-offs', () => {
    const { db } = createTestDb();
    seed(db);
    db.insert(s.dayTasks).values(dayTask('a', 'tk')).run();
    expect(sqliteError(() => db.insert(s.dayTasks).values(dayTask('b', 'tk')).run())).toMatch(/UNIQUE/);
    db.insert(s.dayTasks).values(dayTask('c', null)).run();
    db.insert(s.dayTasks).values(dayTask('d', null)).run();
    expect(db.select().from(s.dayTasks).all()).toHaveLength(3);
  });

  it('enforces foreign keys', () => {
    const { db } = createTestDb();
    expect(
      sqliteError(() =>
        db.insert(s.tasks)
        .values({ id: 'x', topicId: 'missing', name: 'n', kind: 'check', minutes: 5, repeatMask: 0, isDefault: false, note: '', sortOrder: 0, ...T })
        .run(),
      ),
    ).toMatch(/FOREIGN KEY/);
    expect(sqliteError(() => db.insert(s.dayTasks).values(dayTask('y', null)).run())).toMatch(/FOREIGN KEY/);
    expect(sqliteError(() => db.insert(s.sessions).values(session('z', 1)).run())).toMatch(/FOREIGN KEY/);
  });
});

// Compile-time proof (checked by tsc): the expo-sqlite drizzle db is assignable to DB too.
export type ExpoIsDb = ExpoSQLiteDatabase<typeof relations> extends DB ? true : never;
export const expoIsDb: ExpoIsDb = true;
