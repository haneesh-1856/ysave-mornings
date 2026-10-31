/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { buildPlan, confirmPlan, setTicked } from '../../domain/plan';
import type { DayTask } from '../../domain/types';
import {
  discardDraft, getDay, listDays, loadDayBundle, loadOpenPastDays, saveConfirmedPlan, saveDraftPlan, setCheckCompleted, setCompletedAt,
  setFutureDayStartHour,
} from '../repos/days';
import { startSession, endSession } from '../repos/sessions';
import { createTask, getTask, listTasks, softDeleteTask } from '../repos/tasks';
import { createTopic, listTopics } from '../repos/topics';
import { days, dayTasks } from '../schema';
import type { DB } from '../types';
import { createTestDb } from './testDb';

const DAY = '2026-10-29';

function setup() {
  const { db } = createTestDb();
  let n = 0;
  const newId = () => `id-${++n}`;
  const topic = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, newId);
  const base = { topicId: topic.id, repeatMask: 127, isDefault: true, cue: null, treat: null } as const;
  const dsa = createTask(db, { ...base, name: 'DSA', kind: 'timed', minutes: 60 }, 1, newId);
  const read = createTask(db, { ...base, name: 'Read', kind: 'check', minutes: 15 }, 1, newId);
  return { db, newId, topic, dsa, read };
}

/** Domain pipeline: load -> buildPlan -> (edit) -> confirmPlan, as the state layer will do. */
function planFor(db: DB, dayKey: string, edit?: (d: ReturnType<typeof buildPlan>) => ReturnType<typeof buildPlan>) {
  const bundle = loadDayBundle(db, dayKey);
  let draft = buildPlan({
    dayKey,
    topics: listTopics(db),
    tasks: listTasks(db),
    day: bundle?.day ?? null,
    dayTasks: bundle?.dayTasks ?? [],
  });
  if (edit) draft = edit(draft);
  const sessions = Object.values(bundle?.sessionsByDayTask ?? {}).flat();
  return confirmPlan(draft, bundle?.dayTasks ?? [], sessions);
}

describe('days repo', () => {
  it('saveConfirmedPlan creates the day with H, inserts rows with ids, sets planConfirmedAt once', () => {
    const { db, newId, dsa, read } = setup();
    expect(getDay(db, DAY)).toBeNull();
    expect(loadDayBundle(db, DAY)).toBeNull();

    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 6, result: planFor(db, DAY), now: 1000, newId });
    const b = loadDayBundle(db, DAY)!;
    expect(b.day).toEqual({ dayKey: DAY, planConfirmedAt: 1000, planDraftedAt: null, planUpdatedAt: 1000, closedAt: null, closedBy: null, dayStartHour: 6 });
    expect(b.dayTasks.map((t) => t.taskId)).toEqual([dsa.id, read.id]);
    expect(b.dayTasks.map((t) => t.sortOrder)).toEqual([0, 1]);
    expect(b.dayTasks[0]).toMatchObject({ budgetSec: 3600, name: 'DSA', kind: 'timed', closeOutcome: null, completedAt: null });
    expect(b.dayTasks[1].budgetSec).toBe(0);
    expect(Object.keys(b.sessionsByDayTask).sort()).toEqual(b.dayTasks.map((t) => t.id).sort());

    // Re-confirm later with an edit: planConfirmedAt stays, dayStartHour of the existing row is kept
    const again = planFor(db, DAY, (d) => ({ ...d, groups: d.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, cue: 'desk' })) })) }));
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 9, result: again, now: 5000, newId });
    const b2 = loadDayBundle(db, DAY)!;
    expect(b2.day.planConfirmedAt).toBe(1000);
    expect(b2.day.dayStartHour).toBe(6);
    expect(b2.dayTasks.map((t) => t.id)).toEqual(b.dayTasks.map((t) => t.id));
    expect(b2.dayTasks.every((t) => t.cue === 'desk')).toBe(true);
  });

  it('keeps unticked rows that have progress and deletes the rest', () => {
    const { db, newId } = setup();
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result: planFor(db, DAY), now: 1, newId });
    const [dsaRow, readRow] = loadDayBundle(db, DAY)!.dayTasks;
    const s = startSession(db, { dayTaskId: dsaRow.id, closeSessionId: null, now: 10, newId });
    endSession(db, s.id, 20);

    const result = planFor(db, DAY, (d) => setTicked(setTicked(d, dsaRow.id, false), readRow.id, false));
    expect(result.deleteIds).toEqual([readRow.id]);
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result, now: 2, newId });
    const b = loadDayBundle(db, DAY)!;
    expect(b.dayTasks.map((t) => t.id)).toEqual([dsaRow.id]);
    expect(b.sessionsByDayTask[dsaRow.id]).toHaveLength(1);
  });

  it('runs deletes before inserts so a re-added (dayKey, taskId) does not collide', () => {
    const { db, newId, dsa } = setup();
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result: planFor(db, DAY), now: 1, newId });
    const old = loadDayBundle(db, DAY)!.dayTasks.find((t) => t.taskId === dsa.id)!;
    const { id: _id, ...draft } = old;
    saveConfirmedPlan(db, {
      dayKey: DAY,
      dayStartHour: 4,
      result: { insert: [{ ...draft, budgetSec: 1800 }], update: [], deleteIds: [old.id] },
      now: 2,
      newId,
    });
    const rows = loadDayBundle(db, DAY)!.dayTasks.filter((t) => t.taskId === dsa.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(old.id);
    expect(rows[0].budgetSec).toBe(1800);
  });

  it('is atomic: a failing insert leaves no day row and no partial plan', () => {
    const { db, newId, dsa } = setup();
    const ok = planFor(db, DAY);
    const dup = { ...ok, insert: [...ok.insert, ok.insert[0]] }; // same (dayKey, taskId) twice
    expect(() => saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result: dup, now: 1, newId })).toThrow();
    expect(getDay(db, DAY)).toBeNull();
    expect(db.select().from(dayTasks).all()).toHaveLength(0);
    expect(dsa.id).toBeTruthy();
  });

  it('rejects an invalid dayStartHour', () => {
    const { db, newId } = setup();
    expect(() => saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 24, result: planFor(db, DAY), now: 1, newId })).toThrow('0-23');
  });

  it('soft-deleted tasks keep their day_tasks snapshot and stay in the day plan (doc 04 section 11)', () => {
    const { db, newId, dsa } = setup();
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result: planFor(db, DAY), now: 1, newId });
    softDeleteTask(db, dsa.id, 50);

    expect(listTasks(db).map((t) => t.id)).not.toContain(dsa.id);
    expect(getTask(db, dsa.id)).toMatchObject({ name: 'DSA', deletedAt: 50 });
    const b = loadDayBundle(db, DAY)!;
    expect(b.dayTasks.map((t) => t.name)).toEqual(['DSA', 'Read']);

    // The domain still shows it in the open plan when given the deleted task alongside the library.
    const draft = buildPlan({
      dayKey: DAY, topics: listTopics(db), tasks: [getTask(db, dsa.id)!, ...listTasks(db)], day: b.day, dayTasks: b.dayTasks,
    });
    const rows = draft.groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.name === 'DSA')).toMatchObject({ ticked: true, dayTaskId: b.dayTasks[0].id });
  });

  it('listDays is inclusive and ordered; loadOpenPastDays returns only open earlier days', () => {
    const { db, newId } = setup();
    for (const [i, k] of ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'].entries()) {
      saveConfirmedPlan(db, { dayKey: k, dayStartHour: 4, result: planFor(db, k), now: i + 1, newId });
    }
    db.update(days).set({ closedAt: 99, closedBy: 'user' }).where(eq(days.dayKey, '2026-10-26')).run();
    expect(listDays(db, '2026-10-26', '2026-10-28').map((d) => d.dayKey)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(listDays(db, '2030-01-01', '2030-01-02')).toEqual([]);
    const open = loadOpenPastDays(db, '2026-10-28');
    expect(open.map((b) => b.day.dayKey)).toEqual(['2026-10-25', '2026-10-27']);
    expect(open[0].dayTasks).toHaveLength(2);
    expect(loadOpenPastDays(db, '2026-10-25')).toEqual([]);
  });

  it('setCheckCompleted ticks and unticks; setCompletedAt writes several in one go', () => {
    const { db, newId } = setup();
    saveConfirmedPlan(db, { dayKey: DAY, dayStartHour: 4, result: planFor(db, DAY), now: 1, newId });
    const [a, b] = loadDayBundle(db, DAY)!.dayTasks;
    setCheckCompleted(db, b.id, 777, 5);
    expect(loadDayBundle(db, DAY)!.dayTasks[1].completedAt).toBe(777);
    setCheckCompleted(db, b.id, null, 6);
    expect(loadDayBundle(db, DAY)!.dayTasks[1].completedAt).toBeNull();
    expect(() => setCheckCompleted(db, 'missing', 1, 1)).toThrow('not found');

    setCompletedAt(db, [{ dayTaskId: a.id, completedAt: 10 }, { dayTaskId: b.id, completedAt: 20 }], 7);
    const t: DayTask[] = loadDayBundle(db, DAY)!.dayTasks;
    expect(t.map((x) => x.completedAt)).toEqual([10, 20]);
    setCompletedAt(db, [], 8); // no-op
  });
});

describe('setFutureDayStartHour', () => {
  function seedDays() {
    const { db } = createTestDb();
    for (const dayKey of ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']) {
      db.insert(days).values({ dayKey, planConfirmedAt: null, planDraftedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, createdAt: 1, updatedAt: 1 }).run();
    }
    return db;
  }

  it('updates only rows after the key and bumps their updatedAt', () => {
    const db = seedDays();
    setFutureDayStartHour(db, '2026-10-29', 6, 500);
    expect(listDays(db, '2026-10-28', '2026-10-31').map((d) => d.dayStartHour)).toEqual([4, 4, 6, 6]);
    const rows = db.select().from(days).all();
    expect(Object.fromEntries(rows.map((r) => [r.dayKey, r.updatedAt]))).toEqual({
      '2026-10-28': 1, '2026-10-29': 1, '2026-10-30': 500, '2026-10-31': 500,
    });
  });

  it('is a no-op when no row is after the key', () => {
    const db = seedDays();
    setFutureDayStartHour(db, '2026-10-31', 2, 500);
    expect(listDays(db, '2026-10-28', '2026-10-31').map((d) => d.dayStartHour)).toEqual([4, 4, 4, 4]);
  });

  it('rejects hours outside 0-23 and non-integers without writing', () => {
    const db = seedDays();
    for (const h of [-1, 24, 2.5, NaN]) {
      expect(() => setFutureDayStartHour(db, '2026-10-28', h, 500)).toThrow(/0-23/);
    }
    expect(listDays(db, '2026-10-28', '2026-10-31').map((d) => d.dayStartHour)).toEqual([4, 4, 4, 4]);
  });
});

describe('draft plans (ADR-010)', () => {
  const LATER = '2026-11-04';

  it('saveDraftPlan writes rows and planDraftedAt, leaves planConfirmedAt null; re-saving replaces the rows', () => {
    const { db, newId, dsa, read } = setup();
    saveDraftPlan(db, { dayKey: LATER, dayStartHour: 6, result: planFor(db, LATER), now: 1000, newId });
    const b = loadDayBundle(db, LATER)!;
    expect(b.day).toEqual({ dayKey: LATER, planConfirmedAt: null, planDraftedAt: 1000, planUpdatedAt: 1000, closedAt: null, closedBy: null, dayStartHour: 6 });
    expect(b.dayTasks.map((t) => t.taskId)).toEqual([dsa.id, read.id]);

    // second save: untick DSA, keep Read
    const dsaRow = b.dayTasks[0];
    const again = planFor(db, LATER, (d) => setTicked(d, dsaRow.id, false));
    saveDraftPlan(db, { dayKey: LATER, dayStartHour: 6, result: again, now: 2000, newId });
    const b2 = loadDayBundle(db, LATER)!;
    expect(b2.dayTasks.map((t) => t.taskId)).toEqual([read.id]);
    expect(b2.day).toMatchObject({ planConfirmedAt: null, planDraftedAt: 2000 });
  });

  it('saveDraftPlan refuses a confirmed day, a closed day, or a day with sessions, writing nothing', () => {
    const { db, newId } = setup();
    saveConfirmedPlan(db, { dayKey: LATER, dayStartHour: 4, result: planFor(db, LATER), now: 1, newId });
    expect(() => saveDraftPlan(db, { dayKey: LATER, dayStartHour: 4, result: planFor(db, LATER), now: 2, newId })).toThrow(/final plan/);

    const other = '2026-11-05';
    db.insert(days).values({ dayKey: other, closedAt: 5, closedBy: 'user', dayStartHour: 4, createdAt: 1, updatedAt: 1 }).run();
    expect(() => saveDraftPlan(db, { dayKey: other, dayStartHour: 4, result: planFor(db, other), now: 2, newId })).toThrow(/final plan/);

    const third = '2026-11-06';
    saveDraftPlan(db, { dayKey: third, dayStartHour: 4, result: planFor(db, third), now: 3, newId });
    const row = loadDayBundle(db, third)!.dayTasks[0];
    startSession(db, { dayTaskId: row.id, closeSessionId: null, now: 10, newId });
    expect(() => saveDraftPlan(db, { dayKey: third, dayStartHour: 4, result: planFor(db, third), now: 4, newId })).toThrow(/progress/);
    expect(loadDayBundle(db, third)!.day.planDraftedAt).toBe(3);
  });

  it('saveDraftPlan validates the hour', () => {
    const { db, newId } = setup();
    expect(() => saveDraftPlan(db, { dayKey: LATER, dayStartHour: 30, result: planFor(db, LATER), now: 1, newId })).toThrow(/0-23/);
    expect(getDay(db, LATER)).toBeNull();
  });

  it('discardDraft removes the rows and the day row; no-draft days are left alone', () => {
    const { db, newId } = setup();
    saveDraftPlan(db, { dayKey: LATER, dayStartHour: 4, result: planFor(db, LATER), now: 1, newId });
    discardDraft(db, LATER, 2);
    expect(getDay(db, LATER)).toBeNull();
    expect(db.select().from(dayTasks).where(eq(dayTasks.dayKey, LATER)).all()).toEqual([]);

    saveConfirmedPlan(db, { dayKey: '2026-11-07', dayStartHour: 4, result: planFor(db, '2026-11-07'), now: 1, newId });
    discardDraft(db, '2026-11-07', 2);
    discardDraft(db, '2026-11-09', 2);
    expect(loadDayBundle(db, '2026-11-07')!.dayTasks).toHaveLength(2);
  });

  it('discardDraft only clears the mark when the day also holds a confirmed plan or a close', () => {
    const { db } = setup();
    db.insert(days).values({ dayKey: LATER, planConfirmedAt: 1, planDraftedAt: 1, dayStartHour: 4, createdAt: 1, updatedAt: 1 }).run();
    discardDraft(db, LATER, 5);
    expect(getDay(db, LATER)).toMatchObject({ planConfirmedAt: 1, planDraftedAt: null });
  });
});
