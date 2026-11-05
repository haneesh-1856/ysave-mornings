import { addDays, weekdayIndex } from '../dayKey';
import { DEFAULT_MARKERS, STREAK_MAX_STEPS, momentsAtClose, nextMarkers, streakRun, streakWeekdays } from '../moments';
import type { Moment, MomentMarkers, MomentsInput } from '../moments';
import type { DayBundle, DayKey, DayTask, Session } from '../types';

const H = 3_600_000;
const MIN = 60_000;
const CLOSED = 1_000_000_000_000;

function task(id: string, o: Partial<DayTask> = {}): DayTask {
  return {
    id, dayKey: '2026-10-29', taskId: null, topicId: 't', name: id, colorKey: 'study', kind: 'timed',
    budgetSec: 1800, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt: null,
    closeOutcome: null, sortOrder: 0, ...o,
  };
}
const sess = (dayTaskId: string, ms: number): Session => ({
  id: `s-${dayTaskId}`, dayTaskId, startedAt: 1000, endedAt: 1000 + ms,
});
function bundle(dayKey: DayKey, tasks: DayTask[], sessions: Record<string, number> = {}, confirmed = true): DayBundle {
  return {
    day: { dayKey, planConfirmedAt: confirmed ? 5 : null, planDraftedAt: null, planUpdatedAt: null, closedAt: CLOSED, closedBy: 'user', dayStartHour: 4 },
    dayTasks: tasks.map((t) => ({ ...t, dayKey })),
    sessionsByDayTask: Object.fromEntries(tasks.map((t) => [t.id, sessions[t.id] ? [sess(t.id, sessions[t.id])] : []])),
  };
}
// 2026-10-29 is a Thursday. 2026-11-01 is a Sunday (last day of its week). 2026-10-31 is the last day of October.
function input(over: Partial<MomentsInput> = {}): MomentsInput {
  const today = over.today ?? bundle('2026-10-29', [task('A', { completedAt: 1 })], { A: 10 * MIN });
  return {
    closedAt: CLOSED, today, earlierFocusByDay: {}, itemCountByDay: { [today.day.dayKey]: 2 },
    weekBundles: [today], monthBundles: [today], monthlyGoalHours: null, markers: DEFAULT_MARKERS, ...over,
  };
}
const kinds = (ms: Moment[]) => ms.map((m) => m.kind);
const find = <K extends Moment['kind']>(ms: Moment[], k: K) =>
  ms.find((m) => m.kind === k) as Extract<Moment, { kind: K }> | undefined;
const counts = (end: DayKey, n: number): Record<DayKey, number> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(end, -i), 1]));

describe('longest', () => {
  it('picks the timed task with the most focus and carries its data', () => {
    const today = bundle('2026-10-29', [task('A', { sortOrder: 0, name: 'Read' }), task('B', { sortOrder: 1, name: 'Write', colorKey: 'health', budgetSec: 900 })], { A: 5 * MIN, B: 20 * MIN });
    expect(find(momentsAtClose(input({ today })), 'longest')).toEqual({
      kind: 'longest', name: 'Write', colorKey: 'health', focusedMs: 20 * MIN, budgetSec: 900,
    });
  });
  it('ties go to the earlier sortOrder, whatever the array order', () => {
    const today = bundle('2026-10-29', [task('B', { sortOrder: 1, name: 'B' }), task('A', { sortOrder: 0, name: 'A' })], { A: 5 * MIN, B: 5 * MIN });
    expect(find(momentsAtClose(input({ today })), 'longest')!.name).toBe('A');
  });
  it('is absent with no focus, or when only a check task has sessions', () => {
    expect(find(momentsAtClose(input({ today: bundle('2026-10-29', [task('A')]) })), 'longest')).toBeUndefined();
    expect(find(momentsAtClose(input({ today: bundle('2026-10-29', [task('C', { kind: 'check' })], { C: 5 * MIN }) })), 'longest')).toBeUndefined();
  });
});

describe('day', () => {
  it('fires when every task is done, with done, total, focus and closedAt', () => {
    const today = bundle('2026-10-29', [task('A', { completedAt: 1 }), task('B', { completedAt: 2 }), task('C', { kind: 'check', completedAt: 3 })], { A: 10 * MIN, B: 5 * MIN });
    expect(find(momentsAtClose(input({ today })), 'day')).toEqual({ kind: 'day', done: 3, total: 3, focusedMs: 15 * MIN, closedAt: CLOSED });
  });
  it('is absent when any task is left: the day closes quietly', () => {
    const today = bundle('2026-10-29', [task('A', { completedAt: 1 }), task('B'), task('C', { kind: 'check' })], { A: 10 * MIN, B: 5 * MIN });
    expect(find(momentsAtClose(input({ today })), 'day')).toBeUndefined();
  });
  it('an empty day has nothing to complete and plays nothing', () => {
    const today = bundle('2026-10-29', [], {}, false);
    const ms = momentsAtClose(input({ today, weekBundles: [today], monthBundles: [today], itemCountByDay: { '2026-10-29': 0 } }));
    expect(ms).toEqual([]);
  });
});

// Earlier days keyed from yesterday back: E(a, b) = { 10-28: a, 10-27: b }.
const E = (...ms: number[]): Record<DayKey, number> => Object.fromEntries(ms.map((v, i) => [addDays('2026-10-29', -1 - i), v]));

describe('best', () => {
  const today = bundle('2026-10-29', [task('A')], { A: 60 * MIN });
  it('never on the very first day (no earlier focus)', () => {
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: {} })), 'best')).toBeUndefined();
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: E(0, 0) })), 'best')).toBeUndefined();
  });
  it('beating the best by 1 ms fires; equal does not', () => {
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: E(60 * MIN - 1, 5) })), 'best')).toEqual({ kind: 'best', todayMs: 60 * MIN, previousBestMs: 60 * MIN - 1, recentMs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 60 * MIN - 1] });
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: E(60 * MIN) })), 'best')).toBeUndefined();
  });
  it('must also beat the stored marker', () => {
    const markers = { ...DEFAULT_MARKERS, bestMs: 90 * MIN };
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: E(10 * MIN), markers })), 'best')).toBeUndefined();
    const m2 = { ...DEFAULT_MARKERS, bestMs: 30 * MIN };
    expect(find(momentsAtClose(input({ today, earlierFocusByDay: E(10 * MIN), markers: m2 })), 'best')!.previousBestMs).toBe(30 * MIN);
  });
  type Best = Extract<Moment, { kind: 'best' }>;
  const bestOf = (over: Partial<MomentsInput>) => find(momentsAtClose(input({ today, ...over })), 'best') as Best;
  it('recentMs is 13 entries, oldest first, index 12 = yesterday, missing days 0', () => {
    // Today 10-29. Yesterday 10-28 = 7, 10-26 = 9 (index 10), 10-16 = 4 (index 0, the oldest shown), 10-15 = 20 (outside).
    const b = bestOf({ earlierFocusByDay: { '2026-10-28': 7, '2026-10-26': 9, '2026-10-16': 4, '2026-10-15': 20 } });
    expect(b.recentMs).toHaveLength(13);
    expect(b.recentMs).toEqual([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 0, 7]);
    expect(b.previousBestMs).toBe(20);
  });
  it('every recentMs value is <= previousBestMs, whether the best is a recent day, a marker or older than 13 days', () => {
    const cases: Partial<MomentsInput>[] = [
      { earlierFocusByDay: E(10 * MIN, 59 * MIN, 3) },
      { earlierFocusByDay: E(10 * MIN, 5 * MIN), markers: { ...DEFAULT_MARKERS, bestMs: 40 * MIN } },
      { earlierFocusByDay: { '2026-10-28': 10 * MIN, '2026-09-01': 50 * MIN } },
    ];
    for (const c of cases) {
      const b = bestOf(c);
      expect(b.recentMs).toHaveLength(13);
      for (const v of b.recentMs) expect(v).toBeLessThanOrEqual(b.previousBestMs);
    }
    expect(bestOf(cases[1]).previousBestMs).toBe(40 * MIN);
    // The marker (40) sets the glass only; the bars stay the real days (10-28 = 10, 10-27 = 5), never clamped up to 40.
    expect(bestOf(cases[1]).recentMs).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5 * MIN, 10 * MIN]);
    expect(bestOf(cases[2]).previousBestMs).toBe(50 * MIN);
  });
});

describe('streak', () => {
  const at = (n: number, markers = DEFAULT_MARKERS) => {
    const today = bundle('2026-10-29', [task('A')]);
    return find(momentsAtClose(input({ today, itemCountByDay: counts('2026-10-29', n), markers })), 'streak');
  };
  it('fires at 7 and 14, not at 6 or 8', () => {
    expect(at(6)).toBeUndefined();
    expect(at(7)).toEqual({ kind: 'streak', days: 7, endDayKey: '2026-10-29' });
    expect(at(8)).toBeUndefined();
    expect(at(14)!.days).toBe(14);
  });
  it('does not repeat the same run length, but 14 of the same run fires after 7', () => {
    const celebrated7 = { ...DEFAULT_MARKERS, streakCelebrated: 7, streakEndDayKey: '2026-10-22' };
    expect(at(14, celebrated7)!.days).toBe(14);
    const same = { ...DEFAULT_MARKERS, streakCelebrated: 7, streakEndDayKey: '2026-10-29' };
    expect(at(7, same)).toBeUndefined();
  });
  it('a new run of 7 after a break fires again', () => {
    const old = { ...DEFAULT_MARKERS, streakCelebrated: 7, streakEndDayKey: '2026-10-10' };
    expect(at(7, old)!.days).toBe(7);
  });
  it('today must count; a gap ends the run', () => {
    expect(streakRun('2026-10-29', counts('2026-10-28', 10))).toBe(0);
    expect(streakRun('2026-10-29', { ...counts('2026-10-29', 3), '2026-10-25': 5 })).toBe(3);
    expect(streakRun('2026-10-29', { '2026-10-29': 1, '2026-10-28': 0, '2026-10-27': 4 })).toBe(1);
  });
});

describe('week', () => {
  const sun = '2026-11-01';
  const mon = '2026-10-26';
  const sunB = bundle(sun, [task('G', { completedAt: 1, budgetSec: 600 }), task('K', { kind: 'check', completedAt: 2 })], { G: 12 * MIN });
  const monB = bundle(mon, [task('M', { completedAt: 1, budgetSec: 3600 }), task('N')], { M: 30 * MIN }, false);
  const wk = (today: DayBundle, markers: MomentMarkers = DEFAULT_MARKERS) =>
    find(momentsAtClose(input({ today, weekBundles: [monB, today], markers, monthlyGoalHours: 1000 })), 'week');
  it('fires on the last day with the week totals', () => {
    expect(wk(sunB)).toEqual({
      kind: 'week', weekStart: mon, tasksDone: 3, focusedMs: 42 * MIN, goldRings: 1, daysShowedUp: 2,
      dailyMs: [30 * MIN, 0, 0, 0, 0, 0, 12 * MIN],
    });
  });
  describe('dailyMs', () => {
    const tue = bundle('2026-10-27', [task('T')], { T: 7 * MIN });
    const thu = bundle('2026-10-29', [task('H')], { H: 5 * MIN });
    const weekOf = (bundles: DayBundle[]) =>
      find(momentsAtClose(input({ today: sunB, weekBundles: bundles })), 'week')!;
    it('has 7 entries, Monday first, 0 for a day with no row', () => {
      const w = weekOf([monB, tue, thu, sunB]);
      expect(w.dailyMs).toHaveLength(7);
      expect(w.dailyMs).toEqual([30 * MIN, 7 * MIN, 0, 5 * MIN, 0, 0, 12 * MIN]);
    });
    it('ignores a day outside the week in every total', () => {
      const lastSun = bundle('2026-10-25', [task('X', { completedAt: 1 })], { X: 50 * MIN });
      const w = weekOf([lastSun, monB, tue, thu, sunB]);
      expect(w).toEqual(weekOf([monB, tue, thu, sunB]));
    });
    it('sums to focusedMs', () => {
      const w = weekOf([monB, tue, thu, sunB]);
      expect(w.dailyMs.reduce((a, b) => a + b, 0)).toBe(w.focusedMs);
    });
    it('does not depend on the order of the bundles', () => {
      expect(weekOf([sunB, thu, monB, tue]).dailyMs).toEqual(weekOf([monB, tue, thu, sunB]).dailyMs);
    });
    it('is all zeros when no bundles are given', () => {
      expect(weekOf([]).dailyMs).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });
  });
  it('does not fire on another day', () => {
    expect(wk(bundle('2026-10-31', [task('G')]))).toBeUndefined();
  });
  it('not twice for the same week', () => {
    expect(wk(sunB, { ...DEFAULT_MARKERS, weekCelebrated: mon })).toBeUndefined();
    expect(wk(sunB, { ...DEFAULT_MARKERS, weekCelebrated: '2026-10-19' })).toBeDefined();
  });
});

describe('month', () => {
  const day = (k: DayKey, ms: number) => bundle(k, [task('A', { completedAt: 1 })], { A: ms });
  const m = (goal: number | null, bundles: DayBundle[], markers: MomentMarkers = DEFAULT_MARKERS) =>
    find(momentsAtClose(input({ today: bundles[bundles.length - 1], monthBundles: bundles, weekBundles: [], monthlyGoalHours: goal, markers })), 'month');
  it('goal reached fires with the month data', () => {
    // Closed on the 20th: dailyMs has 20 entries, 60 min at idx 9 (the 10th) and idx 19 (the 20th).
    const dailyMs = Array.from({ length: 20 }, (_, i) => (i === 9 || i === 19 ? H : 0));
    expect(m(2, [day('2026-10-10', 60 * MIN), day('2026-10-20', 60 * MIN)])).toEqual({
      kind: 'month', monthKey: '2026-10', monthFocusMs: 2 * H, goalHours: 2, daysShowedUp: 2, dailyMs,
    });
  });
  it('goal not reached does not fire, even on the last day', () => {
    expect(m(2, [day('2026-10-10', 60 * MIN), day('2026-10-31', 59 * MIN)])).toBeUndefined();
  });
  it('already celebrated this month does not fire again; a new month would', () => {
    const marked = { ...DEFAULT_MARKERS, monthCelebrated: '2026-10' };
    expect(m(1, [day('2026-10-20', 2 * H)], marked)).toBeUndefined();
    expect(m(1, [day('2026-10-20', 2 * H)], { ...DEFAULT_MARKERS, monthCelebrated: '2026-09' })).toBeDefined();
  });
  it('no goal: month in review on the last day only, with goalHours null', () => {
    expect(m(null, [day('2026-10-30', 10 * MIN)])).toBeUndefined();
    const dailyMs = Array.from({ length: 31 }, (_, i) => (i === 9 || i === 30 ? 10 * MIN : 0));
    expect(m(null, [day('2026-10-10', 10 * MIN), day('2026-10-31', 10 * MIN)])).toEqual({
      kind: 'month', monthKey: '2026-10', monthFocusMs: 20 * MIN, goalHours: null, daysShowedUp: 2, dailyMs,
    });
    expect(m(null, [day('2026-10-31', 10 * MIN)], { ...DEFAULT_MARKERS, monthCelebrated: '2026-10' })).toBeUndefined();
  });
  it('dailyMs: length is the day of the month today is, in order from the 1st, missing days 0, sums to monthFocusMs', () => {
    const r = m(1, [day('2026-10-03', 40 * MIN), day('2026-10-01', 30 * MIN), day('2026-10-06', 20 * MIN)])!;
    // Bundles may come in any order; today (the last one given) is the 6th.
    expect(r.dailyMs).toEqual([30 * MIN, 0, 40 * MIN, 0, 0, 20 * MIN]);
    expect(r.monthFocusMs).toBe(90 * MIN);
    expect(r.dailyMs.reduce((a, v) => a + v, 0)).toBe(r.monthFocusMs);
  });
  it('the last day of February has 28 entries in 2027 and 29 in the leap year 2028', () => {
    expect(m(null, [day('2027-02-28', 10 * MIN)])!.dailyMs).toEqual([...Array(27).fill(0), 10 * MIN]);
    expect(m(null, [day('2028-02-29', 10 * MIN)])!.dailyMs).toEqual([...Array(28).fill(0), 10 * MIN]);
    expect(m(null, [day('2028-02-29', 10 * MIN)])!.dailyMs).toHaveLength(29);
  });
  it('a bundle from another month (or after today) is ignored in the total, the days and the count', () => {
    const r = m(1, [day('2026-09-30', 5 * H), day('2026-10-02', 30 * MIN), day('2026-11-01', 5 * H), day('2026-10-04', 40 * MIN)])!;
    expect(r.dailyMs).toEqual([0, 30 * MIN, 0, 40 * MIN]);
    expect(r.monthFocusMs).toBe(70 * MIN);
    expect(r.daysShowedUp).toBe(2);
  });
});

describe('order and markers', () => {
  it('plays in order longest, day, best, streak, week, month', () => {
    const sun = bundle('2026-11-01', [task('A', { completedAt: 1 })], { A: 2 * H });
    const ms = momentsAtClose(input({
      today: sun, earlierFocusByDay: { '2026-10-31': H }, itemCountByDay: counts('2026-11-01', 7),
      weekBundles: [sun], monthBundles: [sun], monthlyGoalHours: 1,
    }));
    expect(kinds(ms)).toEqual(['longest', 'day', 'best', 'streak', 'week', 'month']);
  });

  it('nextMarkers records what played and leaves the rest', () => {
    const ms: Moment[] = [
      { kind: 'day', done: 1, total: 1, focusedMs: 1, closedAt: 1 },
      { kind: 'best', todayMs: 5000, previousBestMs: 10, recentMs: [] },
      { kind: 'streak', days: 14, endDayKey: '2026-10-29' },
      { kind: 'week', weekStart: '2026-10-26', tasksDone: 0, focusedMs: 0, goldRings: 0, daysShowedUp: 0, dailyMs: [0, 0, 0, 0, 0, 0, 0] },
      { kind: 'month', monthKey: '2026-10', monthFocusMs: 0, goalHours: null, daysShowedUp: 0, dailyMs: [0] },
    ];
    expect(nextMarkers(DEFAULT_MARKERS, ms)).toEqual({
      bestMs: 5000, streakCelebrated: 14, streakEndDayKey: '2026-10-29', weekCelebrated: '2026-10-26', monthCelebrated: '2026-10',
    });
    expect(nextMarkers(DEFAULT_MARKERS, [ms[0]])).toBe(DEFAULT_MARKERS);
  });
});

describe('streakWeekdays', () => {
  const streak = (days: number, endDayKey: DayKey): Extract<Moment, { kind: 'streak' }> => ({ kind: 'streak', days, endDayKey });
  // 2026-10-29 is a Thursday (3). Weekday 0 = Monday.
  it('7 days ending Thursday: Friday..Thursday', () => {
    expect(streakWeekdays(streak(7, '2026-10-29'))).toEqual([4, 5, 6, 0, 1, 2, 3]);
  });
  it('14 days is two turns of the week, still ending Thursday', () => {
    expect(streakWeekdays(streak(14, '2026-10-29'))).toEqual([4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3]);
  });
  it('21 days is three turns', () => {
    const w = streakWeekdays(streak(21, '2026-10-29'));
    expect(w).toHaveLength(21);
    const first7 = [4, 5, 6, 0, 1, 2, 3];
    expect(w).toEqual([...first7, ...first7, ...first7]);
  });
  it('28 days is capped at 21 steps and still ends on endDayKey', () => {
    const w = streakWeekdays(streak(28, '2026-10-29'));
    expect(STREAK_MAX_STEPS).toBe(21);
    expect(w).toHaveLength(21);
    expect(w[20]).toBe(3);
    // The stair shows the LAST 21 days: the first step is the weekday of endDayKey - 20 (Friday, not Thursday).
    expect(w[0]).toBe(weekdayIndex(addDays('2026-10-29', -20)));
    expect(w[0]).toBe(4);
  });
  it('0 days draws nothing, 1 day is just endDayKey', () => {
    expect(streakWeekdays(streak(0, '2026-10-29'))).toEqual([]);
    expect(streakWeekdays(streak(1, '2026-10-29'))).toEqual([weekdayIndex('2026-10-29')]);
  });
  it('ends on the weekday of endDayKey for each weekday, stepping +1 mod 7', () => {
    for (let wd = 0; wd < 7; wd++) {
      const end = addDays('2026-10-26', wd); // Monday 2026-10-26 + wd
      const w = streakWeekdays(streak(14, end));
      expect(w[w.length - 1]).toBe(wd);
      for (let i = 1; i < w.length; i++) expect(w[i]).toBe((w[i - 1] + 1) % 7);
    }
  });
});
