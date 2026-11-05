import { loadDayBundle } from '../../data/repos/days';
import { getMomentMarkers } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
// The week Monday 2026-10-26 .. Sunday 2026-11-01 (day start hour 4). Sunday is also the day the clocks go back.
const MON = '2026-10-26';
const TUE = '2026-10-27';
const WED = '2026-10-28';
const THU = '2026-10-29';
const FRI = '2026-10-30';
const SAT = '2026-10-31';
const SUN = '2026-11-01';
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(at(MON));
  t = at(MON);
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
});
afterEach(() => teardownState());

/** The id of the day's row for the task called `name`. */
function row(day: string, name: string): string {
  return loadDayBundle(db, day)!.dayTasks.find((d) => d.name === name)!.id;
}

describe('week moment: data traced from a real week', () => {
  it('every field of the Sunday week moment matches the week as it was lived', () => {
    // MON 06:00: A runs 20 min (budget 30, not done), C ticked, closed by hand at 06:20.
    //   focus 20 min; done = C (1); shows up. The close also creates TUE's row.
    startTask(row(MON, 'A'));
    t += 20 * MIN;
    toggleCheckTask(row(MON, 'C'));
    closeToday(letGoAll());

    // TUE 06:00: reconcile fills the plan. Only C is ticked (checklist-only day: shows up, 0 focus).
    //   Never closed by hand; the app is not opened again until THU, so reconcile auto-closes it.
    t = at(TUE);
    reconcile();
    toggleCheckTask(row(TUE, 'C'));

    // WED: the app is not opened. TUE was not closed by hand (that would create WED's row) and nothing
    // reconciles on WED, so no days row exists for WED. focus 0, does not show up.

    // THU 06:00: reconcile auto-closes TUE (at WED 04:00) and creates THU. A starts at 06:00, reaches its 30 min
    //   budget at 06:30 (reconcile at 06:31 sets completedAt), stopped at 06:32: focus 32 min, overtime 2 min
    //   (>= 60 s) = gold ring. Done = A (1). C unticked, let go at the by-hand close at 06:32.
    t = at(THU);
    expect(reconcile().autoClosed).toEqual([TUE]);
    expect(loadDayBundle(db, WED)).toBeNull();
    startTask(row(THU, 'A'));
    t += 31 * MIN;
    reconcile();
    t += 1 * MIN;
    stopTask(row(THU, 'A'));
    closeToday(letGoAll());

    // FRI 06:00: A runs 10 min, pause 5 min, runs 5 min more: two sessions, focus 15 min, A not done (15 < 30),
    //   C not ticked: nothing in the collection, so FRI does not show up (focus without a finished task).
    t = at(FRI);
    reconcile();
    startTask(row(FRI, 'A'));
    t += 10 * MIN;
    pauseTask(row(FRI, 'A'));
    t += 5 * MIN;
    startTask(row(FRI, 'A'));
    t += 5 * MIN;
    pauseTask(row(FRI, 'A'));
    closeToday(letGoAll());

    // SAT 06:00 reconcile fills the plan; A starts 20 h after SAT's day start (04:00 EDT) = SUN 00:00 EDT (the `at`
    //   helper adds real hours), and the app is closed. Auto-closed by the reconcile on SUN 06:00 at SUN 04:00.
    //   The clocks go back at 02:00 that night, so SUN 00:00 EDT -> 04:00 EST is 4 wall hours + 1 repeated hour
    //   = 5 real hours = 300 min (04:00Z start, 09:00Z auto-close). A passes its 30 min budget (done), overtime 270 min = gold ring.
    t = at(SAT);
    reconcile();
    t = at(SAT, 20);
    startTask(row(SAT, 'A'));

    // SUN 06:00: reconcile auto-closes SAT and creates SUN. A runs 12 min and is still running at the by-hand
    //   close (the close ends it at 06:12): focus 12 min, not done. C ticked: done = C (1), shows up.
    t = at(SUN);
    expect(reconcile().autoClosed).toEqual([SAT]);
    startTask(row(SUN, 'A'));
    t += 12 * MIN;
    toggleCheckTask(row(SUN, 'C'));
    const moments = closeToday(letGoAll());

    expect(loadDayBundle(db, SAT)!.day.closedBy).toBe('auto');
    expect(loadDayBundle(db, TUE)!.day.closedBy).toBe('auto');
    expect(loadDayBundle(db, SUN)!.day.closedBy).toBe('user');

    const week = moments.find((m) => m.kind === 'week');
    // weekStart: 2026-10-26 is a Monday, SUN is 6 days later.
    // tasksDone: MON 1 + TUE 1 + WED 0 + THU 1 + FRI 0 + SAT 1 + SUN 1 = 5.
    // focusedMs: 20 + 0 + 0 + 32 + 15 + 300 + 12 = 379 min.
    // goldRings: THU (overtime 2 min) + SAT (270 min) = 2. No other timed task passed its budget.
    // daysShowedUp: MON, TUE, THU, SAT, SUN = 5 (WED has no row, FRI has no finished task).
    // dailyMs (Mon..Sun): 20, 0, 0, 32, 15, 300, 12 min; sums to 379.
    expect(week).toEqual({
      kind: 'week',
      weekStart: MON,
      tasksDone: 5,
      focusedMs: 379 * MIN,
      goldRings: 2,
      daysShowedUp: 5,
      dailyMs: [20 * MIN, 0, 0, 32 * MIN, 15 * MIN, 300 * MIN, 12 * MIN],
    });
    expect(getMomentMarkers(db).weekCelebrated).toBe(MON);
  });
});
