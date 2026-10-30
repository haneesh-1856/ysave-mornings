import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { listDays, loadDayBundle } from '../../data/repos/days';
import type { DB } from '../../data/types';
import { dayEndOf, dayStartOf } from '../../domain/dayKey';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { setClockOverride } from '../clock';
import { useDayBoundary } from '../hooks/useDayBoundary';
import { markMorningSeen, useMorning } from '../hooks/useMorning';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const D1 = '2026-10-29';
const D2 = '2026-10-30';
const T0 = dayStartOf(D1, 4) + 6 * 3_600_000; // 10:00 on D1
const HOUR = 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  teardownState();
});

function seed() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
}

describe('useMorning', () => {
  it('is not due on first-ever use, is due on a new day, and shows once per day', async () => {
    seed();
    reconcile(); // first day row only
    const first = await renderHook(() => useMorning());
    expect(first.result.current.due).toBe(false);
    expect(first.result.current.dayNumber).toBe(1);

    t = dayStartOf(D2, 4) + 2 * HOUR;
    reconcile();
    const view = await renderHook(() => useMorning());
    expect(view.result.current.due).toBe(true);
    expect(view.result.current.todayKey).toBe(D2);
    expect(view.result.current.dayNumber).toBe(2);
    expect(view.result.current.plannedToday).toBe(false);

    await act(async () => markMorningSeen());
    expect(view.result.current.due).toBe(false);

    t = dayStartOf('2026-10-31', 4) + HOUR;
    reconcile();
    const next = await renderHook(() => useMorning());
    expect(next.result.current.due).toBe(true);
    expect(next.result.current.dayNumber).toBe(3);
  });
});

describe('useDayBoundary', () => {
  function mockAppState() {
    const remove = jest.fn();
    let handler: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    return { remove, fire: (s: string) => handler!(s) };
  }

  /** Moves the clock and the fake timers together in 1 h slices until just before `target`. */
  function walkTo(target: number) {
    while (t + HOUR < target) {
      t += HOUR;
      jest.advanceTimersByTime(HOUR);
    }
  }

  it('reconciles at the boundary: yesterday auto-closed, today prefilled, then re-arms', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    mockAppState();
    seed();
    reconcile();
    const { unmount } = await renderHook(() => useDayBoundary());
    const end = dayEndOf(D1, 4);

    walkTo(end);
    expect(loadDayBundle(db, D1)!.day.closedAt).toBeNull();
    expect(loadDayBundle(db, D2)).toBeNull();

    t = end + 300;
    jest.advanceTimersByTime(HOUR);
    const y = loadDayBundle(db, D1)!;
    expect(y.day.closedBy).toBe('auto');
    expect(y.day.closedAt).toBe(end);
    expect(
      loadDayBundle(db, D2)!
        .dayTasks.map((d) => d.name)
        .sort(),
    ).toEqual(['A', 'C']);

    // Re-armed: the next boundary fires again.
    const end2 = dayEndOf(D2, 4);
    walkTo(end2);
    t = end2 + 300;
    jest.advanceTimersByTime(HOUR);
    expect(loadDayBundle(db, D2)!.day.closedBy).toBe('auto');
    expect(listDays(db, '2026-10-31', '2026-10-31')).toHaveLength(1);

    await unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('re-arms when the app returns to active and cleans up on unmount', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const app = mockAppState();
    seed();
    reconcile();
    const { unmount } = await renderHook(() => useDayBoundary());
    expect(jest.getTimerCount()).toBe(1);
    app.fire('active');
    expect(jest.getTimerCount()).toBe(1); // replaced, not duplicated
    await unmount();
    expect(jest.getTimerCount()).toBe(0);
    expect(app.remove).toHaveBeenCalledTimes(1);
  });
});
