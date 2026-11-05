import { act, renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { getMomentMarkers, getMomentsEnabled, setMomentMarkers } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask } from '../actions/run';
import { setMomentsEnabled } from '../actions/settings';
import { setClockOverride } from '../clock';
import { useMomentsEnabled } from '../hooks/useMomentsEnabled';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
const T0 = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(() => teardownState());

describe('setMomentsEnabled', () => {
  it('is on by default, persists, and leaves the markers untouched', () => {
    const markers = { bestMs: 5000, streakCelebrated: 3, streakEndDayKey: '2026-10-28', weekCelebrated: '2026-10-26', monthCelebrated: '2026-09' };
    setMomentMarkers(db, markers, T0);
    expect(getMomentsEnabled(db)).toBe(true);
    setMomentsEnabled(false);
    expect(getMomentsEnabled(db)).toBe(false);
    setMomentsEnabled(true);
    expect(getMomentsEnabled(db)).toBe(true);
    expect(getMomentMarkers(db)).toEqual(markers);
  });

  it('useMomentsEnabled re-reads after a change', async () => {
    const { result } = await renderHook(() => useMomentsEnabled());
    expect(result.current).toBe(true);
    await act(async () => setMomentsEnabled(false));
    expect(result.current).toBe(false);
  });
});

describe('closing with moments off, then on', () => {
  /** Runs the one timed task for 10 minutes on the current day and closes it by hand. */
  function closeDay(dayKey: string) {
    reconcile();
    const id = loadDayBundle(db, dayKey)!.dayTasks.find((d) => d.name === 'A')!.id;
    startTask(id);
    t += 10 * MIN;
    return closeToday({});
  }

  it('off: a close by hand returns [] and saves no marker; on again: the next qualifying close plays', () => {
    const topic = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(topic.id, { name: 'A', kind: 'timed', minutes: 5, repeatMask: 127, isDefault: true });
    const before = getMomentMarkers(db);

    setMomentsEnabled(false);
    expect(closeDay('2026-10-29')).toEqual([]);
    expect(getMomentMarkers(db)).toEqual(before);

    setMomentsEnabled(true);
    t = dayStartOf('2026-10-30', 4) + 6 * 3_600_000;
    const moments = closeDay('2026-10-30');
    expect(moments.map((m) => m.kind)).toContain('longest');
  });
});
