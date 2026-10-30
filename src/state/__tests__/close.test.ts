import { renderHook } from '@testing-library/react-native';
import { listDays, loadDayBundle } from '../../data/repos/days';
import { getOpenSession } from '../../data/repos/sessions';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import { closeToday, MissingOutcomesError } from '../actions/close';
import { createTask, createTopic, removeTopic } from '../actions/library';
import { confirmDayPlan } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { startTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { useChain } from '../hooks/useChain';
import { useCloseSummary } from '../hooks/useCloseSummary';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29';
const TOMORROW = '2026-10-30';
const MIN = 60_000;
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000; // 10:00

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(() => teardownState());

/** Study: A (30 min timed), C1, C2 (checks). Returns today's day-task ids by name. */
function seed() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C1', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C2', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
  const b = loadDayBundle(db, TODAY)!;
  return Object.fromEntries(b.dayTasks.map((d) => [d.name, d.id]));
}

describe('closeToday', () => {
  it('writes outcomes, closes the day by user, and forwards moved rows into a new tomorrow', () => {
    const id = seed();
    t = T0 + 10 * MIN;
    closeToday({ [id.C1]: 'moved', [id.C2]: 'let_go' });
    const b = loadDayBundle(db, TODAY)!;
    expect(b.day.closedAt).toBe(t);
    expect(b.day.closedBy).toBe('user');
    expect(b.dayTasks.find((d) => d.id === id.C1)!.closeOutcome).toBe('moved');
    expect(b.dayTasks.find((d) => d.id === id.C2)!.closeOutcome).toBe('let_go');
    const tm = loadDayBundle(db, TOMORROW)!;
    expect(tm.day.closedAt).toBeNull();
    expect(tm.dayTasks).toHaveLength(1);
    expect(tm.dayTasks[0]).toMatchObject({ name: 'C1', forwardedFromDayKey: TODAY });
  });

  it('skips a moved task already planned tomorrow and keeps the existing tomorrow row', () => {
    const id = seed();
    confirmDayPlan(
      TOMORROW,
      buildPlan({ dayKey: TOMORROW, topics: listTopics(db), tasks: listTasks(db), day: null, dayTasks: [] }),
    );
    const before = loadDayBundle(db, TOMORROW)!;
    const c1Before = before.dayTasks.filter((d) => d.name === 'C1').length;
    closeToday({ [id.C1]: 'moved', [id.C2]: 'moved' });
    const after = loadDayBundle(db, TOMORROW)!;
    expect(after.dayTasks.filter((d) => d.name === 'C1')).toHaveLength(c1Before);
    expect(after.day.planConfirmedAt).toBe(before.day.planConfirmedAt);
  });

  it('rejects missing outcomes with the count and ids, writing nothing', () => {
    const id = seed();
    let err: unknown;
    try {
      closeToday({});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
    expect(err).toBeInstanceOf(MissingOutcomesError);
    expect((err as Error).message).toBe('Choose Move or Let go for 2 tasks');
    expect([...(err as MissingOutcomesError).missing].sort()).toEqual([id.C1, id.C2].sort());
    expect(() => closeToday({ [id.C1]: 'let_go' })).toThrow('Choose Move or Let go for 1 task');
    expect(loadDayBundle(db, TODAY)!.day.closedAt).toBeNull();
    expect(listDays(db, TOMORROW, TOMORROW)).toHaveLength(0);
  });

  it('keeps a prefilled (unconfirmed) today final after closing: a later reconcile adds no rows', () => {
    const id = seed();
    closeToday({ [id.C1]: 'let_go', [id.C2]: 'let_go' });
    const before = loadDayBundle(db, TODAY)!;
    expect(before.day.planConfirmedAt).toBeNull();
    const study = listTopics(db)[0];
    createTask(study.id, { name: 'N', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
    t = T0 + 30 * MIN;
    reconcile();
    expect(loadDayBundle(db, TODAY)).toEqual(before);
  });

  it('rejects closing twice', () => {
    const id = seed();
    closeToday({ [id.C1]: 'let_go', [id.C2]: 'let_go' });
    expect(() => closeToday({})).toThrow('Today is already closed');
  });

  it('ends a running session at now', () => {
    const id = seed();
    startTask(id.A);
    t = T0 + 7 * MIN;
    toggleCheckTask(id.C1);
    closeToday({ [id.C2]: 'let_go' });
    expect(getOpenSession(db)).toBeNull();
    expect(loadDayBundle(db, TODAY)!.sessionsByDayTask[id.A][0].endedAt).toBe(t);
  });
});

describe('useCloseSummary', () => {
  it('reports unticked rows, counts, focus and extra time', async () => {
    const id = seed();
    startTask(id.A); // 30 min budget
    t = T0 + 40 * MIN; // 10 min over
    toggleCheckTask(id.C1);
    const { result } = await renderHook(() => useCloseSummary());
    const s = result.current;
    expect(s.todayKey).toBe(TODAY);
    expect(s.tomorrowKey).toBe(TOMORROW);
    expect(s.closed).toBe(false);
    expect(s.unticked.map((u) => u.name)).toEqual(['C2']);
    expect(s.unticked[0]).toMatchObject({ dayTaskId: id.C2, topicName: 'Study', colorKey: 'study' });
    expect(s.total).toBe(3);
    expect(s.done).toBe(2); // A completed at its budget + C1
    expect(s.focusedMs).toBe(40 * MIN);
    expect(s.extraMs).toBe(10 * MIN);
    expect(s.items.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to "Removed topic" and handles a missing day', async () => {
    seed();
    removeTopic(listTopics(db)[0].id);
    const { result } = await renderHook(() => useCloseSummary());
    for (const u of result.current.unticked) expect(u.topicName).toBe('Removed topic');
    teardownState();
    setupState(T0);
    const empty = await renderHook(() => useCloseSummary());
    expect(empty.result.current).toMatchObject({ day: null, closed: false, total: 0, unticked: [] });
  });
});

describe('useChain', () => {
  it('builds 8 links with rest days for missing or empty days', async () => {
    seed();
    const dayKey = (n: number) => new Date(Date.UTC(2026, 9, 29 - n)).toISOString().slice(0, 10);
    const topics = listTopics(db);
    const tasks = listTasks(db);
    for (const n of [1, 3]) {
      // Plan a past day (planning marble => 1 item) by moving the clock back, then restoring it.
      const saved = t;
      t = dayStartOf(dayKey(n), 4) + 2 * 3_600_000;
      confirmDayPlan(dayKey(n), buildPlan({ dayKey: dayKey(n), topics, tasks, day: null, dayTasks: [] }));
      t = saved;
    }
    const { result } = await renderHook(() => useChain());
    expect(result.current).toEqual(['rest', 'rest', 'rest', 'rest', 'solid', 'rest', 'solid', 'today']);
  });
});
