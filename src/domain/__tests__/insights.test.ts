import { computeInsights } from '../insights';
import type { InsightsInput } from '../insights';
import type { ColorKey, DayBundle, DayKey, DayTask, Epoch, Topic } from '../types';

// jest.global-setup.js runs the suite in America/New_York; every epoch is built from local wall-clock
// parts with new Date(y, m, d, h, min), so the expectations below hold in any zone.

const MIN = 60_000;

/** Local wall-clock instant on a dayKey (plus optional extra ms). */
function ms(key: DayKey, h: number, min = 0, extra = 0): Epoch {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, h, min).getTime() + extra;
}

const topic = (id: string, name: string, colorKey: ColorKey, deletedAt: Epoch | null = null): Topic => ({
  id, name, colorKey, sortOrder: 0, isOpen: true, deletedAt,
});
const TOPICS: Topic[] = [
  topic('study', 'Study', 'study'),
  topic('health', 'Health', 'health'),
  topic('no-topic', 'No topic', 'none'),
  topic('gone', 'Old topic', 'home', 1),
];

function task(id: string, o: Partial<DayTask> = {}): DayTask {
  return {
    id, dayKey: '2026-10-08', taskId: null, topicId: 'study', name: id, colorKey: 'study', kind: 'timed',
    budgetSec: 1800, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt: null,
    closeOutcome: null, sortOrder: 0, ...o,
  };
}

type Spans = Record<string, [Epoch, Epoch | null][]>;
interface BundleOpts {
  tasks?: DayTask[];
  sessions?: Spans;
  closed?: boolean;
  confirmed?: boolean;
  hour?: number;
}
function bundle(key: DayKey, o: BundleOpts = {}): DayBundle {
  const tasks = (o.tasks ?? []).map((t) => ({ ...t, dayKey: key }));
  return {
    day: {
      dayKey: key,
      planConfirmedAt: o.confirmed === false ? null : ms(key, 3),
      planDraftedAt: null,
      planUpdatedAt: null,
      closedAt: o.closed ? ms(key, 23) : null,
      closedBy: o.closed ? 'user' : null,
      dayStartHour: o.hour ?? 4,
    },
    dayTasks: tasks,
    sessionsByDayTask: Object.fromEntries(
      tasks.map((t) => [
        t.id,
        (o.sessions?.[t.id] ?? []).map(([startedAt, endedAt], i) => ({ id: `${t.id}-${i}`, dayTaskId: t.id, startedAt, endedAt })),
      ]),
    ),
  };
}

const TODAY = '2026-11-05'; // a Thursday
const AT = ms(TODAY, 12);
function run(days: DayBundle[], over: Partial<InsightsInput> = {}) {
  return computeInsights({ todayKey: TODAY, at: AT, days, topics: TOPICS, ...over });
}

// W = 2026-10-07 (Wed) .. 2026-11-05 (Thu). Weeks (Mon-Sun): 10-05 (Wed-Sun, 5 days), 10-12, 10-19, 10-26 (7 each),
// 11-02 (Mon-Thu, 4 days): 5+7+7+7+4 = 30. Weekday counts: Wed and Thu occur 5 times, the others 4.
const WEEKS = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'];
const DAYS_IN = [5, 7, 7, 7, 4];
const buckets = <T extends object>(vals: T[]) => WEEKS.map((weekStart, i) => ({ weekStart, daysInWindow: DAYS_IN[i], ...vals[i] }));

/**
 * The fixture. Sessions (length, minutes unless noted):
 *   10-08 (Thu, wk 10-05, closed, hour 4)  a1 Read  study  budget 30: 09:00-09:40 (40) -> gold (10 over)
 *                                          a2 Stretch check no-topic ticked; a3 Walk health budget 10, moved
 *   10-14 (Wed, wk 10-12, closed, hour 6)  b1 Write study budget 60: 06:30-06:40 (10), 14:50-15:20 (30), let_go
 *                                          b2 Tidy check study not ticked, let_go
 *   10-15 (Thu, wk 10-12, closed, plan not confirmed, nothing done)  c1 Call check, unknown topic, moved
 *   10-20 (Tue, wk 10-19, closed)          d1 Practice deleted topic 'gone' (colour home) budget 60: 23:30-00:30 (60)
 *                                          d2 Run health budget 20: 10:00-10:04:59.999 (299 999 ms), 11:00-11:05:00 (300 000 ms)
 *   10-25 (Sun, wk 10-19, OPEN)            e1 moved and e2 ticked: not counted, the day is not closed
 *   10-28 (Wed, wk 10-26, closed)          f1 Draft study budget 15: 08:00-08:10, 08:20-08:30 (20) -> gold (5 over)
 *                                          f2 Jog health budget 10: 09:00-09:12 (12) -> gold (2 over)
 *   11-03 (Tue, wk 11-02, closed auto, plan not confirmed)  g1 Water check no-topic ticked (shows up through the tick)
 *   11-04 (Wed, wk 11-02, closed)          i1 Plan trip no-topic budget 30, no sessions, let_go
 *   11-05 (Thu, today, OPEN)               j1 Gym health budget 60: 08:15-08:45 (30), 11:30-open (30 up to at = 12:00)
 *   10-06 and 11-06 are outside W: each has a session and must change nothing.
 */
function fixture(): DayBundle[] {
  return [
    bundle('2026-10-06', { tasks: [task('x1', { completedAt: 1 })], sessions: { x1: [[ms('2026-10-06', 9), ms('2026-10-06', 11)]] } }),
    bundle('2026-10-08', {
      closed: true,
      tasks: [
        task('a1', { name: 'Read', completedAt: ms('2026-10-08', 9, 30) }),
        task('a2', { name: 'Stretch', kind: 'check', topicId: 'no-topic', colorKey: 'none', budgetSec: 0, completedAt: ms('2026-10-08', 9, 50) }),
        task('a3', { name: 'Walk', topicId: 'health', colorKey: 'health', budgetSec: 600, closeOutcome: 'moved' }),
      ],
      sessions: { a1: [[ms('2026-10-08', 9), ms('2026-10-08', 9, 40)]] },
    }),
    bundle('2026-10-14', {
      closed: true,
      hour: 6,
      tasks: [
        task('b1', { name: 'Write', budgetSec: 3600, closeOutcome: 'let_go' }),
        task('b2', { name: 'Tidy', kind: 'check', budgetSec: 0, closeOutcome: 'let_go' }),
      ],
      sessions: { b1: [[ms('2026-10-14', 6, 30), ms('2026-10-14', 6, 40)], [ms('2026-10-14', 14, 50), ms('2026-10-14', 15, 20)]] },
    }),
    bundle('2026-10-15', {
      closed: true,
      confirmed: false,
      tasks: [task('c1', { name: 'Call', kind: 'check', topicId: 'unknown-topic', colorKey: 'c4', budgetSec: 0, closeOutcome: 'moved' })],
    }),
    bundle('2026-10-20', {
      closed: true,
      tasks: [
        task('d1', { name: 'Practice', topicId: 'gone', colorKey: 'home', budgetSec: 3600, completedAt: ms('2026-10-21', 0, 30) }),
        task('d2', { name: 'Run', topicId: 'health', colorKey: 'health', budgetSec: 1200 }),
      ],
      sessions: {
        d1: [[ms('2026-10-20', 23, 30), ms('2026-10-21', 0, 30)]],
        d2: [[ms('2026-10-20', 10), ms('2026-10-20', 10, 4, 59_999)], [ms('2026-10-20', 11), ms('2026-10-20', 11, 5)]],
      },
    }),
    bundle('2026-10-25', {
      tasks: [
        task('e1', { kind: 'check', budgetSec: 0, closeOutcome: 'moved' }),
        task('e2', { kind: 'check', budgetSec: 0, completedAt: ms('2026-10-25', 9) }),
      ],
    }),
    bundle('2026-10-28', {
      closed: true,
      tasks: [
        task('f1', { name: 'Draft', budgetSec: 900, completedAt: ms('2026-10-28', 8, 15) }),
        task('f2', { name: 'Jog', topicId: 'health', colorKey: 'health', budgetSec: 600, completedAt: ms('2026-10-28', 9, 10) }),
      ],
      sessions: {
        f1: [[ms('2026-10-28', 8), ms('2026-10-28', 8, 10)], [ms('2026-10-28', 8, 20), ms('2026-10-28', 8, 30)]],
        f2: [[ms('2026-10-28', 9), ms('2026-10-28', 9, 12)]],
      },
    }),
    bundle('2026-11-03', {
      closed: true,
      confirmed: false,
      tasks: [task('g1', { name: 'Water', kind: 'check', topicId: 'no-topic', colorKey: 'none', budgetSec: 0, completedAt: ms('2026-11-03', 10) })],
    }),
    bundle('2026-11-04', {
      closed: true,
      tasks: [task('i1', { name: 'Plan trip', topicId: 'no-topic', colorKey: 'none', closeOutcome: 'let_go' })],
    }),
    bundle(TODAY, {
      tasks: [task('j1', { name: 'Gym', topicId: 'health', colorKey: 'health', budgetSec: 3600 })],
      sessions: { j1: [[ms(TODAY, 8, 15), ms(TODAY, 8, 45)], [ms(TODAY, 11, 30), null]] },
    }),
    bundle('2026-11-06', { tasks: [task('y1', { completedAt: 1 })], sessions: { y1: [[ms('2026-11-06', 9), ms('2026-11-06', 11)]] } }),
  ];
}

describe('computeInsights: hand-worked fixture', () => {
  // Session lengths in ms: 2 400 000 (a1), 600 000 + 1 800 000 (b1), 3 600 000 (d1), 299 999 + 300 000 (d2),
  // 600 000 + 600 000 (f1), 720 000 (f2), 1 800 000 + 1 800 000 (j1, the open one up to 12:00).
  // Day focus: 10-08 2 400 000 | 10-14 2 400 000 | 10-20 3 600 000 + 599 999 = 4 199 999 | 10-28 1 920 000 | 11-05 3 600 000.
  // Total: 2 400 000 + 2 400 000 + 4 199 999 + 1 920 000 + 3 600 000 = 14 519 999.
  const r = run(fixture());

  it('window and total', () => {
    expect(r.windowStart).toBe('2026-10-07');
    expect(r.windowEnd).toBe('2026-11-05');
    expect(r.totalFocusMs).toBe(14_519_999);
  });

  it('hours: split at clock-hour boundaries, sums to the total', () => {
    // h0 30 min (d1 after midnight) | h6 10 min | h8 f1 20 min + j1a 30 min = 50 min | h9 a1 40 + f2 12 = 52 min
    // h10 299 999 | h11 300 000 + j1b 30 min = 2 100 000 | h14 10 min (b1) | h15 20 min (b1) | h23 30 min (d1)
    const h = new Array<number>(24).fill(0);
    h[0] = 1_800_000; h[6] = 600_000; h[8] = 3_000_000; h[9] = 3_120_000; h[10] = 299_999; h[11] = 2_100_000;
    h[14] = 600_000; h[15] = 1_200_000; h[23] = 1_800_000;
    expect(r.hours.msByHour).toEqual(h);
    expect(r.hours.msByHour.reduce((a, b) => a + b, 0)).toBe(r.totalFocusMs);
  });

  it('weekdays: totals, day counts (4 or 5), averages', () => {
    // Tue 10-20 4 199 999 | Wed 10-14 2 400 000 + 10-28 1 920 000 = 4 320 000 | Thu 10-08 2 400 000 + 11-05 3 600 000 = 6 000 000
    expect(r.weekdays.totalMs).toEqual([0, 4_199_999, 4_320_000, 6_000_000, 0, 0, 0]);
    expect(r.weekdays.dayCount).toEqual([4, 4, 5, 5, 4, 4, 4]);
    expect(r.weekdays.avgMs).toEqual([0, 4_199_999 / 4, 4_320_000 / 5, 6_000_000 / 5, 0, 0, 0]);
  });

  it('firstStart: earliest start minus the day start, median', () => {
    // 10-08 09:00 - 04:00 = 300 | 10-14 06:30 - 06:00 (its own hour) = 30 | 10-20 earliest is 10:00 (d2), 10:00 - 04:00 = 360
    // 10-28 08:00 - 04:00 = 240 | 11-05 08:15 - 04:00 = 255. Sorted 30, 240, 255, 300, 360 -> median 255.
    expect(r.firstStart).toEqual({
      days: [
        { dayKey: '2026-10-08', minutes: 300 },
        { dayKey: '2026-10-14', minutes: 30 },
        { dayKey: '2026-10-20', minutes: 360 },
        { dayKey: '2026-10-28', minutes: 240 },
        { dayKey: TODAY, minutes: 255 },
      ],
      medianMinutes: 255,
    });
  });

  it('topics: focus per topic, a deleted topic in the one Removed topics row', () => {
    // study a1 2 400 000 + b1 2 400 000 + f1 1 200 000 = 6 000 000 | health d2 599 999 + f2 720 000 + j1 3 600 000 = 4 919 999
    // gone (deleted) d1 3 600 000. No topic has no focus, so it is left out.
    expect(r.topics).toEqual([
      { topicId: 'study', name: 'Study', colorKey: 'study', ms: 6_000_000 },
      { topicId: 'health', name: 'Health', colorKey: 'health', ms: 4_919_999 },
      { topicId: 'removed', name: 'Removed topics', colorKey: 'none', ms: 3_600_000 },
    ]);
  });

  it('planned: timed day-tasks only, per topic', () => {
    // study planned a1 1 800 000 + b1 3 600 000 + f1 900 000 = 6 300 000, focus 6 000 000
    // health planned a3 600 000 + d2 1 200 000 + f2 600 000 + j1 3 600 000 = 6 000 000, focus 4 919 999
    // gone planned d1 3 600 000, focus 3 600 000 | no-topic planned i1 1 800 000, focus 0 (the check tasks add nothing)
    expect(r.planned).toEqual([
      { topicId: 'study', name: 'Study', colorKey: 'study', plannedMs: 6_300_000, focusedMs: 6_000_000 },
      { topicId: 'health', name: 'Health', colorKey: 'health', plannedMs: 6_000_000, focusedMs: 4_919_999 },
      { topicId: 'removed', name: 'Removed topics', colorKey: 'none', plannedMs: 3_600_000, focusedMs: 3_600_000 },
      { topicId: 'no-topic', name: 'No topic', colorKey: 'none', plannedMs: 1_800_000, focusedMs: 0 },
    ]);
  });

  it('sessions: count, median, bins', () => {
    // 11 sessions, sorted: 299 999, 300 000, 600 000 x3, 720 000, 1 800 000 x3, 2 400 000, 3 600 000 -> median (6th) 720 000.
    // Bins <5: 299 999 | 5-14: 300 000, 3 x 10 min, 12 min = 5 | 15-29: 0 | 30-44: 3 x 30 min, 40 min = 4 | 45-59: 0 | 60+: 1
    expect(r.sessions).toEqual({ count: 11, medianMs: 720_000, bins: [1, 5, 0, 4, 0, 1] });
  });

  it('trend and showed up by week', () => {
    // Weekly focus: 10-05 2 400 000 | 10-12 2 400 000 | 10-19 4 199 999 | 10-26 1 920 000 | 11-02 3 600 000
    expect(r.trend).toEqual(buckets([{ ms: 2_400_000 }, { ms: 2_400_000 }, { ms: 4_199_999 }, { ms: 1_920_000 }, { ms: 3_600_000 }]));
    expect(r.trend.reduce((a, w) => a + w.ms, 0)).toBe(r.totalFocusMs);
    // Showed up: 10-08, 10-14, 10-20, 10-25, 10-28, 11-03 (tick), 11-04, 11-05 = 8; 10-15 did nothing; 10-06/11-06 are outside.
    expect(r.showedUp).toEqual({ total: 8, byWeek: buckets([{ days: 1 }, { days: 1 }, { days: 2 }, { days: 1 }, { days: 3 }]) });
  });

  it('gold: rings (a1, f1, f2) and days (10-08, 10-28)', () => {
    // j1 is exactly on budget (60 min, no overtime) and b1/d1/d2 are under: no ring.
    expect(r.gold).toEqual({
      rings: 3,
      days: 2,
      byWeek: buckets([{ rings: 1, days: 1 }, { rings: 0, days: 0 }, { rings: 0, days: 0 }, { rings: 2, days: 1 }, { rings: 0, days: 0 }]),
    });
  });

  it('carry and checks: closed days only', () => {
    // moved: a3 (10-08), c1 (10-15) = 2; let go: b1, b2 (10-14), i1 (11-04) = 3. e1 (10-25) is on an open day.
    expect(r.carry).toEqual({
      moved: 2,
      letGo: 3,
      byWeek: buckets([
        { moved: 1, letGo: 0 }, { moved: 1, letGo: 2 }, { moved: 0, letGo: 0 }, { moved: 0, letGo: 0 }, { moved: 0, letGo: 1 },
      ]),
    });
    // ticked: a2, g1 = 2; not ticked: b2, c1 = 2. e1/e2 (open day) are not counted.
    expect(r.checks).toEqual({ ticked: 2, notTicked: 2 });
  });

  it('records', () => {
    // Best day 10-20 (4 199 999). Longest session d1, 3 600 000. Showed-up runs: 11-03, 11-04, 11-05 = 3, the rest are 1.
    expect(r.records).toEqual({
      bestDay: { dayKey: '2026-10-20', ms: 4_199_999 },
      longestSession: { dayKey: '2026-10-20', taskName: 'Practice', ms: 3_600_000 },
      longestRun: { days: 3, endDayKey: TODAY },
    });
  });
});

describe('hour splitting', () => {
  it('splits a session across an hour boundary', () => {
    const b = bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 10, 50), ms('2026-11-02', 11, 10)]] } });
    const h = run([b]).hours.msByHour;
    expect(h[10]).toBe(10 * MIN);
    expect(h[11]).toBe(10 * MIN);
  });

  it('splits a session across midnight and keeps it on its day-task day', () => {
    const b = bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 23, 50), ms('2026-11-03', 0, 20)]] } });
    const r = run([b]);
    expect(r.hours.msByHour[23]).toBe(10 * MIN);
    expect(r.hours.msByHour[0]).toBe(20 * MIN);
    expect(r.weekdays.totalMs[0]).toBe(30 * MIN); // 2026-11-02 is a Monday
    expect(r.records.bestDay).toEqual({ dayKey: '2026-11-02', ms: 30 * MIN });
  });

  it('counts an open session up to at, split at the hour', () => {
    const b = bundle(TODAY, { tasks: [task('t')], sessions: { t: [[ms(TODAY, 10, 50), null]] } });
    const r = run([b], { at: ms(TODAY, 11, 20) });
    expect(r.hours.msByHour[10]).toBe(10 * MIN);
    expect(r.hours.msByHour[11]).toBe(20 * MIN);
    expect(r.sessions.medianMs).toBe(30 * MIN);
    expect(r.totalFocusMs).toBe(30 * MIN);
  });
});

describe('window and rows', () => {
  it('ignores bundles outside W everywhere', () => {
    const out = ['2026-10-06', '2026-11-06'].map((k) =>
      bundle(k, { closed: true, tasks: [task(`t${k}`, { completedAt: 1, closeOutcome: 'moved' })], sessions: { [`t${k}`]: [[ms(k, 9), ms(k, 10)]] } }),
    );
    const r = run(out);
    expect(r.totalFocusMs).toBe(0);
    expect(r.sessions.count).toBe(0);
    expect(r.showedUp.total).toBe(0);
    expect(r.carry.moved).toBe(0);
    expect(r.topics).toEqual([]);
    expect(r.records).toEqual({ bestDay: null, longestSession: null, longestRun: null });
  });

  it('a bundle with no sessions shows up (plan confirmed) but adds no focus', () => {
    const r = run([bundle('2026-11-02', { tasks: [task('t')] })]);
    expect(r.showedUp.total).toBe(1);
    expect(r.totalFocusMs).toBe(0);
    expect(r.firstStart).toEqual({ days: [], medianMinutes: null });
    expect(r.sessions).toEqual({ count: 0, medianMs: null, bins: [0, 0, 0, 0, 0, 0] });
    expect(r.records.longestRun).toEqual({ days: 1, endDayKey: '2026-11-02' });
    expect(r.records.bestDay).toBeNull();
  });

  it('an unknown topicId and a deleted topic share the one Removed topics row, in topics and in planned', () => {
    const b = bundle('2026-11-02', {
      tasks: [task('u', { topicId: 'nope', colorKey: 'c5' }), task('v', { topicId: 'gone', colorKey: 'sun', budgetSec: 3600 })],
      sessions: { u: [[ms('2026-11-02', 9), ms('2026-11-02', 10)]], v: [[ms('2026-11-02', 11), ms('2026-11-02', 11, 30)]] },
    });
    const r = run([b]);
    // 60 + 30 min in one row; planned 30 min (u, default 1800 s) + 60 min (v) = 90 min.
    expect(r.topics).toEqual([{ topicId: 'removed', name: 'Removed topics', colorKey: 'none', ms: 90 * MIN }]);
    expect(r.planned).toEqual([{ topicId: 'removed', name: 'Removed topics', colorKey: 'none', plannedMs: 90 * MIN, focusedMs: 90 * MIN }]);
  });

  it('topic ties are ordered by name', () => {
    const b = bundle('2026-11-02', {
      tasks: [task('h', { topicId: 'health' }), task('s', { topicId: 'study' })],
      sessions: { h: [[ms('2026-11-02', 9), ms('2026-11-02', 10)]], s: [[ms('2026-11-02', 11), ms('2026-11-02', 12)]] },
    });
    expect(run([b]).topics.map((t) => t.name)).toEqual(['Health', 'Study']);
  });

  it('a first start before the day start clamps to 0', () => {
    const b = bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 3, 30), ms('2026-11-02', 3, 45)]] } });
    expect(run([b]).firstStart.days).toEqual([{ dayKey: '2026-11-02', minutes: 0 }]);
  });
});

describe('medians', () => {
  const startsAt = (key: DayKey, h: number, min: number) =>
    bundle(key, { tasks: [task('t')], sessions: { t: [[ms(key, h, min), ms(key, h, min + 1)]] } });

  it('first start, odd count: the middle value', () => {
    // minutes after 04:00: 10, 30, 20 -> sorted 10, 20, 30 -> 20
    const r = run([startsAt('2026-11-01', 4, 10), startsAt('2026-11-02', 4, 30), startsAt('2026-11-03', 4, 20)]);
    expect(r.firstStart.medianMinutes).toBe(20);
  });

  it('first start, even count: mean of the middle two, rounded to the nearest minute', () => {
    expect(run([startsAt('2026-11-01', 4, 10), startsAt('2026-11-02', 4, 15)]).firstStart.medianMinutes).toBe(13); // 12.5
    expect(run([startsAt('2026-11-01', 4, 10), startsAt('2026-11-02', 4, 14)]).firstStart.medianMinutes).toBe(12); // exactly 12
  });

  it('session length, even count rounds to the nearest ms; odd count takes the middle', () => {
    const mk = (lens: number[]) =>
      run([bundle('2026-11-02', { tasks: [task('t')], sessions: { t: lens.map((l, i) => [ms('2026-11-02', 9 + i), ms('2026-11-02', 9 + i, 0, l)]) } })]);
    expect(mk([1000, 1001]).sessions.medianMs).toBe(1001); // 1000.5
    expect(mk([5000, 1000, 3000]).sessions.medianMs).toBe(3000);
  });
});

describe('session bins', () => {
  it('uses lower-inclusive boundaries at 5, 15, 30, 45 and 60 minutes', () => {
    const lens = [299_999, 300_000, 899_999, 900_000, 1_799_999, 1_800_000, 2_699_999, 2_700_000, 3_599_999, 3_600_000];
    const b = bundle('2026-11-02', {
      tasks: [task('t')],
      sessions: { t: lens.map((l, i) => [ms('2026-11-02', 5 + i), ms('2026-11-02', 5 + i, 0, l)]) },
    });
    expect(run([b]).sessions.bins).toEqual([1, 2, 2, 2, 2, 1]);
  });
});

describe('records: ties', () => {
  it('best day: the earliest day wins a tie', () => {
    const mk = (k: DayKey) => bundle(k, { tasks: [task('t')], sessions: { t: [[ms(k, 9), ms(k, 10)]] } });
    const r = run([mk('2026-11-03'), mk('2026-11-01')]); // passed out of order on purpose
    expect(r.records.bestDay).toEqual({ dayKey: '2026-11-01', ms: 60 * MIN });
  });

  it('longest session: the earliest startedAt wins a tie, across days and within a day', () => {
    const early = bundle('2026-11-01', { tasks: [task('a', { name: 'Early' })], sessions: { a: [[ms('2026-11-01', 9), ms('2026-11-01', 9, 20)]] } });
    const late = bundle('2026-11-03', { tasks: [task('b', { name: 'Late' })], sessions: { b: [[ms('2026-11-03', 9), ms('2026-11-03', 9, 20)]] } });
    expect(run([late, early]).records.longestSession).toEqual({ dayKey: '2026-11-01', taskName: 'Early', ms: 20 * MIN });

    // Same day, the later session listed first.
    const same = bundle('2026-11-02', {
      tasks: [task('x', { name: 'Later' }), task('y', { name: 'Sooner' })],
      sessions: { x: [[ms('2026-11-02', 15), ms('2026-11-02', 15, 20)]], y: [[ms('2026-11-02', 8), ms('2026-11-02', 8, 20)]] },
    });
    expect(run([same]).records.longestSession).toEqual({ dayKey: '2026-11-02', taskName: 'Sooner', ms: 20 * MIN });
  });

  it('longest run: the latest of equal runs wins', () => {
    const d = (k: DayKey) => bundle(k, { tasks: [task('t')] });
    // 10-20, 10-21 (run of 2) | gap | 11-01, 11-02 (run of 2) | 11-04 alone
    const r = run([d('2026-10-20'), d('2026-10-21'), d('2026-11-01'), d('2026-11-02'), d('2026-11-04')]);
    expect(r.records.longestRun).toEqual({ days: 2, endDayKey: '2026-11-02' });
  });
});

describe('gold and closed days', () => {
  it('gold needs at least 60 000 ms over budget (isGold)', () => {
    const mk = (over: number) =>
      run([bundle('2026-11-02', { tasks: [task('t', { budgetSec: 600 })], sessions: { t: [[ms('2026-11-02', 9), ms('2026-11-02', 9, 10, over)]] } })]);
    expect(mk(60_000).gold.rings).toBe(1);
    expect(mk(59_999).gold.rings).toBe(0);
  });

  it('check tasks never count as rings; carry and checks ignore open days', () => {
    const tasks = [task('c', { kind: 'check', budgetSec: 0, closeOutcome: 'let_go' })];
    const open = run([bundle('2026-11-02', { tasks })]);
    expect(open.gold.rings).toBe(0);
    expect(open.carry).toMatchObject({ moved: 0, letGo: 0 });
    expect(open.checks).toEqual({ ticked: 0, notTicked: 0 });
    const closed = run([bundle('2026-11-02', { tasks, closed: true })]);
    expect(closed.carry).toMatchObject({ moved: 0, letGo: 1 });
    expect(closed.checks).toEqual({ ticked: 0, notTicked: 1 });
  });
});

describe('empty input', () => {
  it('gives zeros, nulls and fixed-length arrays', () => {
    const r = run([], { topics: [] });
    expect(r.windowStart).toBe('2026-10-07');
    expect(r.windowEnd).toBe(TODAY);
    expect(r.totalFocusMs).toBe(0);
    expect(r.hours.msByHour).toEqual(new Array(24).fill(0));
    expect(r.weekdays.totalMs).toEqual(new Array(7).fill(0));
    expect(r.weekdays.dayCount).toEqual([4, 4, 5, 5, 4, 4, 4]);
    expect(r.weekdays.avgMs).toEqual(new Array(7).fill(0));
    expect(r.firstStart).toEqual({ days: [], medianMinutes: null });
    expect(r.topics).toEqual([]);
    expect(r.planned).toEqual([]);
    expect(r.sessions).toEqual({ count: 0, medianMs: null, bins: [0, 0, 0, 0, 0, 0] });
    expect(r.trend).toEqual(buckets(WEEKS.map(() => ({ ms: 0 }))));
    expect(r.showedUp).toEqual({ total: 0, byWeek: buckets(WEEKS.map(() => ({ days: 0 }))) });
    expect(r.gold).toEqual({ rings: 0, days: 0, byWeek: buckets(WEEKS.map(() => ({ rings: 0, days: 0 }))) });
    expect(r.carry).toEqual({ moved: 0, letGo: 0, byWeek: buckets(WEEKS.map(() => ({ moved: 0, letGo: 0 }))) });
    expect(r.checks).toEqual({ ticked: 0, notTicked: 0 });
    expect(r.records).toEqual({ bestDay: null, longestSession: null, longestRun: null });
  });

  it('makes 6 week buckets when W starts on a Sunday and ends on a Monday, summing to 30 days', () => {
    // today Mon 2026-11-09 -> W starts Sun 2026-10-11: weeks 10-05 (1 day), 10-12, 10-19, 10-26, 11-02 (7 each), 11-09 (1 day)
    const r = run([], { todayKey: '2026-11-09', at: ms('2026-11-09', 12) });
    expect(r.windowStart).toBe('2026-10-11');
    expect(r.trend.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(r.trend.map((w) => w.daysInWindow)).toEqual([1, 7, 7, 7, 7, 1]);
    expect(r.trend.reduce((a, w) => a + w.daysInWindow, 0)).toBe(30);
    expect(r.showedUp.byWeek).toHaveLength(6);
    expect(r.gold.byWeek).toHaveLength(6);
    expect(r.carry.byWeek).toHaveLength(6);
  });

  it('week buckets of the 5-week window sum to 30 days', () => {
    expect(run([]).trend.reduce((a, w) => a + w.daysInWindow, 0)).toBe(30);
  });
});

describe('edges (checker A gaps)', () => {
  it('a session that ends before it starts counts as 0 everywhere', () => {
    const b = bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 10), ms('2026-11-02', 9)]] } });
    const r = run([b]);
    expect(r.totalFocusMs).toBe(0);
    expect(r.hours.msByHour.every((v) => v === 0)).toBe(true);
    expect(r.sessions).toEqual({ count: 1, medianMs: 0, bins: [1, 0, 0, 0, 0, 0] });
    expect(r.records.longestSession).toBeNull();
  });

  it('today on a Sunday gives 5 week buckets of 2+7+7+7+7 days', () => {
    // 2026-11-08 is a Sunday: W = 10-10 (Sat) .. 11-08.
    const r = computeInsights({ todayKey: '2026-11-08', at: ms('2026-11-08', 12), days: [], topics: TOPICS });
    expect(r.trend.map((w) => [w.weekStart, w.daysInWindow])).toEqual([
      ['2026-10-05', 2], ['2026-10-12', 7], ['2026-10-19', 7], ['2026-10-26', 7], ['2026-11-02', 7],
    ]);
  });

  it('the first day of the window counts; the day before does not', () => {
    const k = '2026-10-07';
    const inW = bundle(k, { tasks: [task('t')], sessions: { t: [[ms(k, 9), ms(k, 9, 10)]] } });
    const before = bundle('2026-10-06', { tasks: [task('x')], sessions: { x: [[ms('2026-10-06', 9), ms('2026-10-06', 10)]] } });
    const r = run([before, inW]);
    expect(r.totalFocusMs).toBe(10 * MIN);
    expect(r.trend[0].ms).toBe(10 * MIN);
  });

  it('a session ending exactly on the hour adds nothing to the next hour', () => {
    const b = bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 9, 30), ms('2026-11-02', 10)]] } });
    const h = run([b]).hours.msByHour;
    expect(h[9]).toBe(30 * MIN);
    expect(h[10]).toBe(0);
  });

  it('the DST change (New York, 2026-11-01 02:00 -> 01:00): real elapsed time, split by the wall-clock hour', () => {
    // 00:30 .. 03:30 wall clock on 11-01 is 4 real hours (01:00-02:00 happens twice). Every ms is counted once.
    const k = '2026-11-01';
    const b = bundle(k, { hour: 0, tasks: [task('t', { budgetSec: 4 * 3600 })], sessions: { t: [[ms(k, 0, 30), ms(k, 3, 30)]] } });
    const r = computeInsights({ todayKey: '2026-11-02', at: ms('2026-11-02', 12), days: [b], topics: TOPICS });
    const total = ms(k, 3, 30) - ms(k, 0, 30);
    expect(r.totalFocusMs).toBe(total);
    expect(r.hours.msByHour.reduce((a, v) => a + v, 0)).toBe(total);
  });

  it('does not change its input', () => {
    const days = [bundle('2026-11-02', { tasks: [task('t')], sessions: { t: [[ms('2026-11-02', 9), ms('2026-11-02', 10)]] } })];
    const copy = JSON.parse(JSON.stringify(days));
    const topics = JSON.parse(JSON.stringify(TOPICS));
    run(days, { topics });
    expect(days).toEqual(copy);
    expect(topics).toEqual(JSON.parse(JSON.stringify(TOPICS)));
  });
});
