import { act, renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { applyOps } from '../../data/repos/ops';
import { getOpenSession } from '../../data/repos/sessions';
import type { DB } from '../../data/types';
import { dayEndOf, dayStartOf } from '../../domain/dayKey';
import { createTask, createTopic, removeTopic } from '../actions/library';
import { setTaskNoteFromPlan } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { useNow } from '../hooks/useNow';
import { useRunTask } from '../hooks/useRunTask';
import { useToday } from '../hooks/useToday';
import { useStore } from '../store';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29';
const MIN = 60_000;
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000; // 10:00

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(() => {
  jest.useRealTimers();
  teardownState();
});

function ids(): Record<string, string> {
  const b = loadDayBundle(db, TODAY)!;
  return Object.fromEntries(b.dayTasks.map((d) => [d.name, d.id]));
}

/** Study: A (5 min), B (30 min), Tick (check); all default every day. Returns today's day-task ids by name. */
function seed(minutesA = 5) {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: minutesA, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'B', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'Tick', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
  return ids();
}
const sessionsOf = (id: string) => loadDayBundle(db, TODAY)!.sessionsByDayTask[id];
const dayTask = (id: string) => loadDayBundle(db, TODAY)!.dayTasks.find((d) => d.id === id)!;

describe('reconcile', () => {
  it('prefills an unplanned today and is idempotent', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'A', kind: 'timed', minutes: 5, repeatMask: 127, isDefault: true });
    expect(loadDayBundle(db, TODAY)).toBeNull();
    reconcile();
    const first = loadDayBundle(db, TODAY)!;
    expect(first.dayTasks.map((d) => d.name)).toEqual(['A']);
    expect(first.day.planConfirmedAt).toBeNull();

    const before = useStore.getState();
    expect(reconcile().autoClosed).toEqual([]);
    expect(loadDayBundle(db, TODAY)).toEqual(first);
    expect(useStore.getState()).toEqual(before); // nothing bumped
  });

  it('sets completedAt at the exact instant when the app was closed past the budget', () => {
    const { A } = seed();
    startTask(A);
    t = T0 + 20 * MIN; // phone locked, nothing called
    reconcile();
    expect(dayTask(A).completedAt).toBe(T0 + 5 * MIN);
    expect(getOpenSession(db)?.dayTaskId).toBe(A); // overtime keeps running
    const after = useStore.getState();
    reconcile();
    expect(useStore.getState()).toEqual(after);
  });

  it("closes yesterday's open session at yesterday's end; time never leaks into today", () => {
    // 02:30 on the 29th still belongs to day 28 (dayStartHour 4)
    t = dayStartOf(TODAY, 4) - 90 * MIN;
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Y', kind: 'timed', minutes: 180, repeatMask: 127, isDefault: true });
    reconcile();
    const y = loadDayBundle(db, '2026-10-28')!.dayTasks[0];
    startTask(y.id);
    t = T0; // wake up at 10:00
    expect(reconcile().autoClosed).toEqual(['2026-10-28']);
    const ys = loadDayBundle(db, '2026-10-28')!;
    expect(ys.day.closedBy).toBe('auto');
    expect(ys.sessionsByDayTask[y.id][0].endedAt).toBe(dayEndOf('2026-10-28', 4));
    expect(getOpenSession(db)).toBeNull();
    const today = loadDayBundle(db, TODAY)!;
    expect(Object.values(today.sessionsByDayTask).flat()).toEqual([]); // nothing leaked into today
  });
});

describe('reconcile: stale days and the day boundary', () => {
  it('closes two stale open past days in one reconcile', () => {
    t = dayStartOf('2026-10-26', 4) + 6 * 3_600_000; // 10:00 on the 26th
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Y', kind: 'timed', minutes: 180, repeatMask: 127, isDefault: true });
    createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
    reconcile();
    const d26 = loadDayBundle(db, '2026-10-26')!;
    const y = d26.dayTasks.find((d) => d.name === 'Y')!;
    const c = d26.dayTasks.find((d) => d.name === 'C')!;
    startTask(y.id); // left running on the 26th
    applyOps(db, {
      closeSessions: [], completions: [], outcomes: [], closeDays: [], insertDayTasks: [],
      createDays: [{ dayKey: '2026-10-27', planConfirmedAt: null, closedAt: null, closedBy: null, dayStartHour: 4 }],
    }, () => 'unused', t);
    t = T0; // the 29th
    expect(reconcile().autoClosed).toEqual(['2026-10-26', '2026-10-27']);
    for (const k of ['2026-10-26', '2026-10-27']) {
      const b = loadDayBundle(db, k)!;
      expect(b.day.closedBy).toBe('auto');
      expect(b.day.closedAt).toBe(dayEndOf(k, 4));
    }
    const after = loadDayBundle(db, '2026-10-26')!;
    expect(after.sessionsByDayTask[y.id][0].endedAt).toBe(dayEndOf('2026-10-26', 4));
    expect(after.dayTasks.find((d) => d.id === c.id)!.closeOutcome).toBe('let_go');
    expect(getOpenSession(db)).toBeNull();
    expect(reconcile().autoClosed).toEqual([]);
  });

  it('closes a session spanning the day boundary at exactly 04:00 (H=4, 03:50 -> 04:10)', () => {
    const boundary = dayStartOf(TODAY, 4); // 04:00 on the 29th
    t = boundary - 10 * MIN; // 03:50, still the 28th
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Y', kind: 'timed', minutes: 180, repeatMask: 127, isDefault: true });
    reconcile();
    const y = loadDayBundle(db, '2026-10-28')!.dayTasks[0];
    startTask(y.id);
    t = boundary + 10 * MIN; // 04:10, the 29th
    expect(reconcile().autoClosed).toEqual(['2026-10-28']);
    const s = loadDayBundle(db, '2026-10-28')!.sessionsByDayTask[y.id];
    expect(s).toHaveLength(1);
    expect(s[0].endedAt).toBe(boundary);
    expect(s[0].endedAt! - s[0].startedAt).toBe(10 * MIN); // 10 minutes counted for the 28th
    expect(getOpenSession(db)).toBeNull();
    expect(Object.values(loadDayBundle(db, TODAY)!.sessionsByDayTask).flat()).toEqual([]);
  });
});

describe('run actions', () => {
  it('start makes the task running', () => {
    const { A } = seed();
    startTask(A);
    expect(sessionsOf(A)).toHaveLength(1);
    expect(getOpenSession(db)?.dayTaskId).toBe(A);
  });

  it('starting B while A runs pauses A at the same instant', () => {
    const { A, B } = seed();
    startTask(A);
    t += 2 * MIN;
    startTask(B);
    expect(sessionsOf(A)[0].endedAt).toBe(t);
    expect(getOpenSession(db)?.dayTaskId).toBe(B);
  });

  it('pause then resume accumulates focus; pause with no session is a no-op', () => {
    const { B } = seed();
    pauseTask(B);
    expect(sessionsOf(B)).toEqual([]);
    startTask(B);
    t += 3 * MIN;
    pauseTask(B);
    t += 10 * MIN;
    startTask(B);
    t += 4 * MIN;
    pauseTask(B);
    const s = sessionsOf(B);
    expect(s).toHaveLength(2);
    expect(s.reduce((n, x) => n + (x.endedAt! - x.startedAt), 0)).toBe(7 * MIN);
    expect(dayTask(B).completedAt).toBeNull();
  });

  it('overtime continues until stop; stop only works when done', () => {
    const { A } = seed();
    startTask(A);
    t += 2 * MIN;
    expect(() => stopTask(A)).toThrow(ValidationError);
    t += 6 * MIN; // 8 minutes in, budget 5
    stopTask(A);
    expect(dayTask(A).completedAt).toBe(T0 + 5 * MIN);
    expect(sessionsOf(A)[0].endedAt).toBe(t);
    expect(getOpenSession(db)).toBeNull();
  });

  it('starting a done task throws a human message', () => {
    const { A } = seed();
    startTask(A);
    t += 6 * MIN;
    stopTask(A);
    expect(() => startTask(A)).toThrow('This task is done for today');
  });

  it('rejects not-timed, already-running and unknown starts', () => {
    const { A, Tick } = seed();
    expect(() => startTask(Tick)).toThrow('Only timed tasks can be started');
    startTask(A);
    expect(() => startTask(A)).toThrow('This task is already running');
    expect(() => startTask('nope')).toThrow(ValidationError);
  });

  it('toggleCheckTask ticks and unticks', () => {
    const { Tick, A } = seed();
    toggleCheckTask(Tick);
    expect(dayTask(Tick).completedAt).toBe(T0);
    t += MIN;
    toggleCheckTask(Tick);
    expect(dayTask(Tick).completedAt).toBeNull();
    expect(() => toggleCheckTask(A)).toThrow('Not a checklist task');
  });
});

describe('useToday', () => {
  it('orders rows, counts done, names removed topics and reacts to actions', async () => {
    const { Tick, A } = seed();
    const { result } = await renderHook(() => useToday());
    expect(result.current.total).toBe(3);
    expect(result.current.done).toBe(0);
    expect(result.current.rows.map((r) => r.state)).toEqual(['idle', 'idle', 'check-open']);
    await act(async () => toggleCheckTask(Tick));
    expect(result.current.done).toBe(1);
    expect(result.current.rows[2].state).toBe('check-done');
    expect(result.current.items.some((i) => i.dayTaskId === Tick)).toBe(true);
    await act(async () => startTask(A));
    expect(result.current.rows[0].state).toBe('running');
    const topicId = loadDayBundle(db, TODAY)!.dayTasks[0].topicId;
    await act(async () => removeTopic(topicId));
    expect(result.current.rows[0].topicName).toBe('Removed topic');
  });

  it('does not re-render every second', async () => {
    const { A } = seed();
    startTask(A);
    jest.useFakeTimers();
    let renders = 0;
    await renderHook(() => {
      renders++;
      return useToday();
    });
    const before = renders;
    await act(async () => {
      t += 5000;
      jest.advanceTimersByTime(5000);
    });
    expect(renders).toBe(before);
  });
});

describe('useNow', () => {
  it('ticks with the overridden clock and stops on unmount', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderHook(() => useNow(1000));
    expect(result.current).toBe(T0);
    await act(async () => {
      t += 1000;
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(T0 + 1000);
    const spy = jest.spyOn(global, 'clearInterval');
    await unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('useRunTask', () => {
  it('returns row and note, and completes the task when it hits 0 while open', async () => {
    const { A } = seed();
    setTaskNoteFromPlan(dayTask(A).taskId!, 'remember the formula');
    startTask(A);
    jest.useFakeTimers();
    const { result } = await renderHook(() => useRunTask(A));
    expect(result.current?.note).toBe('remember the formula');
    expect(result.current?.row?.state).toBe('running');
    await act(async () => {
      t += 5 * MIN;
      jest.advanceTimersByTime(5 * MIN);
    });
    expect(dayTask(A).completedAt).toBe(T0 + 5 * MIN);
    expect(result.current?.row?.state).toBe('overtime');
  });

  it('re-arms when the timer fires early (clock 1 ms short) and completes at the exact instant', async () => {
    const { A } = seed();
    startTask(A);
    jest.useFakeTimers();
    const { result } = await renderHook(() => useRunTask(A));
    await act(async () => {
      t += 5 * MIN - 1; // the timeout fires, but now() is 1 ms before the completion instant
      jest.advanceTimersByTime(5 * MIN);
    });
    expect(dayTask(A).completedAt).toBeNull();
    expect(result.current?.row?.state).toBe('running');
    await act(async () => {
      t += 30;
      jest.advanceTimersByTime(30);
    });
    expect(dayTask(A).completedAt).toBe(T0 + 5 * MIN);
    expect(result.current?.row?.state).toBe('overtime');
  });

  it('after an early fire, unmount clears the re-armed timer (no further reconcile)', async () => {
    const { A } = seed();
    startTask(A);
    jest.useFakeTimers();
    const { unmount } = await renderHook(() => useRunTask(A));
    await act(async () => {
      t += 5 * MIN - 1;
      jest.advanceTimersByTime(5 * MIN);
    });
    await unmount();
    t += MIN;
    jest.advanceTimersByTime(MIN);
    expect(dayTask(A).completedAt).toBeNull(); // nothing reconciled after unmount
  });

  it('pausing before the timer fires means no completion', async () => {
    const { A } = seed();
    startTask(A);
    jest.useFakeTimers();
    const { result } = await renderHook(() => useRunTask(A));
    await act(async () => {
      t += 2 * MIN;
      jest.advanceTimersByTime(2 * MIN);
      pauseTask(A);
    });
    expect(result.current?.row?.state).not.toBe('running');
    await act(async () => {
      t += 10 * MIN;
      jest.advanceTimersByTime(10 * MIN);
    });
    expect(dayTask(A).completedAt).toBeNull();
  });

  it('is null for an unknown id', async () => {
    seed();
    const { result } = await renderHook(() => useRunTask('missing'));
    expect(result.current).toBeNull();
  });
});
