import { collectionItems } from './collection';
import { addDays, weekdayIndex, weekStartOf } from './dayKey';
import { monthKeyOf } from './calendar';
import { daysShowedUp } from './stats';
import { focusedMs, isGold } from './timer';
import type { ColorKey, DayBundle, DayKey, Epoch, MonthKey } from './types';

// Moments at close (doc 04 "Moments at close", ADR-015). Pure: no db, no clock, no ids, no formatting.

const MS_PER_HOUR = 3_600_000;
export const STREAK_STEP = 7;
/** Steps the stair draws: the last min(days, STREAK_MAX_STEPS) days of the run. */
export const STREAK_MAX_STEPS = 21;
/** Days before today the best moment draws as bars. */
export const BEST_RECENT_DAYS = 13;

export type Moment =
  | { kind: 'longest'; name: string; colorKey: ColorKey; focusedMs: number; budgetSec: number }
  | { kind: 'day'; done: number; total: number; focusedMs: number; closedAt: Epoch }
  | {
      kind: 'best';
      todayMs: number;
      previousBestMs: number;
      /** Focused ms of the 13 days before today, oldest first (index 12 = yesterday). 0 for a day with no sessions. */
      recentMs: number[];
    }
  | { kind: 'streak'; days: number; endDayKey: DayKey }
  | {
      kind: 'week';
      weekStart: DayKey;
      tasksDone: number;
      focusedMs: number;
      goldRings: number;
      daysShowedUp: number;
      /** Focused ms of each day Monday..Sunday (index 0 = weekStart). 0 for a day with no row. Sums to focusedMs. */
      dailyMs: number[];
    }
  | {
      kind: 'month';
      monthKey: MonthKey;
      monthFocusMs: number;
      goalHours: number | null;
      daysShowedUp: number;
      /** Focused ms of each day of the month from the 1st to today (index 0 = the 1st). 0 for a day with no row. Sums to monthFocusMs. */
      dailyMs: number[];
    };

export type MomentKind = Moment['kind'];

/** Play order at a close by hand. */
export const MOMENT_ORDER: readonly MomentKind[] = ['longest', 'day', 'best', 'streak', 'week', 'month'];

/** What has already been celebrated, so nothing plays twice. */
export interface MomentMarkers {
  bestMs: number;
  streakCelebrated: number;
  streakEndDayKey: DayKey | null;
  weekCelebrated: DayKey | null; // the week's Monday
  monthCelebrated: MonthKey | null;
}

export const DEFAULT_MARKERS: MomentMarkers = {
  bestMs: 0,
  streakCelebrated: 0,
  streakEndDayKey: null,
  weekCelebrated: null,
  monthCelebrated: null,
};

export interface MomentsInput {
  /** The instant of the close; open sessions already ended at it. */
  closedAt: Epoch;
  /** The day being closed, loaded AFTER the close was applied. */
  today: DayBundle;
  /** Focused ms of every earlier day that has any session, keyed by day (from `focusTotalsByDay`). */
  earlierFocusByDay: Record<DayKey, number>;
  /**
   * Collection item count per day (the same count `chain` and `daysShowedUp` use) for today and the days before
   * it, going back at least until the first day with 0 (older days may be left out: a missing day counts 0).
   */
  itemCountByDay: Record<DayKey, number>;
  /** The days of today's Monday-Sunday week that exist, up to and including today. */
  weekBundles: DayBundle[];
  /** The days of today's month that exist, up to and including today. */
  monthBundles: DayBundle[];
  monthlyGoalHours: number | null;
  markers: MomentMarkers;
}

function bundleFocusMs(b: DayBundle, at: Epoch): number {
  return Object.values(b.sessionsByDayTask).reduce((sum, s) => sum + focusedMs(s, at), 0);
}

function countsOf(bundles: DayBundle[], at: Epoch): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const b of bundles) out[b.day.dayKey] = collectionItems(b, at).length;
  return out;
}

/** Consecutive days ending at todayKey that count (>= 1 item, the `chain` rule). 0 if today does not count. */
export function streakRun(todayKey: DayKey, itemCountByDay: Record<DayKey, number>): number {
  let run = 0;
  for (let k = todayKey; (itemCountByDay[k] ?? 0) >= 1; k = addDays(k, -1)) run++;
  return run;
}

/** Weekday (0 = Monday .. 6 = Sunday, `weekdayIndex`) of each drawn step, oldest first; the last is endDayKey. */
export function streakWeekdays(m: Extract<Moment, { kind: 'streak' }>): number[] {
  const n = Math.min(m.days, STREAK_MAX_STEPS);
  return Array.from({ length: n }, (_, i) => weekdayIndex(addDays(m.endDayKey, i - (n - 1))));
}

function longest(today: DayBundle, at: Epoch): Moment | null {
  let best: { t: DayBundle['dayTasks'][number]; ms: number } | null = null;
  for (const t of today.dayTasks) {
    if (t.kind !== 'timed') continue;
    const ms = focusedMs(today.sessionsByDayTask[t.id] ?? [], at);
    if (ms <= 0) continue;
    if (best === null || ms > best.ms || (ms === best.ms && t.sortOrder < best.t.sortOrder)) best = { t, ms };
  }
  return best && { kind: 'longest', name: best.t.name, colorKey: best.t.colorKey, focusedMs: best.ms, budgetSec: best.t.budgetSec };
}

/** The moments due at a by-hand close, in play order. */
export function momentsAtClose(input: MomentsInput): Moment[] {
  const { closedAt, today, markers } = input;
  const todayKey = today.day.dayKey;
  const out: Moment[] = [];

  const l = longest(today, closedAt);
  if (l) out.push(l);

  // Day complete only when every task is done. A day closed with tasks left ends quietly instead (the UI shows the
  // Moments off ending, the sun's ring left open). An empty day has nothing to complete.
  const todayMs = bundleFocusMs(today, closedAt);
  const done = today.dayTasks.filter((t) => t.completedAt !== null).length;
  const total = today.dayTasks.length;
  if (total > 0 && done === total) out.push({ kind: 'day', done, total, focusedMs: todayMs, closedAt });

  const earlierBest = Object.values(input.earlierFocusByDay).reduce((m, v) => Math.max(m, v), 0);
  const previousBestMs = Math.max(earlierBest, markers.bestMs);
  if (earlierBest > 0 && todayMs > previousBestMs) {
    const recentMs = Array.from({ length: BEST_RECENT_DAYS }, (_, i) => input.earlierFocusByDay[addDays(todayKey, -BEST_RECENT_DAYS + i)] ?? 0);
    out.push({ kind: 'best', todayMs, previousBestMs, recentMs });
  }

  const run = streakRun(todayKey, input.itemCountByDay);
  if (run >= STREAK_STEP && run % STREAK_STEP === 0) {
    const runStart = addDays(todayKey, -(run - 1));
    const sameRun = markers.streakEndDayKey !== null && markers.streakEndDayKey >= runStart && markers.streakCelebrated >= run;
    if (!sameRun) out.push({ kind: 'streak', days: run, endDayKey: todayKey });
  }

  const weekStart = weekStartOf(todayKey);
  if (todayKey === addDays(weekStart, 6) && markers.weekCelebrated !== weekStart) {
    let tasksDone = 0;
    let goldRings = 0;
    let weekMs = 0;
    const dailyMs = [0, 0, 0, 0, 0, 0, 0];
    const weekKeys = dailyMs.map((_, i) => addDays(weekStart, i));
    // Only this week's days count, so the totals always match the seven days drawn.
    const bundles = input.weekBundles.filter((b) => weekKeys.includes(b.day.dayKey));
    for (const b of bundles) {
      const ms = bundleFocusMs(b, closedAt);
      weekMs += ms;
      dailyMs[weekKeys.indexOf(b.day.dayKey)] += ms;
      for (const t of b.dayTasks) {
        if (t.completedAt !== null) tasksDone++;
        if (t.kind === 'timed' && isGold(t.budgetSec, b.sessionsByDayTask[t.id] ?? [], closedAt)) goldRings++;
      }
    }
    out.push({
      kind: 'week',
      weekStart,
      tasksDone,
      focusedMs: weekMs,
      goldRings,
      daysShowedUp: daysShowedUp(countsOf(bundles, closedAt)),
      dailyMs,
    });
  }

  const monthKey = monthKeyOf(todayKey);
  if (markers.monthCelebrated !== monthKey) {
    const goal = input.monthlyGoalHours;
    // Only the month's days up to today count, so the totals always match the days drawn.
    const dayCount = Number(todayKey.slice(8, 10));
    const monthKeys = Array.from({ length: dayCount }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`);
    const bundles = input.monthBundles.filter((b) => monthKeys.includes(b.day.dayKey));
    const dailyMs = monthKeys.map(() => 0);
    for (const b of bundles) dailyMs[monthKeys.indexOf(b.day.dayKey)] += bundleFocusMs(b, closedAt);
    const monthFocusMs = dailyMs.reduce((a, v) => a + v, 0);
    const lastDay = monthKeyOf(addDays(todayKey, 1)) !== monthKey;
    const due = goal !== null ? monthFocusMs >= goal * MS_PER_HOUR : lastDay;
    if (due) {
      out.push({
        kind: 'month',
        monthKey,
        monthFocusMs,
        goalHours: goal,
        daysShowedUp: daysShowedUp(countsOf(bundles, closedAt)),
        dailyMs,
      });
    }
  }
  return out;
}

/** Markers after the given moments have played. Returns the same object when nothing changes. */
export function nextMarkers(markers: MomentMarkers, moments: Moment[]): MomentMarkers {
  let next = markers;
  for (const m of moments) {
    if (m.kind === 'best') next = { ...next, bestMs: m.todayMs };
    else if (m.kind === 'streak') next = { ...next, streakCelebrated: m.days, streakEndDayKey: m.endDayKey };
    else if (m.kind === 'week') next = { ...next, weekCelebrated: m.weekStart };
    else if (m.kind === 'month') next = { ...next, monthCelebrated: m.monthKey };
  }
  return next;
}
