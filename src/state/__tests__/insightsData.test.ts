import { getDay, listDays, loadDayBundle } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { collectionItems } from '../../domain/collection';
import { addDays } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import { REMOVED_TOPICS_ID } from '../../domain/insights';
import { focusedMs } from '../../domain/timer';
import type { CloseOutcome } from '../../domain/types';
import { closeToday } from '../actions/close';
import { createTask, createTopic, removeTopic } from '../actions/library';
import { confirmDayPlan } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setDayStart } from '../actions/settings';
import { setClockOverride } from '../clock';
import { loadInsights } from '../hooks/useInsights';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const M = 60_000;
let db: DB;
let t: number;

/** Wall-clock instant (jest runs in America/New_York; epochs are built from local parts, so the test holds in any zone). */
function go(day: string, hh: number, mm = 0): void {
  const [y, m, d] = day.split('-').map(Number);
  t = new Date(y, m - 1, d, hh, mm).getTime();
}
const row = (day: string, name: string) => loadDayBundle(db, day)!.dayTasks.find((d) => d.name === name)!.id;
const A = (day: string) => startTask(row(day, 'A'));
const closeWith = (day: string, over: Record<string, CloseOutcome> = {}) =>
  closeToday(letGoAll(Object.fromEntries(Object.entries(over).map(([name, o]) => [row(day, name), o]))));

afterEach(() => teardownState());

/** Plays the whole story through the app's own actions; returns the ids the assertions need. */
function playStory() {
  go('2026-10-08', 9);
  db = setupState(t);
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  const health = createTopic({ name: 'Health', colorKey: 'health' });
  const home = createTopic({ name: 'Home', colorKey: 'home' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  createTask(health.id, { name: 'H', kind: 'timed', minutes: 20, repeatMask: 2 | 16, isDefault: true }); // Tue, Fri
  createTask(home.id, { name: 'Z', kind: 'timed', minutes: 15, repeatMask: 4, isDefault: true }); // Wed
  reconcile();

  // Before the window (must contribute nothing): Thu Oct 8 A 60 min, Tue Oct 13 A 40 min.
  A('2026-10-08');
  go('2026-10-08', 10);
  stopTask(row('2026-10-08', 'A'));
  go('2026-10-08', 10, 5);
  closeWith('2026-10-08');
  go('2026-10-13', 8);
  reconcile();
  A('2026-10-13');
  go('2026-10-13', 8, 40);
  stopTask(row('2026-10-13', 'A'));
  go('2026-10-13', 8, 45);
  closeWith('2026-10-13');

  // Oct 14 Wed: A 08:00-08:20 (paused by Z starting), Z 08:20-08:45 (done at 08:35, 10 min over = gold). C ticked.
  go('2026-10-14', 8);
  reconcile();
  A('2026-10-14');
  go('2026-10-14', 8, 20);
  startTask(row('2026-10-14', 'Z'));
  go('2026-10-14', 8, 45);
  stopTask(row('2026-10-14', 'Z'));
  toggleCheckTask(row('2026-10-14', 'C'));
  go('2026-10-14', 9);
  closeWith('2026-10-14', { A: 'moved' }); // 10 min left, carried

  // Oct 15 Thu: the carried A (budget 10) runs 09:50-10:20 across the 10:00 hour mark: 20 min over = gold. C let go.
  go('2026-10-15', 9, 30);
  reconcile();
  go('2026-10-15', 9, 50);
  A('2026-10-15');
  go('2026-10-15', 10, 20);
  stopTask(row('2026-10-15', 'A'));
  go('2026-10-15', 10, 30);
  closeWith('2026-10-15');

  // Oct 16 Fri: an empty row (made by the close), never opened -> auto-closed. Oct 17: no row.
  // Oct 18 Sun: C ticked; A started 22:30 and left running -> the auto-close ends it at Oct 19 04:00 (330 min).
  go('2026-10-18', 20);
  reconcile();
  go('2026-10-18', 20, 5);
  toggleCheckTask(row('2026-10-18', 'C'));
  go('2026-10-18', 22, 30);
  A('2026-10-18');

  // Oct 19: no row. Oct 20 Tue: H 08:00-08:10 paused, A 08:30-09:30 (exactly 60 min). H carried, C let go.
  go('2026-10-20', 8);
  reconcile();
  startTask(row('2026-10-20', 'H'));
  go('2026-10-20', 8, 10);
  pauseTask(row('2026-10-20', 'H'));
  go('2026-10-20', 8, 30);
  A('2026-10-20');
  go('2026-10-20', 9, 30);
  stopTask(row('2026-10-20', 'A'));
  go('2026-10-20', 9, 40);
  closeWith('2026-10-20', { H: 'moved' });

  // Oct 21 Wed: nothing run; C ticked; H carried again, A and Z let go.
  go('2026-10-21', 8);
  reconcile();
  go('2026-10-21', 8, 5);
  toggleCheckTask(row('2026-10-21', 'C'));
  go('2026-10-21', 8, 10);
  closeWith('2026-10-21', { H: 'moved' });

  // Oct 22 Thu: H (carried 10 min) 09:00-09:10 ends exactly at its budget (no overtime, no gold), A 09:10-09:25.
  go('2026-10-22', 9);
  reconcile();
  startTask(row('2026-10-22', 'H'));
  go('2026-10-22', 9, 10);
  stopTask(row('2026-10-22', 'H'));
  A('2026-10-22');
  go('2026-10-22', 9, 25);
  pauseTask(row('2026-10-22', 'A'));
  go('2026-10-22', 9, 30);
  closeWith('2026-10-22'); // A and C let go

  // Oct 23 Fri: empty row, auto-closed. Oct 24, 25: no rows.
  // Oct 26 Mon: A 07:00-07:25, C ticked, never closed by hand -> auto-closed. Evening: plan Tuesday.
  go('2026-10-26', 7);
  reconcile();
  A('2026-10-26');
  go('2026-10-26', 7, 25);
  pauseTask(row('2026-10-26', 'A'));
  go('2026-10-26', 7, 30);
  toggleCheckTask(row('2026-10-26', 'C'));
  go('2026-10-26', 21);
  confirmDayPlan(
    '2026-10-27',
    buildPlan({
      dayKey: '2026-10-27',
      topics: listTopics(db),
      tasks: listTasks(db),
      day: getDay(db, '2026-10-27'),
      dayTasks: loadDayBundle(db, '2026-10-27')?.dayTasks ?? [],
    }),
  );

  // Oct 27 Tue: A 08:00-08:31 = 1 min over exactly (gold). C ticked. H (never started) carried.
  go('2026-10-27', 8);
  reconcile();
  A('2026-10-27');
  go('2026-10-27', 8, 31);
  stopTask(row('2026-10-27', 'A'));
  go('2026-10-27', 8, 35);
  toggleCheckTask(row('2026-10-27', 'C'));
  go('2026-10-27', 8, 40);
  closeWith('2026-10-27', { H: 'moved' });
  go('2026-10-27', 22);
  setDayStart(6); // Oct 28 onward starts at 06:00

  // Oct 28 Wed: Z 09:00-09:12 (3 min left, carried), A 09:12-11:12 (120 min), C ticked. H let go.
  go('2026-10-28', 9);
  reconcile();
  startTask(row('2026-10-28', 'Z'));
  go('2026-10-28', 9, 12);
  A('2026-10-28');
  go('2026-10-28', 11, 12);
  stopTask(row('2026-10-28', 'A'));
  go('2026-10-28', 11, 15);
  toggleCheckTask(row('2026-10-28', 'C'));
  go('2026-10-28', 11, 20);
  closeWith('2026-10-28', { Z: 'moved' });

  // Oct 29 Thu: the carried Z (3 min) sits on an empty row, auto-closed. Oct 30: no row.
  // Oct 31 Sat: A 23:40-00:10 (exactly 30 min, not gold) across midnight; C ticked after midnight (still Oct 31).
  go('2026-10-31', 23, 30);
  reconcile();
  go('2026-10-31', 23, 40);
  A('2026-10-31');
  go('2026-11-01', 0, 10);
  stopTask(row('2026-10-31', 'A'));
  go('2026-11-01', 0, 15);
  toggleCheckTask(row('2026-10-31', 'C'));

  // Nov 1 Sun: A 08:00-08:20, C not ticked, nothing done -> does not show up; auto-closed.
  go('2026-11-01', 8);
  reconcile();
  A('2026-11-01');
  go('2026-11-01', 8, 20);
  pauseTask(row('2026-11-01', 'A'));

  // Nov 2: no row. Nov 3 Tue: Home removed; H 10:00-10:50 (30 over, gold); C ticked; A let go.
  go('2026-11-03', 10);
  reconcile();
  removeTopic(home.id);
  startTask(row('2026-11-03', 'H'));
  go('2026-11-03', 10, 50);
  stopTask(row('2026-11-03', 'H'));
  go('2026-11-03', 10, 55);
  toggleCheckTask(row('2026-11-03', 'C'));
  go('2026-11-03', 11);
  closeWith('2026-11-03');

  // Nov 4 Wed: empty row, auto-closed. Nov 5-8: no rows.
  // Nov 9 Mon: A 06:30-06:45 then 07:00-07:20 (5 min over, gold), C ticked.
  go('2026-11-09', 6, 30);
  reconcile();
  A('2026-11-09');
  go('2026-11-09', 6, 45);
  pauseTask(row('2026-11-09', 'A'));
  go('2026-11-09', 7);
  A('2026-11-09');
  go('2026-11-09', 7, 20);
  stopTask(row('2026-11-09', 'A'));
  go('2026-11-09', 7, 25);
  toggleCheckTask(row('2026-11-09', 'C'));
  go('2026-11-09', 7, 30);
  closeWith('2026-11-09');

  // Nov 10 Tue: empty row, auto-closed. Nov 11 Wed: C ticked, A let go.
  go('2026-11-11', 9);
  reconcile();
  go('2026-11-11', 9, 5);
  toggleCheckTask(row('2026-11-11', 'C'));
  go('2026-11-11', 9, 10);
  closeWith('2026-11-11');

  // Nov 12 Thu (today): A started 08:30, still running at 09:15 (45 min; done at 09:00, 15 over = gold).
  go('2026-11-12', 7);
  reconcile();
  go('2026-11-12', 8, 30);
  A('2026-11-12');
  go('2026-11-12', 9, 15);
  reconcile();
  return { study, health, home, at: t };
}

describe('insights: data traced from five weeks of real use', () => {
  it('every field of Insights is the hand-worked value', () => {
    const { study, health, at } = playStory();
    const ins = loadInsights(at);

    // The window: today Nov 12 (Thu), W = Oct 14 .. Nov 12 (18 days of Oct + 12 of Nov). Oct 8 and Oct 13 are outside.
    // Rows in W (20): Oct 14 15 16 18 20 21 22 23 26 27 28 29 31, Nov 1 3 4 9 10 11 12. No row: Oct 17 19 24 25 30,
    // Nov 2 5 6 7 8.
    //
    // Focus per day (minutes), from the sessions below:
    //   Oct 14 45 (A 20 + Z 25) | Oct 15 30 | Oct 18 330 | Oct 20 70 (H 10 + A 60) | Oct 22 25 (H 10 + A 15)
    //   Oct 26 25 | Oct 27 31 | Oct 28 132 (Z 12 + A 120) | Oct 31 30 | Nov 1 20 | Nov 3 50 | Nov 9 35 (15 + 20)
    //   Nov 12 45 (running, counted to 09:15). Every other row day 0.
    //   Total 45+30+330+70+25+25+31+132+30+20+50+35+45 = 868 min.
    expect(ins.windowStart).toBe('2026-10-14');
    expect(ins.windowEnd).toBe('2026-11-12');
    expect(ins.totalFocusMs).toBe(868 * M);

    // hours (minutes per local clock hour): h0 60 (Oct 18's 22:30-04:00 run) + 10 (Oct 31's 23:40-00:10 run), h1 60, h2 60,
    // h3 60 (both Oct 18),
    // h6 15 (Nov 9), h7 25 (Oct 26) + 20 (Nov 9), h8 45+40+31+20+30 = 166 (Oct 14, Oct 20: 10+30, Oct 27, Nov 1, Nov 12),
    // h9 10 (Oct 15) + 30 (Oct 20) + 25 (Oct 22) + 12+48 (Oct 28) + 15 (Nov 12) = 140,
    // h10 20 (Oct 15) + 60 (Oct 28) + 50 (Nov 3) = 130, h11 12 (Oct 28), h22 30 (Oct 18), h23 60 (Oct 18) + 20 (Oct 31).
    const hours = new Array<number>(24).fill(0);
    Object.entries({ 0: 70, 1: 60, 2: 60, 3: 60, 6: 15, 7: 45, 8: 166, 9: 140, 10: 130, 11: 12, 22: 30, 23: 80 }).forEach(
      ([h, min]) => (hours[Number(h)] = min * M),
    );
    expect(ins.hours.msByHour).toEqual(hours);

    // weekdays (0 = Mon): Mon Oct 26 25 + Nov 9 35 = 60 | Tue Oct 20 70 + Oct 27 31 + Nov 3 50 = 151
    // | Wed Oct 14 45 + Oct 28 132 = 177 | Thu Oct 15 30 + Oct 22 25 + Nov 12 45 = 100 | Fri 0 | Sat Oct 31 30
    // | Sun Oct 18 330 + Nov 1 20 = 350. Day counts: Wed and Thu occur 5 times, the rest 4.
    // avg (min): 15, 37.75, 35.4, 20, 0, 7.5, 87.5.
    expect(ins.weekdays.totalMs).toEqual([60, 151, 177, 100, 0, 30, 350].map((m) => m * M));
    expect(ins.weekdays.dayCount).toEqual([4, 4, 5, 5, 4, 4, 4]);
    expect(ins.weekdays.avgMs).toEqual([60 / 4, 151 / 4, 177 / 5, 100 / 5, 0, 30 / 4, 350 / 4].map((m) => m * M));

    // firstStart: earliest start minus that day's start (04:00 until Oct 27, 06:00 from Oct 28), whole minutes.
    //   Oct 14 08:00 240 | Oct 15 09:50 350 | Oct 18 22:30 1110 | Oct 20 08:00 240 | Oct 22 09:00 300 | Oct 26 07:00 180
    //   | Oct 27 08:00 240 | Oct 28 09:00 (start 06:00) 180 | Oct 31 23:40 (06:00) 1060 | Nov 1 08:00 120
    //   | Nov 3 10:00 240 | Nov 9 06:30 30 | Nov 12 08:30 150. Sorted: 30 120 150 180 180 240 240 240 240 300 350 1060 1110
    //   (13 values) -> median is the 7th = 240.
    const first: [string, number][] = [
      ['2026-10-14', 240], ['2026-10-15', 350], ['2026-10-18', 1110], ['2026-10-20', 240], ['2026-10-22', 300],
      ['2026-10-26', 180], ['2026-10-27', 240], ['2026-10-28', 180], ['2026-10-31', 1060], ['2026-11-01', 120],
      ['2026-11-03', 240], ['2026-11-09', 30], ['2026-11-12', 150],
    ];
    expect(ins.firstStart).toEqual({
      days: first.map(([dayKey, minutes]) => ({ dayKey, minutes })),
      medianMinutes: 240,
    });

    // topics: Study (A) 20+30+330+60+15+25+31+120+30+20+35+45 = 761 | Health (H) 10+10+50 = 70 | Home (Z, removed) 25+12 = 37.
    // The removed topic is the one merged row (domain rule: every deleted or unknown topic), in the neutral colour.
    expect(ins.topics).toEqual([
      { topicId: study.id, name: 'Study', colorKey: 'study', ms: 761 * M },
      { topicId: health.id, name: 'Health', colorKey: 'health', ms: 70 * M },
      { topicId: REMOVED_TOPICS_ID, name: 'Removed topics', colorKey: 'none', ms: 37 * M },
    ]);

    // planned (timed rows in W): A 14 rows x 30 + the carried one (Oct 15) 10 = 430 min, focus 761.
    //   H: Oct 20 20, Oct 21 10 (carried), Oct 22 10 (carried), Oct 27 20, Oct 28 20 (carried), Nov 3 20 = 100, focus 70.
    //   Z: Oct 14 15, Oct 21 15, Oct 28 15, Oct 29 3 (carried) = 48, focus 37.
    expect(ins.planned).toEqual([
      { topicId: study.id, name: 'Study', colorKey: 'study', plannedMs: 430 * M, focusedMs: 761 * M },
      { topicId: health.id, name: 'Health', colorKey: 'health', plannedMs: 100 * M, focusedMs: 70 * M },
      { topicId: REMOVED_TOPICS_ID, name: 'Removed topics', colorKey: 'none', plannedMs: 48 * M, focusedMs: 37 * M },
    ]);

    // sessions (18, minutes): 10 10 12 | 15 15 20 20 20 25 25 | 30 30 31 | 45 50 | 60 120 330. Median = mean of the
    // 9th and 10th (25, 25) = 25. Bins [<5, 5-14, 15-29, 30-44, 45-59, 60+] = [0, 3, 7, 3, 2, 3].
    expect(ins.sessions).toEqual({ count: 18, medianMs: 25 * M, bins: [0, 3, 7, 3, 2, 3] });

    // weeks (Mon..Sun): Oct 12 (Oct 14-18, 5 days) | Oct 19 | Oct 26 (Oct 26 - Nov 1) | Nov 2 | Nov 9 (Nov 9-12, 4 days)
    const weeks: [string, number][] = [
      ['2026-10-12', 5], ['2026-10-19', 7], ['2026-10-26', 7], ['2026-11-02', 7], ['2026-11-09', 4],
    ];
    const wk = <K extends string>(key: K, ns: number[], scale = 1) =>
      weeks.map(([weekStart, daysInWindow], i) => ({ weekStart, daysInWindow, [key]: ns[i] * scale }));
    // trend (min): 45+30+330 = 405 | 70+25 = 95 | 25+31+132+30+20 = 238 | 50 | 35+45 = 80   (sum 868)
    expect(ins.trend).toEqual(wk('ms', [405, 95, 238, 50, 80], M));

    // showed up (items >= 1): yes Oct 14 15 18 20 21 22 26 27 28 31, Nov 3 9 11 12 = 14. No: the empty rows (Oct 16, 23,
    // 29, Nov 4, 10) and Nov 1 (A 20 of 30 min, C not ticked).
    // by week: 3 (14 15 18) | 3 (20 21 22) | 4 (26 27 28 31) | 1 (Nov 3) | 3 (9 11 12)
    expect(ins.showedUp.total).toBe(14);
    expect(ins.showedUp.byWeek).toEqual(wk('days', [3, 3, 4, 1, 3]));

    // gold rings (>= 1 min over budget): Oct 14 Z, Oct 15 A, Oct 18 A, Oct 20 A, Oct 27 A (exactly 1 min), Oct 28 A,
    // Nov 3 H, Nov 9 A, Nov 12 A (live) = 9, one per day. Not gold: Oct 22 H (0 over), Oct 31 A (0 over), Oct 26, Nov 1.
    // by week: 3 | 1 | 2 | 1 | 2
    expect(ins.gold.rings).toBe(9);
    expect(ins.gold.days).toBe(9);
    const goldWeeks = [3, 1, 2, 1, 2];
    expect(ins.gold.byWeek).toEqual(
      weeks.map(([weekStart, daysInWindow], i) => ({ weekStart, daysInWindow, rings: goldWeeks[i], days: goldWeeks[i] })),
    );

    // carry (closed days only): moved Oct 14 A, Oct 20 H, Oct 21 H, Oct 27 H, Oct 28 Z = 5.
    // let go: Oct 15 C, Oct 20 C, Oct 21 A+Z, Oct 22 A+C, Oct 28 H, Nov 1 C (auto-close), Nov 3 A, Nov 11 A = 10.
    // by week moved: 1 | 2 | 2 | 0 | 0, let go: 1 | 5 | 2 | 1 | 1. Today (open) adds nothing.
    const moved = [1, 2, 2, 0, 0];
    const letGo = [1, 5, 2, 1, 1];
    expect(ins.carry.moved).toBe(5);
    expect(ins.carry.letGo).toBe(10);
    expect(ins.carry.byWeek).toEqual(
      weeks.map(([weekStart, daysInWindow], i) => ({ weekStart, daysInWindow, moved: moved[i], letGo: letGo[i] })),
    );

    // checks (closed days): ticked Oct 14 18 21 26 27 28 31, Nov 3 9 11 = 10; not ticked Oct 15 20 22, Nov 1 = 4.
    // Nov 12's C is unticked but that day is still open: not counted.
    expect(ins.checks).toEqual({ ticked: 10, notTicked: 4 });

    // records: best day Oct 18 (330 min); longest session the same run (A, 330 min); longest run of showed-up days:
    // Oct 20-22 (3) and Oct 26-28 (3) tie -> the latest, ending Oct 28.
    expect(ins.records).toEqual({
      bestDay: { dayKey: '2026-10-18', ms: 330 * M },
      longestSession: { dayKey: '2026-10-18', taskName: 'A', ms: 330 * M },
      longestRun: { days: 3, endDayKey: '2026-10-28' },
    });
  });

  it('cross-checks: showed up, trend and hours against the rules read through the repos; before-window days add nothing', () => {
    const { at } = playStory();
    const ins = loadInsights(at);
    const today = '2026-11-12';
    const rows = listDays(db, addDays(today, -29), today);
    expect(rows).toHaveLength(20);

    const bundles = rows.map((d) => loadDayBundle(db, d.dayKey)!);
    expect(ins.showedUp.total).toBe(bundles.filter((b) => collectionItems(b, at).length >= 1).length);
    expect(ins.showedUp.byWeek.reduce((n, w) => n + w.days, 0)).toBe(ins.showedUp.total);

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(ins.trend.map((w) => w.ms))).toBe(ins.totalFocusMs);
    expect(sum(ins.hours.msByHour)).toBe(ins.totalFocusMs);
    expect(sum(ins.weekdays.totalMs)).toBe(ins.totalFocusMs);
    expect(sum(ins.topics.map((r) => r.ms))).toBe(ins.totalFocusMs);
    expect(sum(ins.sessions.bins)).toBe(ins.sessions.count);

    // Lifetime focus (every row ever) is the window plus Oct 8 (60 min) and Oct 13 (40 min); Oct 9 is an empty row.
    const all = listDays(db, '0000-01-01', today).map((d) => loadDayBundle(db, d.dayKey)!);
    const lifetime = sum(all.flatMap((b) => Object.values(b.sessionsByDayTask).map((s) => focusedMs(s, at))));
    expect(lifetime - ins.totalFocusMs).toBe(100 * M);
    expect(all.filter((b) => b.day.dayKey < '2026-10-14').map((b) => b.day.dayKey)).toEqual(['2026-10-08', '2026-10-09', '2026-10-13']);

    // Auto-closed days (never closed by hand) are exactly the ones the story left open.
    const auto = bundles.filter((b) => b.day.closedBy === 'auto').map((b) => b.day.dayKey);
    expect(auto).toEqual(['2026-10-16', '2026-10-18', '2026-10-23', '2026-10-26', '2026-10-29', '2026-10-31', '2026-11-01', '2026-11-04', '2026-11-10']);
    expect(bundles.find((b) => b.day.dayKey === '2026-11-12')!.day.closedAt).toBeNull();
    // The day-start change: rows from Oct 28 snapshot 06:00, earlier ones 04:00.
    expect(bundles.filter((b) => b.day.dayStartHour === 6).map((b) => b.day.dayKey)).toEqual([
      '2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-10',
      '2026-11-11', '2026-11-12',
    ]);
    expect(bundles.filter((b) => b.day.dayKey <= '2026-10-27').every((b) => b.day.dayStartHour === 4)).toBe(true);
  });

  it('a later `at` counts the still-running session further (live)', () => {
    const { at } = playStory();
    // 30 minutes later the same open session is 30 minutes longer: focus and hour 9 grow, 45 min -> 75 min moves bins.
    const base = loadInsights(at);
    const later = loadInsights(at + 30 * M);
    expect(later.totalFocusMs - base.totalFocusMs).toBe(30 * M);
    expect(later.hours.msByHour[9] - base.hours.msByHour[9]).toBe(30 * M);
    expect(later.sessions.bins).toEqual([0, 3, 7, 3, 1, 4]);
  });
});
