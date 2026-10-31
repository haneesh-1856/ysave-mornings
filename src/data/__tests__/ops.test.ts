/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { buildPlan, confirmPlan } from '../../domain/plan';
import { closeByHand, rollover, type Ops } from '../../domain/rollover';
import { dayEndOf, dayKeyOf, dayStartOf } from '../../domain/dayKey';
import type { CloseOutcome, DayKey, Epoch } from '../../domain/types';
import { applyOps } from '../repos/ops';
import {
  getDay, loadDayBundle, loadOpenPastDays, saveConfirmedPlan,
} from '../repos/days';
import { getOpenSession, startSession } from '../repos/sessions';
import { createTask, listTasks } from '../repos/tasks';
import { createTopic, listTopics } from '../repos/topics';
import { days, dayTasks, sessions } from '../schema';
import type { DB } from '../types';
import { createTestDb } from './testDb';

const H = 4;
const D27 = '2026-10-27';
const D28 = '2026-10-28';
const TODAY = '2026-10-29';
const NOW: Epoch = dayStartOf(TODAY, H) + 6 * 3_600_000; // 10:00 on the 29th

function setup() {
  const { db } = createTestDb();
  let n = 0;
  const newId = () => `id-${++n}`;
  const topic = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, newId);
  const base = { topicId: topic.id, repeatMask: 127, isDefault: true, cue: null, treat: null } as const;
  createTask(db, { ...base, name: 'DSA', kind: 'timed', minutes: 60 }, 1, newId);
  createTask(db, { ...base, name: 'Read', kind: 'check', minutes: 15 }, 1, newId);
  createTask(db, { ...base, name: 'Stretch', kind: 'check', minutes: 10 }, 1, newId);
  return { db, newId };
}

function plan(db: DB, dayKey: DayKey, now: Epoch, newId: () => string) {
  const b = loadDayBundle(db, dayKey);
  const draft = buildPlan({ dayKey, topics: listTopics(db), tasks: listTasks(db), day: b?.day ?? null, dayTasks: b?.dayTasks ?? [] });
  saveConfirmedPlan(db, { dayKey, dayStartHour: H, result: confirmPlan(draft, b?.dayTasks ?? [], []), now, newId });
}

function runRollover(db: DB, now: Epoch) {
  const todayKey = dayKeyOf(now, H);
  const bundle = loadDayBundle(db, todayKey);
  return rollover({
    todayKey,
    dayStartHour: H,
    openDays: loadOpenPastDays(db, todayKey),
    today: { day: bundle?.day ?? null, dayTasks: bundle?.dayTasks ?? [] },
    topics: listTopics(db),
    tasks: listTasks(db),
  });
}

const isEmpty = (o: Ops) =>
  Object.values({ ...o, todayKey: undefined, autoClosed: undefined }).every((v) => v === undefined || (Array.isArray(v) && v.length === 0));

describe('applyOps', () => {
  it('applies a real rollover output and is idempotent end to end', () => {
    const { db, newId } = setup();
    plan(db, D27, dayStartOf(D27, H), newId);
    const b27 = loadDayBundle(db, D27)!;
    const timed = b27.dayTasks.find((t) => t.kind === 'timed')!;
    const [read, stretch] = b27.dayTasks.filter((t) => t.kind === 'check');
    // Stretch ticked on the 27th, Read left unticked; DSA still running at midnight.
    db.update(dayTasks).set({ completedAt: dayStartOf(D27, H) + 1000 }).where(eq(dayTasks.id, stretch.id)).run();
    startSession(db, { dayTaskId: timed.id, closeSessionId: null, now: dayStartOf(D27, H) + 3_600_000, newId });

    const ops = runRollover(db, NOW);
    expect(ops.autoClosed).toEqual([D27]);
    expect(ops.closeSessions).toHaveLength(1);
    applyOps(db, ops, newId, NOW);

    // 27th closed by auto; its open session ended at the day's end; DSA hit its budget there
    const after27 = loadDayBundle(db, D27)!;
    expect(after27.day).toMatchObject({ closedBy: 'auto', closedAt: expect.any(Number) });
    const session = after27.sessionsByDayTask[timed.id][0];
    expect(session.endedAt).toBe(dayEndOf(D27, H));
    expect(getOpenSession(db)).toBeNull();
    expect(after27.dayTasks.find((t) => t.id === timed.id)!.completedAt).not.toBeNull();
    expect(after27.dayTasks.find((t) => t.id === read.id)!.closeOutcome).not.toBeNull();
    expect(getDay(db, TODAY)).not.toBeNull();

    // Running rollover again on the stored state produces nothing to do.
    const again = runRollover(db, NOW);
    expect(isEmpty(again)).toBe(true);
    applyOps(db, again, newId, NOW + 1000); // applying empty Ops is a harmless no-op
    expect(loadOpenPastDays(db, TODAY).map((b) => b.day.dayKey)).toEqual([]);
  });

  it('applies closeByHand output: outcomes, forwarded row in the next day, new days row', () => {
    const { db, newId } = setup();
    plan(db, D28, dayStartOf(D28, H), newId);
    const b = loadDayBundle(db, D28)!;
    const [read, stretch] = b.dayTasks.filter((t) => t.kind === 'check');
    const outcomes: Record<string, CloseOutcome> = {};
    outcomes[read.id] = 'moved';
    outcomes[stretch.id] = 'let_go';
    const now = dayStartOf(D28, H) + 5 * 3_600_000;
    const ops = closeByHand(b, outcomes, { day: null, dayTasks: [], dayStartHour: H }, now);
    applyOps(db, ops, newId, now + 1);

    const closed = loadDayBundle(db, D28)!;
    expect(closed.day).toMatchObject({ closedAt: now, closedBy: 'user' });
    expect(closed.dayTasks.find((t) => t.id === read.id)!.closeOutcome).toBe('moved');
    expect(closed.dayTasks.find((t) => t.id === stretch.id)!.closeOutcome).toBe('let_go');

    const next = loadDayBundle(db, TODAY)!;
    expect(next.day).toMatchObject({ planConfirmedAt: null, planDraftedAt: null, closedAt: null, dayStartHour: H });
    expect(next.dayTasks).toHaveLength(1);
    expect(next.dayTasks[0]).toMatchObject({ taskId: read.taskId, forwardedFromDayKey: D28, completedAt: null });
    expect(next.dayTasks[0].id).not.toBe('');

    // updatedAt was stamped with the call's now
    const row = db.select().from(days).all().find((d) => d.dayKey === D28)!;
    expect(row.updatedAt).toBe(now + 1);
  });

  it('rolls back everything when any op fails mid-way', () => {
    const { db, newId } = setup();
    plan(db, D27, dayStartOf(D27, H), newId);
    const b = loadDayBundle(db, D27)!;
    const timed = b.dayTasks.find((t) => t.kind === 'timed')!;
    const s = startSession(db, { dayTaskId: timed.id, closeSessionId: null, now: 10, newId });
    const good: Ops = {
      closeSessions: [{ id: s.id, endedAt: 500 }],
      completions: [{ dayTaskId: timed.id, completedAt: 500 }],
      outcomes: [],
      closeDays: [{ dayKey: D27, closedAt: 500, closedBy: 'auto' }],
      createDays: [{ dayKey: D28, planConfirmedAt: null, planDraftedAt: null, closedAt: null, closedBy: null, dayStartHour: H }],
      forwardDayTasks: [],
      insertDayTasks: [
        // replaced below: FK violation (no days row for 2000-01-01), so the LAST step fails
      ],
    };
    const { id: _id, ...draft } = b.dayTasks[1];
    good.insertDayTasks = [{ ...draft, dayKey: '2000-01-01', taskId: null }];

    const before = {
      days: db.select().from(days).all(),
      tasks: db.select().from(dayTasks).all(),
      sessions: db.select().from(sessions).all(),
    };
    expect(() => applyOps(db, good, newId, 999)).toThrow();
    expect(db.select().from(days).all()).toEqual(before.days);
    expect(db.select().from(dayTasks).all()).toEqual(before.tasks);
    expect(db.select().from(sessions).all()).toEqual(before.sessions);
    expect(getOpenSession(db)?.id).toBe(s.id);
    expect(getDay(db, D28)).toBeNull();
  });
});
