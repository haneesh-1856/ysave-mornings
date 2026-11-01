import { addDays } from '../dayKey';
import { DEFAULT_MARKERS, momentsAtClose, nextMarkers, streakRun } from '../moments';
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
    closedAt: CLOSED, today, earlierDayFocusMs: [], itemCountByDay: { [today.day.dayKey]: 2 },
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

describe('best', () => {
  const today = bundle('2026-10-29', [task('A')], { A: 60 * MIN });
  it('never on the very first day (no earlier focus)', () => {
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [] })), 'best')).toBeUndefined();
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [0, 0] })), 'best')).toBeUndefined();
  });
  it('beating the best by 1 ms fires; equal does not', () => {
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [60 * MIN - 1, 5] })), 'best')).toEqual({ kind: 'best', todayMs: 60 * MIN, previousBestMs: 60 * MIN - 1 });
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [60 * MIN] })), 'best')).toBeUndefined();
  });
  it('must also beat the stored marker', () => {
    const markers = { ...DEFAULT_MARKERS, bestMs: 90 * MIN };
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [10 * MIN], markers })), 'best')).toBeUndefined();
    const m2 = { ...DEFAULT_MARKERS, bestMs: 30 * MIN };
    expect(find(momentsAtClose(input({ today, earlierDayFocusMs: [10 * MIN], markers: m2 })), 'best')!.previousBestMs).toBe(30 * MIN);
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
    expect(m(2, [day('2026-10-10', 60 * MIN), day('2026-10-20', 60 * MIN)])).toEqual({
      kind: 'month', monthKey: '2026-10', monthFocusMs: 2 * H, goalHours: 2, daysShowedUp: 2,
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
    expect(m(null, [day('2026-10-10', 10 * MIN), day('2026-10-31', 10 * MIN)])).toEqual({
      kind: 'month', monthKey: '2026-10', monthFocusMs: 20 * MIN, goalHours: null, daysShowedUp: 2,
    });
    expect(m(null, [day('2026-10-31', 10 * MIN)], { ...DEFAULT_MARKERS, monthCelebrated: '2026-10' })).toBeUndefined();
  });
});

describe('order and markers', () => {
  it('plays in order longest, day, best, streak, week, month', () => {
    const sun = bundle('2026-11-01', [task('A', { completedAt: 1 })], { A: 2 * H });
    const ms = momentsAtClose(input({
      today: sun, earlierDayFocusMs: [H], itemCountByDay: counts('2026-11-01', 7),
      weekBundles: [sun], monthBundles: [sun], monthlyGoalHours: 1,
    }));
    expect(kinds(ms)).toEqual(['longest', 'day', 'best', 'streak', 'week', 'month']);
  });

  it('nextMarkers records what played and leaves the rest', () => {
    const ms: Moment[] = [
      { kind: 'day', done: 1, total: 1, focusedMs: 1, closedAt: 1 },
      { kind: 'best', todayMs: 5000, previousBestMs: 10 },
      { kind: 'streak', days: 14, endDayKey: '2026-10-29' },
      { kind: 'week', weekStart: '2026-10-26', tasksDone: 0, focusedMs: 0, goldRings: 0, daysShowedUp: 0 },
      { kind: 'month', monthKey: '2026-10', monthFocusMs: 0, goalHours: null, daysShowedUp: 0 },
    ];
    expect(nextMarkers(DEFAULT_MARKERS, ms)).toEqual({
      bestMs: 5000, streakCelebrated: 14, streakEndDayKey: '2026-10-29', weekCelebrated: '2026-10-26', monthCelebrated: '2026-10',
    });
    expect(nextMarkers(DEFAULT_MARKERS, [ms[0]])).toBe(DEFAULT_MARKERS);
  });
});
