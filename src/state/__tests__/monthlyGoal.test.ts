import { act, renderHook } from '@testing-library/react-native';
import { getMonthlyGoalHours, getMomentMarkers, setMomentMarkers } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { setMonthlyGoal } from '../actions/settings';
import { ValidationError } from '../errors';
import { useMonthlyGoal } from '../hooks/useMonthlyGoal';
import { setupState, teardownState } from '../testSupport';

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
let db: DB;
beforeEach(() => { db = setupState(NOW); });
afterEach(() => teardownState());

describe('setMonthlyGoal', () => {
  it('persists a whole-hour goal and clears it with null', () => {
    expect(getMonthlyGoalHours(db)).toBeNull();
    setMonthlyGoal(40);
    expect(getMonthlyGoalHours(db)).toBe(40);
    setMonthlyGoal(744);
    expect(getMonthlyGoalHours(db)).toBe(744);
    setMonthlyGoal(1);
    expect(getMonthlyGoalHours(db)).toBe(1);
    setMonthlyGoal(null);
    expect(getMonthlyGoalHours(db)).toBeNull();
  });

  it('rejects anything but an integer 1-744 and changes nothing', () => {
    setMonthlyGoal(20);
    for (const h of [0, -5, 745, 2.5, NaN, Infinity]) expect(() => setMonthlyGoal(h)).toThrow(ValidationError);
    expect(getMonthlyGoalHours(db)).toBe(20);
  });

  it('leaves the moment markers untouched', () => {
    const markers = { bestMs: 5000, streakCelebrated: 3, streakEndDayKey: '2026-10-28', weekCelebrated: '2026-10-26', monthCelebrated: '2026-09' };
    setMomentMarkers(db, markers, NOW);
    setMonthlyGoal(60);
    setMonthlyGoal(null);
    expect(getMomentMarkers(db)).toEqual(markers);
  });
});

describe('useMonthlyGoal', () => {
  it('re-reads after a change', async () => {
    const { result } = await renderHook(() => useMonthlyGoal());
    expect(result.current).toBeNull();
    await act(async () => setMonthlyGoal(40));
    expect(result.current).toBe(40);
    await act(async () => setMonthlyGoal(null));
    expect(result.current).toBeNull();
  });
});
