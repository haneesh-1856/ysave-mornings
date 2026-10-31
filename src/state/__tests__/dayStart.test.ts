import { act, renderHook } from '@testing-library/react-native';
import { getDay, loadDayBundle } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayEndOf, dayStartOf } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import { createTask, createTopic } from '../actions/library';
import { confirmDayPlan } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { setDayStart } from '../actions/settings';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { useDayStart } from '../hooks/useDayStart';
import { useToday } from '../hooks/useToday';
import { setupState, teardownState } from '../testSupport';
import { todayEnd, todayKey } from '../today';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const D0 = '2026-10-29';
const D1 = '2026-10-30';
const D2 = '2026-10-31';
const HOUR = 3_600_000;
const EVENING = dayStartOf(D0, 4) + 18 * HOUR; // 22:00 on D0

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(EVENING);
  t = EVENING;
  setClockOverride(() => t);
  const topic = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(topic.id, { name: 'Read', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile(); // today's row, snapshot 4
});
afterEach(() => teardownState());

/** Plans tomorrow so D1 already has a row (snapshot 4) when the hour changes. */
function planTomorrow() {
  const draft = buildPlan({ dayKey: D1, topics: listTopics(db), tasks: listTasks(db), day: null, dayTasks: [] });
  confirmDayPlan(D1, draft);
}

const at = (key: string, hour: number, min = 0) => dayStartOf(key, hour) + min * 60_000;

describe.each([
  { from: 4, to: 6 },
  { from: 4, to: 2 },
])('setDayStart $from -> $to in the evening', ({ to }) => {
  it('keeps today, closes it at the old hour, gives tomorrow the new hour, and the day after begins at the new hour', () => {
    planTomorrow();
    expect(getDay(db, D1)?.dayStartHour).toBe(4);

    setDayStart(to);
    expect(getDayStartHour(db)).toBe(to);
    expect(todayKey(db, t)).toBe(D0);
    expect(getDay(db, D0)?.dayStartHour).toBe(4);
    expect(getDay(db, D1)?.dayStartHour).toBe(to);
    expect(todayEnd(db, t)).toBe(dayEndOf(D0, 4));

    // Just before the OLD boundary: still D0, not closed.
    t = at(D1, 4) - 1;
    expect(todayKey(db, t)).toBe(D0);
    reconcile();
    expect(getDay(db, D0)?.closedAt).toBeNull();

    // At the old boundary: D0 auto-closes at 04:00, D1 is today and ends at the new hour.
    t = at(D1, 4);
    expect(todayKey(db, t)).toBe(D1);
    reconcile();
    expect(getDay(db, D0)).toMatchObject({ closedAt: at(D1, 4), closedBy: 'auto' });
    expect(loadDayBundle(db, D1)?.day.dayStartHour).toBe(to);
    expect(todayEnd(db, t)).toBe(dayEndOf(D1, to));

    // The day after (created later) snapshots the new hour and begins at it.
    t = at(D2, to) - 1;
    expect(todayKey(db, t)).toBe(D1);
    t = at(D2, to);
    expect(todayKey(db, t)).toBe(D2);
    reconcile();
    expect(getDay(db, D1)).toMatchObject({ closedAt: at(D2, to) });
    expect(getDay(db, D2)?.dayStartHour).toBe(to);
  });

  it('works the same when tomorrow has no row yet', () => {
    setDayStart(to);
    expect(todayKey(db, t)).toBe(D0);
    t = at(D1, 4);
    reconcile();
    expect(getDay(db, D0)?.closedAt).toBe(at(D1, 4));
    expect(getDay(db, D1)?.dayStartHour).toBe(to);
  });
});

// Fix (Opus): yesterday (D1) has no row; today (D2) was created under the old hour; the change lands between the hours.
describe.each([
  { before: 4, to: 6, changeAt: 5.5 },
  { before: 2, to: 4, changeAt: 3.5 },
  { before: 4, to: 2, changeAt: 5.5 },
])('setDayStart $before -> $to with no row for yesterday', ({ before, to, changeAt }) => {
  it('keeps today, its row and its end; never creates a row for yesterday', () => {
    if (before !== 4) setDayStart(before); // in D0's evening; D0 keeps 4
    t = at(D2, before) + 30 * 60_000; // D1 never opened
    expect(todayKey(db, t)).toBe(D2);
    reconcile();
    expect(getDay(db, D2)?.dayStartHour).toBe(before);
    expect(getDay(db, D1)).toBeNull();

    t = dayStartOf(D2, 0) + changeAt * HOUR;
    setDayStart(to);
    expect(todayKey(db, t)).toBe(D2);
    expect(getDay(db, D2)?.dayStartHour).toBe(before);
    expect(todayEnd(db, t)).toBe(dayEndOf(D2, before));
    reconcile();
    expect(getDay(db, D1)).toBeNull();
    expect(getDay(db, D2)?.closedAt).toBeNull();

    const D3 = '2026-11-01';
    t = dayEndOf(D2, before) - 1;
    expect(todayKey(db, t)).toBe(D2);
    t = dayEndOf(D2, before);
    expect(todayKey(db, t)).toBe(D3);
    reconcile();
    expect(getDay(db, D2)).toMatchObject({ closedAt: dayEndOf(D2, before), closedBy: 'auto' });
    expect(getDay(db, D3)?.dayStartHour).toBe(to);
  });
});

describe('setDayStart validation and hooks', () => {
  it('uses one clock reading for reconcile and the writes', () => {
    let calls = 0;
    setClockOverride(() => {
      calls += 1;
      return t + calls; // advances on every read
    });
    setDayStart(6);
    expect(calls).toBe(1);
  });

  it('rejects hours outside 0-23 and changes nothing', () => {
    for (const h of [-1, 24, 3.5]) expect(() => setDayStart(h)).toThrow(ValidationError);
    expect(getDayStartHour(db)).toBe(4);
  });

  it('useDayStart reports the setting and the real end of today, and updates after a change', async () => {
    const { result } = await renderHook(() => useDayStart());
    expect(result.current).toEqual({ hour: 4, todayEndsAt: dayEndOf(D0, 4) });
    await act(async () => setDayStart(6));
    expect(result.current).toEqual({ hour: 6, todayEndsAt: dayEndOf(D0, 4) });
  });

  it('useToday keeps today after the change', async () => {
    const { result } = await renderHook(() => useToday());
    await act(async () => setDayStart(6));
    expect(result.current.todayKey).toBe(D0);
    t = at(D1, 5);
    const again = await renderHook(() => useToday());
    expect(again.result.current.todayKey).toBe(D1);
  });
});
