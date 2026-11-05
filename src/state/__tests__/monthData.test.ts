import { loadDayBundle } from '../../data/repos/days';
import { getMomentMarkers, setMonthlyGoalHours } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { focusedMs } from '../../domain/timer';
import type { Moment } from '../../domain/moments';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * 3_600_000;

let db: DB;
let t: number;

/** Fresh app whose first open is `day` 06:00; tasks A (timed, 30 min budget) and C (check) every day. */
function begin(day: string) {
  db = setupState(at(day));
  t = at(day);
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
}
afterEach(() => teardownState());

const row = (day: string, name: string) => loadDayBundle(db, day)!.dayTasks.find((d) => d.name === name)!.id;
/** Opens the app on `day` at 06:00 (reconcile fills the plan and auto-closes earlier days). */
function open(day: string) {
  t = at(day);
  reconcile();
}
/** A runs `min` minutes and stays running (the close ends it at the close instant). */
function run(day: string, min: number) {
  startTask(row(day, 'A'));
  t += min * MIN;
}
const tick = (day: string) => toggleCheckTask(row(day, 'C'));
const month = (ms: Moment[]) => ms.find((m) => m.kind === 'month');
const zeros = (n: number) => Array.from({ length: n }, () => 0);

describe('month moment: data traced from a real month', () => {
  it('goal month: reached mid-month plays once with dailyMs for the 1st..that day; a later close plays nothing', () => {
    begin('2026-10-01');
    setMonthlyGoalHours(db, 2, t); // 120 min

    // Oct 1: A 20 min (budget 30, not done), C ticked -> shows up. Focus 20. Total 20 < 120.
    run('2026-10-01', 20);
    tick('2026-10-01');
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Oct 5: checklist-only day. C ticked, 0 focus, shows up. Oct 2..4 have no focus (Oct 2 row exists, empty).
    open('2026-10-05');
    tick('2026-10-05');
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Oct 8: A runs 50 min; reconcile at the close completes A at 30 min, the session ends at the close:
    //   focus 50, A done -> shows up. Total 70 < 120.
    open('2026-10-08');
    run('2026-10-08', 50);
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Oct 12: A 60 min. Total 20 + 0 + 50 + 60 = 130 min >= 120: the goal is reached, the moment plays.
    // dailyMs has 12 entries (Oct 1..12): idx0 = 20, idx4 = 0 (Oct 5), idx7 = 50 (Oct 8), idx11 = 60, others 0.
    // daysShowedUp = Oct 1, 5, 8, 12 = 4 (the rows the closes created for Oct 2, 6, 9, 13 have no item).
    open('2026-10-12');
    run('2026-10-12', 60);
    const played = month(closeToday(letGoAll()));
    const dailyMs = zeros(12);
    dailyMs[0] = 20 * MIN;
    dailyMs[7] = 50 * MIN;
    dailyMs[11] = 60 * MIN;
    expect(played).toEqual({
      kind: 'month',
      monthKey: '2026-10',
      monthFocusMs: 130 * MIN,
      goalHours: 2,
      daysShowedUp: 4,
      dailyMs,
    });
    expect(getMomentMarkers(db).monthCelebrated).toBe('2026-10');

    // Oct 13: another 30 min closes, the month is already celebrated: nothing.
    open('2026-10-13');
    run('2026-10-13', 30);
    expect(month(closeToday(letGoAll()))).toBeUndefined();
  });

  it('no-goal October closed on its last day: month in review with 31 entries, gaps 0, a running session counted', () => {
    begin('2026-10-10');
    // Oct 10: A 25 min (not done), C ticked -> shows up. Focus 25.
    run('2026-10-10', 25);
    tick('2026-10-10');
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Oct 20: checklist-only, C ticked. Focus 0, shows up.
    open('2026-10-20');
    tick('2026-10-20');
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Oct 31 (the last day, no goal): A runs 10 min and is still running at the close (counted up to it, 10 min
    // < budget so not done), C ticked -> shows up. Total 25 + 0 + 10 = 35 min.
    // dailyMs, 31 entries: idx9 = 25 (Oct 10), idx19 = 0 (Oct 20), idx30 = 10 (Oct 31); gaps 0.
    // daysShowedUp = Oct 10, 20, 31 = 3.
    open('2026-10-31');
    run('2026-10-31', 10);
    tick('2026-10-31');
    const played = month(closeToday(letGoAll())) as Extract<Moment, { kind: 'month' }>;
    const dailyMs = zeros(31);
    dailyMs[9] = 25 * MIN;
    dailyMs[30] = 10 * MIN;
    expect(played.dailyMs).toHaveLength(31);
    expect(played).toEqual({
      kind: 'month',
      monthKey: '2026-10',
      monthFocusMs: 35 * MIN,
      goalHours: null,
      daysShowedUp: 3,
      dailyMs,
    });
    expect(played.dailyMs.reduce((a, v) => a + v, 0)).toBe(played.monthFocusMs);
  });

  it('no-goal November across the DST day 2026-11-01: 30 entries, October focus never leaks in', () => {
    begin('2026-10-31');
    // Oct 31: A starts at 20 h after the day start = Nov 1 00:00 EDT and is left running; the app is closed.
    t = at('2026-10-31', 20);
    startTask(row('2026-10-31', 'A'));

    // Nov 1 06:00 (the clocks went back at 02:00): reconcile auto-closes Oct 31 at Nov 1 04:00 EST. That session
    // (300 real minutes) belongs to October. Nov 1: A runs 12 min and is still running at the close, C ticked.
    //   focus 12, shows up.
    open('2026-11-01');
    run('2026-11-01', 12);
    tick('2026-11-01');
    // October keeps those 300 min: Oct 31's sessions (October's dailyMs[30]) add up to exactly 300 min.
    const oct31 = loadDayBundle(db, '2026-10-31')!;
    expect(Object.values(oct31.sessionsByDayTask).reduce((sum, ss) => sum + focusedMs(ss, t), 0)).toBe(300 * MIN);
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Nov 15: A runs 45 min; reconcile at the close completes A at 30 min, session ends at the close: focus 45,
    // A done -> shows up.
    open('2026-11-15');
    run('2026-11-15', 45);
    expect(month(closeToday(letGoAll()))).toBeUndefined();

    // Nov 30 (the last day): A 10 min, C ticked -> shows up. Total 12 + 45 + 10 = 67 min.
    // dailyMs, 30 entries: idx0 = 12 (Nov 1, the DST day), idx14 = 45 (Nov 15), idx29 = 10 (Nov 30).
    // daysShowedUp = Nov 1, 15, 30 = 3. The 300 min of Oct 31 are not in it.
    open('2026-11-30');
    run('2026-11-30', 10);
    tick('2026-11-30');
    const played = month(closeToday(letGoAll())) as Extract<Moment, { kind: 'month' }>;
    const dailyMs = zeros(30);
    dailyMs[0] = 12 * MIN;
    dailyMs[14] = 45 * MIN;
    dailyMs[29] = 10 * MIN;
    expect(played).toEqual({
      kind: 'month',
      monthKey: '2026-11',
      monthFocusMs: 67 * MIN,
      goalHours: null,
      daysShowedUp: 3,
      dailyMs,
    });
  });
});
