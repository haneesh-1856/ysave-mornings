import { renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { getMomentMarkers, setMomentsEnabled, setMonthlyGoalHours } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { DEFAULT_MARKERS, MOMENT_ORDER, type Moment } from '../../domain/moments';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { useCalendarMonth, type CalendarCell } from '../hooks/useCalendarMonth';
import { useDayCard } from '../hooks/useDayCard';
import { useProfileStats } from '../hooks/useProfileStats';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
const HOUR = 3_600_000;
// at(day, h): h REAL hours after the day's 04:00 start.
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * HOUR;

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
/** A starts and runs `min` minutes; it stays running (the close ends it at the close instant). */
function run(day: string, min: number) {
  startTask(row(day, 'A'));
  t += min * MIN;
}
const tick = (day: string) => toggleCheckTask(row(day, 'C'));
const kinds = (ms: Moment[]) => ms.map((m) => m.kind);
const zeros = (n: number) => Array.from({ length: n }, () => 0);

describe('moments end to end', () => {
  it('one close by hand on a Sunday returns all six moments in MOMENT_ORDER, every field worked by hand', async () => {
    // Fourteen live days Mon 2026-10-12 .. Sun 2026-10-25 (no DST change in October). Every day: A (budget 30 min)
    // runs the minutes below and C is ticked, then the day is closed by hand. A reaches its budget every day, so
    // both tasks are done each day (2 items, the day shows up).
    //   Oct 12 Mon 40   Oct 13 Tue 35   Oct 14 Wed 60   Oct 15 Thu 45   Oct 16 Fri 90   Oct 17 Sat 40   Oct 18 Sun 50
    //   Oct 19 Mon 70   Oct 20 Tue 150  Oct 21 Wed 80   Oct 22 Thu 30   Oct 23 Fri 100  Oct 24 Sat 120  Oct 25 Sun 200
    // The monthly goal is 18 h (1080 min), set at the start; the total before Sunday is 910 min, so it is only
    // crossed on Sunday and no earlier close plays the month.
    // The earlier closes do play some moments: best on Oct 14, 16 and 20 (new highs 60, 90, 150), and streak 7 and
    // week (Mon Oct 12) on Sun Oct 18. So before Sunday markers.bestMs is 150 and the streak marker is 7 (ending Oct 18).
    begin('2026-10-12');
    setMonthlyGoalHours(db, 18, t);
    const minutes: Record<string, number> = {
      '2026-10-12': 40,
      '2026-10-13': 35,
      '2026-10-14': 60,
      '2026-10-15': 45,
      '2026-10-16': 90,
      '2026-10-17': 40,
      '2026-10-18': 50,
      '2026-10-19': 70,
      '2026-10-20': 150,
      '2026-10-21': 80,
      '2026-10-22': 30,
      '2026-10-23': 100,
      '2026-10-24': 120,
    };
    for (const [day, min] of Object.entries(minutes)) {
      open(day);
      run(day, min);
      tick(day);
      expect(kinds(closeToday(letGoAll()))).not.toContain('month'); // the goal is not reached before Sunday
    }
    expect(getMomentMarkers(db)).toMatchObject({ bestMs: 150 * MIN, streakCelebrated: 7, streakEndDayKey: '2026-10-18' });

    // Sunday Oct 25: A runs 200 min and is still running at the close (06:00 + 200 min = 09:20); C ticked.
    open('2026-10-25');
    run('2026-10-25', 200);
    tick('2026-10-25');
    const closedAt = t;
    const moments = closeToday(letGoAll());

    expect(kinds(moments)).toEqual([...MOMENT_ORDER]);
    const [longest, day, best, streak, week, month] = moments;

    // longest: A, the only timed task with focus, 200 min; colorKey study; budget 30 min = 1800 s.
    expect(longest).toEqual({ kind: 'longest', name: 'A', colorKey: 'study', focusedMs: 200 * MIN, budgetSec: 1800 });
    // day: A done (reconcile at the close finishes it at 30 min) and C ticked = 2 of 2; focus 200 min; closedAt = the close.
    expect(day).toEqual({ kind: 'day', done: 2, total: 2, focusedMs: 200 * MIN, closedAt });
    // best: today 200 beats the earlier best 150 (Tue Oct 20). recentMs = the 13 days before today, Oct 12..Oct 24,
    // oldest first: 40, 35, 60, 45, 90, 40, 50, 70, 150, 80, 30, 100, 120 (index 12 = yesterday).
    expect(best).toEqual({
      kind: 'best',
      todayMs: 200 * MIN,
      previousBestMs: 150 * MIN,
      recentMs: [40, 35, 60, 45, 90, 40, 50, 70, 150, 80, 30, 100, 120].map((m) => m * MIN),
    });
    // streak: Oct 12..Oct 25 all have an item = 14 days, 14 % 7 == 0. (Day 7, Oct 18, was celebrated at 7; 7 < 14.)
    expect(streak).toEqual({ kind: 'streak', days: 14, endDayKey: '2026-10-25' });
    // week: Monday Oct 19 .. Sunday Oct 25. tasksDone 7 days x 2 = 14. focus 70+150+80+30+100+120+200 = 750 min.
    // goldRings: every day but Thu Oct 22 (exactly 30 min, no overtime) has >= 60 s overtime = 6. daysShowedUp 7.
    expect(week).toEqual({
      kind: 'week',
      weekStart: '2026-10-19',
      tasksDone: 14,
      focusedMs: 750 * MIN,
      goldRings: 6,
      daysShowedUp: 7,
      dailyMs: [70, 150, 80, 30, 100, 120, 200].map((m) => m * MIN),
    });
    // month: October up to Oct 25 (25 entries, index 0 = the 1st). Oct 1..11 have no rows = 0.
    // Week 1 (Oct 12..18): 40+35+60+45+90+40+50 = 360. Week 2: 750. Total 1110 min >= 18 h (1080). 14 days show up.
    const monthDaily = zeros(25);
    [40, 35, 60, 45, 90, 40, 50, 70, 150, 80, 30, 100, 120, 200].forEach((m, i) => (monthDaily[11 + i] = m * MIN));
    expect(month).toEqual({
      kind: 'month',
      monthKey: '2026-10',
      monthFocusMs: 1110 * MIN,
      goalHours: 18,
      daysShowedUp: 14,
      dailyMs: monthDaily,
    });

    // Markers saved: best 200, streak 14 ending Oct 25, week Mon Oct 19, month 2026-10.
    expect(getMomentMarkers(db)).toEqual({
      bestMs: 200 * MIN,
      streakCelebrated: 14,
      streakEndDayKey: '2026-10-25',
      weekCelebrated: '2026-10-19',
      monthCelebrated: '2026-10',
    });

    // The moments agree with what the app shows elsewhere for the same days.
    const cal = (await renderHook(() => useCalendarMonth('2026-10'))).result.current;
    const cells = cal.weeks.flat().filter((c): c is CalendarCell => c !== null);
    const inRange = (from: number, to: number) =>
      cells.filter((c) => Number(c.dayKey.slice(8, 10)) >= from && Number(c.dayKey.slice(8, 10)) <= to);
    const showedUp = (cs: CalendarCell[]) => cs.filter((c) => c.items.length >= 1).length;
    const weekCells = inRange(19, 25);
    const monthCells = inRange(1, 25);
    const w = week as Extract<Moment, { kind: 'week' }>;
    const m = month as Extract<Moment, { kind: 'month' }>;
    expect(w.goldRings).toBe(weekCells.reduce((n, c) => n + c.items.filter((i) => i.gold).length, 0));
    expect(w.daysShowedUp).toBe(showedUp(weekCells));
    expect(m.daysShowedUp).toBe(showedUp(monthCells));

    const cards = [];
    for (let d = 12; d <= 25; d++) cards.push((await renderHook(() => useDayCard(`2026-10-${d}`))).result.current);
    const weekCards = cards.filter((c) => c.dayKey >= '2026-10-19');
    expect(w.dailyMs).toEqual(weekCards.map((c) => c.focusedMs));
    expect(w.tasksDone).toBe(weekCards.reduce((n, c) => n + c.done, 0));
    expect(m.monthFocusMs).toBe(cards.reduce((n, c) => n + c.focusedMs, 0));

    // Profile is lifetime, and October 12..25 is the only history here, so it equals the month's numbers.
    const profile = (await renderHook(() => useProfileStats())).result.current;
    expect(profile.daysShowedUp).toBe(m.daysShowedUp);
    expect(profile.focusedHours * 60).toBeCloseTo(m.monthFocusMs / MIN, 6);
  });

  it('a close by hand at 01:30 after midnight closes the previous day key; its moments use that day week and month', () => {
    // Sun 2026-05-31 is the last day of May and a Sunday. Closing at Mon 2026-06-01 01:30 (before the 04:00 start)
    // closes day key 2026-05-31: the calendar date is a new week (Jun 1) and a new month, the day key is not.
    begin('2026-05-29');
    // Fri May 29: A 20 min (not done), C ticked -> 1 item. Closed by hand at 06:20; focus 20.
    run('2026-05-29', 20);
    tick('2026-05-29');
    closeToday(letGoAll());
    // Sat May 30: the close created its row, but the app is not opened and nothing is done: no focus, no item.
    // Sun May 31 06:00: A runs 40 min; at 06:40 reconcile completes it (30 min budget) and the user stops it:
    // focus 40, overtime 10 min = gold. C ticked. The app then waits until 01:30 on Jun 1.
    open('2026-05-31');
    startTask(row('2026-05-31', 'A'));
    t += 40 * MIN;
    reconcile();
    stopTask(row('2026-05-31', 'A'));
    tick('2026-05-31');
    t = dayStartOf('2026-06-01', 4) - 150 * MIN; // Jun 1 01:30 local
    const closedAt = t;
    const moments = closeToday(letGoAll());

    expect(loadDayBundle(db, '2026-05-31')!.day.closedAt).toBe(closedAt);
    expect(loadDayBundle(db, '2026-05-31')!.day.closedBy).toBe('user');
    const june1 = loadDayBundle(db, '2026-06-01');
    expect(june1?.day.closedAt).toBeNull();
    expect(june1?.dayTasks.every((d) => d.completedAt === null)).toBe(true);

    // No streak: May 30 has no item, so the run is 1 (a streak needs 7). The other five play, in order.
    expect(kinds(moments)).toEqual(['longest', 'day', 'best', 'week', 'month']);
    const [longest, day, best, week, month] = moments;

    expect(longest).toEqual({ kind: 'longest', name: 'A', colorKey: 'study', focusedMs: 40 * MIN, budgetSec: 1800 });
    // day: A done, C ticked = 2 of 2; focus 40 min; closedAt is the 01:30 instant.
    expect(day).toEqual({ kind: 'day', done: 2, total: 2, focusedMs: 40 * MIN, closedAt });
    // best: 40 beats the earlier best 20 (May 29). recentMs = May 18..May 30: May 29 is index 11 = 20, the rest 0.
    const recent = zeros(13);
    recent[11] = 20 * MIN;
    expect(best).toEqual({ kind: 'best', todayMs: 40 * MIN, previousBestMs: 20 * MIN, recentMs: recent });
    // week: the day key's week, Mon May 25 .. Sun May 31 (not the calendar week of Jun 1). May 29: 1 task done (C),
    // May 30: none, May 31: 2 => tasksDone 3. focus 20 + 0 + 40 = 60 min. gold: May 31 only = 1.
    // daysShowedUp: May 29, May 31 = 2. dailyMs: May 25..31 = index 4 (May 29) = 20, index 6 (May 31) = 40.
    expect(week).toEqual({
      kind: 'week',
      weekStart: '2026-05-25',
      tasksDone: 3,
      focusedMs: 60 * MIN,
      goldRings: 1,
      daysShowedUp: 2,
      dailyMs: [0, 0, 0, 0, 20 * MIN, 0, 40 * MIN],
    });
    // month: May (not June), no goal and May 31 is the last day, so it plays. 31 entries: index 28 (May 29) = 20,
    // index 30 (May 31) = 40. Total 60 min, 2 days show up.
    const monthDaily = zeros(31);
    monthDaily[28] = 20 * MIN;
    monthDaily[30] = 40 * MIN;
    expect(month).toEqual({
      kind: 'month',
      monthKey: '2026-05',
      monthFocusMs: 60 * MIN,
      goalHours: null,
      daysShowedUp: 2,
      dailyMs: monthDaily,
    });
    expect(getMomentMarkers(db)).toEqual({
      ...DEFAULT_MARKERS,
      bestMs: 40 * MIN,
      weekCelebrated: '2026-05-25',
      monthCelebrated: '2026-05',
    });
  });

  it('moments off: closes return [] and leave markers alone; a goal reached while off plays at the next close once on', () => {
    begin('2026-10-01');
    setMonthlyGoalHours(db, 1, t); // 60 min
    setMomentsEnabled(db, false, t);

    // Oct 1: A 20 min (not done), C ticked. Total 20 min < 60.
    run('2026-10-01', 20);
    tick('2026-10-01');
    expect(closeToday(letGoAll())).toEqual([]);
    expect(getMomentMarkers(db)).toEqual(DEFAULT_MARKERS);

    // Oct 2: A 50 min (done at 30). Total 70 min >= 60: the goal is reached while moments are off.
    open('2026-10-02');
    run('2026-10-02', 50);
    expect(closeToday(letGoAll())).toEqual([]);
    expect(getMomentMarkers(db)).toEqual(DEFAULT_MARKERS); // nothing marked as celebrated

    // Moments turned back on.
    setMomentsEnabled(db, true, t);

    // Oct 3: A 10 min (not done), C ticked. The next close by hand plays what is due:
    //   longest A 10 min. day: A not done (1 of 2) = none. best: earlier best 50 > today 10 = none.
    //   streak: run is 3 = none. week: Saturday = none. month: 20 + 50 + 10 = 80 min >= 60 = plays (late, once).
    //   dailyMs [20, 50, 10]. daysShowedUp: Oct 1 (C), Oct 2 (A done), Oct 3 (C) = 3.
    open('2026-10-03');
    run('2026-10-03', 10);
    tick('2026-10-03');
    const moments = closeToday(letGoAll());
    expect(kinds(moments)).toEqual(['longest', 'month']);
    expect(moments[0]).toEqual({ kind: 'longest', name: 'A', colorKey: 'study', focusedMs: 10 * MIN, budgetSec: 1800 });
    expect(moments[1]).toEqual({
      kind: 'month',
      monthKey: '2026-10',
      monthFocusMs: 80 * MIN,
      goalHours: 1,
      daysShowedUp: 3,
      dailyMs: [20 * MIN, 50 * MIN, 10 * MIN],
    });
    expect(getMomentMarkers(db)).toEqual({ ...DEFAULT_MARKERS, monthCelebrated: '2026-10' });

    // Oct 4 is a Sunday: the month is already celebrated so it does not play again, but the week (Mon Sep 28) does.
    // longest A 10 min; day: A not done = none; best: 10 < 50 = none; streak: run 1 = none.
    open('2026-10-04');
    run('2026-10-04', 10);
    expect(kinds(closeToday(letGoAll()))).toEqual(['longest', 'week']);
    expect(getMomentMarkers(db)).toEqual({ ...DEFAULT_MARKERS, weekCelebrated: '2026-09-28', monthCelebrated: '2026-10' });
  });
});
