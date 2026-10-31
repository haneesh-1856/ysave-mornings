/** @jest-environment node */
import { startDecision } from '../../domain/timer';
import { ConflictError, NotFoundError, sqliteMessage } from '../errors';
import { endSession, getOpenSession, startSession } from '../repos/sessions';
import { days, dayTasks, sessions } from '../schema';
import { createTestDb } from './testDb';

function setup() {
  const { db, sqlite } = createTestDb();
  let n = 0;
  const newId = () => `s-${++n}`;
  db.insert(days).values({ dayKey: '2026-10-29', planConfirmedAt: 1, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, createdAt: 1, updatedAt: 1 }).run();
  for (const id of ['A', 'B']) {
    db.insert(dayTasks)
      .values({
        id, dayKey: '2026-10-29', taskId: null, topicId: 't', name: id, colorKey: 'study', kind: 'timed',
        budgetSec: 600, cue: null, treat: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null,
        sortOrder: 0, createdAt: 1, updatedAt: 1,
      })
      .run();
  }
  return { db, sqlite, newId };
}

describe('sessions repo', () => {
  it('starts and ends a session, returning domain Sessions', () => {
    const { db, newId } = setup();
    expect(getOpenSession(db)).toBeNull();
    const s = startSession(db, { dayTaskId: 'A', closeSessionId: null, now: 1000, newId });
    expect(s).toEqual({ id: 's-1', dayTaskId: 'A', startedAt: 1000, endedAt: null });
    expect(getOpenSession(db)).toEqual(s);
    const ended = endSession(db, s.id, 2000);
    expect(ended).toEqual({ id: 's-1', dayTaskId: 'A', startedAt: 1000, endedAt: 2000 });
    expect(getOpenSession(db)).toBeNull();
    // ending again does not move endedAt
    expect(endSession(db, s.id, 9999).endedAt).toBe(2000);
    expect(() => endSession(db, 'missing', 1)).toThrow(NotFoundError);
  });

  it('starting B while A runs closes A first and succeeds (via StartDecision)', () => {
    const { db, newId } = setup();
    const a = startSession(db, { dayTaskId: 'A', closeSessionId: null, now: 1000, newId });
    const day = { dayKey: '2026-10-29', planConfirmedAt: 1, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4 } as const;
    const target = {
      id: 'B', dayKey: '2026-10-29', taskId: null, topicId: 't', name: 'B', colorKey: 'study', kind: 'timed',
      budgetSec: 600, cue: null, treat: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null, sortOrder: 0,
    } as const;
    const decision = startDecision(target, day, getOpenSession(db));
    expect(decision).toEqual({ ok: true, closeSessionId: a.id });
    const closeSessionId = decision.ok ? decision.closeSessionId : null;
    const b = startSession(db, { dayTaskId: 'B', closeSessionId, now: 5000, newId });
    expect(getOpenSession(db)).toEqual(b);
    const rows = db.select().from(sessions).all();
    expect(rows.find((r) => r.id === a.id)?.endedAt).toBe(5000);
  });

  it('a second open session without closing the first is a ConflictError and writes nothing', () => {
    const { db, newId } = setup();
    startSession(db, { dayTaskId: 'A', closeSessionId: null, now: 1000, newId });
    expect(() => startSession(db, { dayTaskId: 'B', closeSessionId: null, now: 2000, newId })).toThrow(ConflictError);
    expect(db.select().from(sessions).all()).toHaveLength(1);
    expect(getOpenSession(db)?.dayTaskId).toBe('A');
  });

  it('closing a stale id that is not the open one still conflicts, and rolls back', () => {
    const { db, newId } = setup();
    startSession(db, { dayTaskId: 'A', closeSessionId: null, now: 1000, newId });
    expect(() => startSession(db, { dayTaskId: 'B', closeSessionId: 'nope', now: 2000, newId })).toThrow(ConflictError);
    expect(getOpenSession(db)?.endedAt).toBeNull();
  });

  it('other database errors are not disguised as conflicts', () => {
    const { db, newId } = setup();
    let err: unknown;
    try {
      startSession(db, { dayTaskId: 'ghost', closeSessionId: null, now: 1, newId });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ConflictError);
  });
});

describe('sqliteMessage', () => {
  it('follows a cause chain of non-Error (cross-realm-like) objects to the UNIQUE message', () => {
    // Shape of a better-sqlite3 SqliteError from another jest realm: has message/cause, fails instanceof Error.
    const driver = { message: 'UNIQUE constraint failed: sessions.open_one', code: 'SQLITE_CONSTRAINT_UNIQUE' };
    const wrapper = { message: 'Failed query: insert into "sessions"', cause: driver };
    expect(driver instanceof Error).toBe(false);
    expect(sqliteMessage(wrapper)).toMatch(/UNIQUE constraint failed/);
    expect(sqliteMessage(new Error('outer', { cause: wrapper }))).toBe(
      'outer | Failed query: insert into "sessions" | UNIQUE constraint failed: sessions.open_one',
    );
  });

  it('stops at non-message values and at the depth limit', () => {
    expect(sqliteMessage('boom')).toBe('');
    expect(sqliteMessage(null)).toBe('');
    expect(sqliteMessage({ message: 'a', cause: 42 })).toBe('a');
    const deep = { message: '1', cause: { message: '2', cause: { message: '3', cause: { message: '4', cause: { message: '5' } } } } };
    expect(sqliteMessage(deep)).toBe('1 | 2 | 3 | 4');
  });
});
