import { loadDayBundle } from '../../data/repos/days';
import { getMomentMarkers } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { addDays, dayStartOf } from '../../domain/dayKey';
import { streakWeekdays, type Moment } from '../../domain/moments';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { computeMomentsAfterClose } from '../moments';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
// Monday 2026-10-26 (weekday 0). Sunday 2026-11-01 is the day the clocks go back (US), so every run below crosses it.
const MON = '2026-10-26';
const SUN = '2026-11-01';
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * 3_600_000;
const day = (n: number) => addDays(MON, n); // n = 0 is Monday 10-26

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

function row(d: string, name: string): string {
  return loadDayBundle(db, d)!.dayTasks.find((x) => x.name === name)!.id;
}

/**
 * Live day `d` at 06:00 (reconcile fills the plan), then do one thing: 'A' runs the timed task past its 30 min
 * budget (done), 'C' only ticks the check (a checklist-only day), 'none' opens the app and does nothing.
 */
function live(d: string, what: 'A' | 'C' | 'none') {
  t = at(d);
  reconcile();
  if (what === 'A') {
    startTask(row(d, 'A'));
    t += 31 * MIN;
    reconcile();
    t += 1 * MIN;
    stopTask(row(d, 'A'));
  } else if (what === 'C') {
    toggleCheckTask(row(d, 'C'));
  }
}
type Streak = Extract<Moment, { kind: 'streak' }>;
const streaksOf = (ms: Moment[]) => ms.filter((m): m is Streak => m.kind === 'streak');
/** Live day `d` and close it by hand; returns the streak moments of that close. */
function closed(d: string, what: 'A' | 'C' | 'none'): Streak[] {
  live(d, what);
  return streaksOf(closeToday(letGoAll()));
}

describe('streak moment: data traced from real days', () => {
  it('seven days in a row (some checklist-only) plays exactly one streak on day 7', () => {
    // Mon 26 A, Tue 27 C only, Wed 28 A, Thu 29 C only, Fri 30 A, all closed by hand: runs 1..5, no moment.
    expect(closed(day(0), 'A')).toEqual([]);
    expect(closed(day(1), 'C')).toEqual([]);
    expect(closed(day(2), 'A')).toEqual([]);
    expect(closed(day(3), 'C')).toEqual([]);
    expect(closed(day(4), 'A')).toEqual([]);
    // Sat 31 C only, never closed by hand: the reconcile on Sun 06:00 auto-closes it at Sun 04:00 local (after the clocks
    //   went back at 02:00 that night). It still counts: run 6.
    live(day(5), 'C');
    // Sun 11-01 A, closed by hand: run = Mon..Sun = 7, 7 % 7 = 0, markers empty -> one streak moment.
    const streaks = closed(day(6), 'A');
    expect(loadDayBundle(db, day(5))!.day.closedBy).toBe('auto');
    expect(streaks).toEqual([{ kind: 'streak', days: 7, endDayKey: SUN }]);
    // 2026-10-26 is a Monday; Mon..Sun = weekdays 0..6.
    expect(streakWeekdays(streaks[0])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(getMomentMarkers(db)).toMatchObject({ streakCelebrated: 7, streakEndDayKey: SUN });
  });

  it('day 6 closed plays nothing', () => {
    // Mon..Sat = 6 days, run 6: no moment on any of the six closes.
    for (let i = 0; i < 6; i++) expect(closed(day(i), i % 2 ? 'C' : 'A')).toEqual([]);
    expect(getMomentMarkers(db).streakCelebrated).toBe(0);
    expect(getMomentMarkers(db).streakEndDayKey).toBeNull();
  });

  it('a day with no item breaks the run: counting restarts from 1', () => {
    // Mon 26, Tue 27, Wed 28 count (run 3). Thu 29 opened but nothing done: 0 items, closed by hand, run 0.
    for (let i = 0; i < 3; i++) expect(closed(day(i), 'A')).toEqual([]);
    expect(closed(day(3), 'none')).toEqual([]);
    // Fri 30: the app is not opened. Thu's close made its row, nothing reconciles, so it stays empty (0 items).
    // Sat 10-31 .. Thu 11-05 = 6 counting days (restart at 1 on Sat): no moment.
    for (let i = 5; i < 11; i++) expect(closed(day(i), i % 2 ? 'C' : 'A')).toEqual([]);
    expect(loadDayBundle(db, day(4))!.day.closedBy).toBe('auto'); // auto-closed by the reconcile on Sat
    // Fri 11-06 (day 11) is run 7 (an unbroken count from Mon would be 10 counting days, no multiple of 7).
    const streaks = closed(day(11), 'A');
    expect(streaks).toEqual([{ kind: 'streak', days: 7, endDayKey: '2026-11-06' }]);
    // 11-06 is a Friday (4): Sat..Fri = 5, 6, 0, 1, 2, 3, 4.
    expect(streakWeekdays(streaks[0])).toEqual([5, 6, 0, 1, 2, 3, 4]);
  });

  it('day 7 does not play twice, and day 14 plays days 14', () => {
    for (let i = 0; i < 6; i++) closed(day(i), i % 2 ? 'C' : 'A');
    expect(closed(day(6), 'A')).toEqual([{ kind: 'streak', days: 7, endDayKey: SUN }]);
    // A hand close cannot be repeated (closeToday throws on a closed day), so compute the moments for the same day
    // again: the markers say 7 already played ending Sun 11-01, so nothing plays.
    expect(streaksOf(computeMomentsAfterClose(SUN, t))).toEqual([]);
    // Days 8..13 (Mon 11-02 .. Sat 11-07): run 8..13, no multiple of 7.
    for (let i = 7; i < 13; i++) expect(closed(day(i), i % 2 ? 'C' : 'A')).toEqual([]);
    // Day 14 = Sun 2026-11-08: run 14. runStart 10-26; marker end 11-01 >= runStart but celebrated 7 < 14: plays.
    const streaks = closed(day(13), 'A');
    expect(streaks).toEqual([{ kind: 'streak', days: 14, endDayKey: '2026-11-08' }]);
    // 11-08 is a Sunday (6): Mon..Sun twice.
    expect(streakWeekdays(streaks[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6]);
  });
});
