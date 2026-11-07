import { collectionItems } from './collection';
import { addDays, dayStartOf, weekStartOf, weekdayIndex } from './dayKey';
import { focusedMs, isGold } from './timer';
import type { ColorKey, DayBundle, DayKey, DayTask, Epoch, Session, Topic } from './types';

// Insights (M14): on-device statistics over the last 30 days. Pure: `at` is an argument, nothing is read
// from the db. Every number reuses the existing rules (focusedMs, isGold, collectionItems), never a copy.

export const INSIGHT_DAYS = 30;

const MS_PER_MINUTE = 60_000;
/** Every deleted or unknown topic is shown as this one row (lead decision 2026-11-05: one row, not several alike). */
export const REMOVED_TOPICS_ID = 'removed';
const REMOVED_TOPICS_NAME = 'Removed topics';
/** Lower bounds, in minutes, of the six session-length bins: <5, 5-14, 15-29, 30-44, 45-59, 60+. */
const BIN_FLOORS_MIN = [0, 5, 15, 30, 45, 60];

export interface InsightsInput {
  todayKey: DayKey;
  at: Epoch;
  /** Bundles of rows in the window; others are ignored here (filtered by key). */
  days: DayBundle[];
  /** Includes deleted topics. */
  topics: Topic[];
}

export interface WeekBucket {
  weekStart: DayKey;
  daysInWindow: number;
}

export interface Insights {
  windowStart: DayKey;
  windowEnd: DayKey;
  totalFocusMs: number;
  hours: { msByHour: number[] };
  weekdays: { totalMs: number[]; dayCount: number[]; avgMs: number[] };
  firstStart: { days: { dayKey: DayKey; minutes: number }[]; medianMinutes: number | null };
  topics: { topicId: string; name: string; colorKey: ColorKey; ms: number }[];
  planned: { topicId: string; name: string; colorKey: ColorKey; plannedMs: number; focusedMs: number }[];
  sessions: { count: number; medianMs: number | null; bins: number[] };
  trend: (WeekBucket & { ms: number })[];
  showedUp: { total: number; byWeek: (WeekBucket & { days: number })[] };
  gold: { rings: number; days: number; byWeek: (WeekBucket & { rings: number; days: number })[] };
  carry: { moved: number; letGo: number; byWeek: (WeekBucket & { moved: number; letGo: number })[] };
  checks: { ticked: number; notTicked: number };
  records: {
    bestDay: { dayKey: DayKey; ms: number } | null;
    longestSession: { dayKey: DayKey; taskName: string; ms: number } | null;
    longestRun: { days: number; endDayKey: DayKey } | null;
  };
}

/** Median of numbers; even count: mean of the two middle values, rounded to the nearest whole. Null when empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** The window's keys, oldest first. */
function windowKeys(todayKey: DayKey): DayKey[] {
  return Array.from({ length: INSIGHT_DAYS }, (_, i) => addDays(todayKey, i - (INSIGHT_DAYS - 1)));
}

/** Length of one session, an open one bounded by `at`; negative clamps to 0 (same rule as focusedMs). */
function lengthOf(s: Session, at: Epoch): number {
  return Math.max(0, (s.endedAt ?? at) - s.startedAt);
}

/**
 * Adds a session's span to the per-hour totals, splitting it at local clock-hour boundaries. The next
 * boundary is built from the wall clock (not +1h in ms) so DST days stay correct; each piece goes to the
 * hour it starts in.
 */
function addToHours(msByHour: number[], s: Session, at: Epoch): void {
  const end = s.endedAt ?? at;
  let cursor = s.startedAt;
  while (cursor < end) {
    const d = new Date(cursor);
    const boundary = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const pieceEnd = Math.min(end, Math.max(boundary, cursor + 1)); // the max() guards against a stuck loop
    msByHour[d.getHours()] += pieceEnd - cursor;
    cursor = pieceEnd;
  }
}

/** Index of the session-length bin for a length in ms (lower bound inclusive). */
function binOf(ms: number): number {
  const min = ms / MS_PER_MINUTE;
  let bin = 0;
  BIN_FLOORS_MIN.forEach((floor, i) => {
    if (min >= floor) bin = i;
  });
  return bin;
}

/**
 * The row a day-task's focus goes to: its live topic, or the single "Removed topics" row (neutral colour) for every
 * deleted or unknown topic, so several removed topics never show as several identical rows.
 */
function topicLabel(t: DayTask, topicById: Map<string, Topic>): { key: string; name: string; colorKey: ColorKey } {
  const topic = topicById.get(t.topicId);
  if (!topic || topic.deletedAt !== null) return { key: REMOVED_TOPICS_ID, name: REMOVED_TOPICS_NAME, colorKey: 'none' };
  return { key: topic.id, name: topic.name, colorKey: topic.colorKey };
}

/** Largest first by `key`, ties by name then id, so the order never depends on input order. Sorts `rows` in place. */
function byDescThenName<T extends { name: string; topicId: string }>(rows: T[], key: (r: T) => number): T[] {
  return rows.sort(
    (a, b) => key(b) - key(a) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.topicId < b.topicId ? -1 : 1),
  );
}

export function computeInsights(input: InsightsInput): Insights {
  const { todayKey, at, topics } = input;
  const keys = windowKeys(todayKey);
  const windowStart = keys[0];

  // Bundles outside the window are ignored everywhere (filter by key).
  const bundleByKey = new Map<DayKey, DayBundle>();
  for (const b of input.days) if (keys.includes(b.day.dayKey) && !bundleByKey.has(b.day.dayKey)) bundleByKey.set(b.day.dayKey, b);

  const topicById = new Map(topics.map((t) => [t.id, t]));
  const sessionsOf = (b: DayBundle, t: DayTask): Session[] => b.sessionsByDayTask[t.id] ?? [];

  // Week buckets, oldest first; each counts only its days inside the window.
  const weekStarts: DayKey[] = [];
  const daysInWeek = new Map<DayKey, number>();
  for (const k of keys) {
    const ws = weekStartOf(k);
    if (!daysInWeek.has(ws)) weekStarts.push(ws);
    daysInWeek.set(ws, (daysInWeek.get(ws) ?? 0) + 1);
  }
  const bucket = (ws: DayKey): WeekBucket => ({ weekStart: ws, daysInWindow: daysInWeek.get(ws) as number });
  const perWeek = (): Map<DayKey, number> => new Map(weekStarts.map((ws) => [ws, 0]));

  const msByHour = new Array<number>(24).fill(0);
  const weekdayTotal = new Array<number>(7).fill(0);
  const weekdayCount = new Array<number>(7).fill(0);
  const bins = new Array<number>(6).fill(0);
  const sessionLengths: number[] = [];
  const firstStartDays: { dayKey: DayKey; minutes: number }[] = [];
  const topicMs = new Map<string, { name: string; colorKey: ColorKey; ms: number }>();
  const plannedBy = new Map<string, { name: string; colorKey: ColorKey; plannedMs: number; focusedMs: number }>();
  const weekMs = perWeek();
  const weekShowed = perWeek();
  const weekRings = perWeek();
  const weekGoldDays = perWeek();
  const weekMoved = perWeek();
  const weekLetGo = perWeek();
  const bump = (m: Map<DayKey, number>, k: DayKey, n = 1): void => void m.set(k, (m.get(k) ?? 0) + n);

  let totalFocusMs = 0;
  let showedUpTotal = 0;
  let goldRings = 0;
  let goldDays = 0;
  let moved = 0;
  let letGo = 0;
  let ticked = 0;
  let notTicked = 0;
  let bestDay: Insights['records']['bestDay'] = null;
  let longestSession: Insights['records']['longestSession'] = null;
  let longestSessionStart = 0;
  let longestRun: Insights['records']['longestRun'] = null;
  let run = 0;

  for (const key of keys) {
    const w = weekdayIndex(key);
    const ws = weekStartOf(key);
    weekdayCount[w] += 1;
    const b = bundleByKey.get(key);
    if (!b) {
      run = 0; // a day with no row did not show up
      continue;
    }

    let dayMs = 0;
    let dayRings = 0;
    let earliestStart: Epoch | null = null;
    for (const t of b.dayTasks) {
      const sessions = sessionsOf(b, t);
      const taskMs = focusedMs(sessions, at);
      dayMs += taskMs;

      const label = topicLabel(t, topicById);
      if (taskMs > 0) {
        const row = topicMs.get(label.key) ?? { name: label.name, colorKey: label.colorKey, ms: 0 };
        row.ms += taskMs;
        topicMs.set(label.key, row);
      }
      if (t.kind === 'timed') {
        const row = plannedBy.get(label.key) ?? { name: label.name, colorKey: label.colorKey, plannedMs: 0, focusedMs: 0 };
        row.plannedMs += t.budgetSec * 1000;
        row.focusedMs += taskMs;
        plannedBy.set(label.key, row);
        if (isGold(t.budgetSec, sessions, at)) dayRings += 1;
      }

      for (const s of sessions) {
        addToHours(msByHour, s, at);
        const len = lengthOf(s, at);
        sessionLengths.push(len);
        bins[binOf(len)] += 1;
        if (earliestStart === null || s.startedAt < earliestStart) earliestStart = s.startedAt;
        // Strictly longer wins; equal length keeps the earlier startedAt.
        if (len > 0 && (longestSession === null || len > longestSession.ms || (len === longestSession.ms && s.startedAt < longestSessionStart))) {
          longestSession = { dayKey: key, taskName: t.name, ms: len };
          longestSessionStart = s.startedAt;
        }
      }

      if (b.day.closedAt !== null) {
        if (t.closeOutcome === 'moved') moved += 1;
        if (t.closeOutcome === 'let_go') letGo += 1;
        if (t.kind === 'check') {
          if (t.completedAt !== null) ticked += 1;
          else notTicked += 1;
        }
      }
    }
    if (b.day.closedAt !== null) {
      bump(weekMoved, ws, b.dayTasks.filter((t) => t.closeOutcome === 'moved').length);
      bump(weekLetGo, ws, b.dayTasks.filter((t) => t.closeOutcome === 'let_go').length);
    }

    totalFocusMs += dayMs;
    weekdayTotal[w] += dayMs;
    bump(weekMs, ws, dayMs);
    if (dayMs > 0 && (bestDay === null || dayMs > bestDay.ms)) bestDay = { dayKey: key, ms: dayMs };

    if (earliestStart !== null) {
      const minutes = Math.max(0, Math.floor((earliestStart - dayStartOf(key, b.day.dayStartHour)) / MS_PER_MINUTE));
      firstStartDays.push({ dayKey: key, minutes });
    }

    goldRings += dayRings;
    bump(weekRings, ws, dayRings);
    if (dayRings > 0) {
      goldDays += 1;
      bump(weekGoldDays, ws);
    }

    if (collectionItems(b, at).length >= 1) {
      showedUpTotal += 1;
      bump(weekShowed, ws);
      run += 1;
      if (longestRun === null || run >= longestRun.days) longestRun = { days: run, endDayKey: key }; // ties: the latest
    } else {
      run = 0;
    }
  }

  const rows = <T extends object>(m: Map<string, T>): (T & { topicId: string })[] =>
    [...m.entries()].map(([topicId, v]) => ({ topicId, ...v }));

  const topicsOut = byDescThenName(rows(topicMs).filter((r) => r.ms > 0), (r) => r.ms).map((r) => ({
    topicId: r.topicId, name: r.name, colorKey: r.colorKey, ms: r.ms,
  }));
  const plannedOut = byDescThenName(rows(plannedBy).filter((r) => r.plannedMs > 0 || r.focusedMs > 0), (r) => r.plannedMs).map((r) => ({
    topicId: r.topicId, name: r.name, colorKey: r.colorKey, plannedMs: r.plannedMs, focusedMs: r.focusedMs,
  }));

  return {
    windowStart,
    windowEnd: keys[keys.length - 1],
    totalFocusMs,
    hours: { msByHour },
    weekdays: { totalMs: weekdayTotal, dayCount: weekdayCount, avgMs: weekdayTotal.map((ms, i) => ms / weekdayCount[i]) },
    firstStart: { days: firstStartDays, medianMinutes: median(firstStartDays.map((d) => d.minutes)) },
    topics: topicsOut,
    planned: plannedOut,
    sessions: { count: sessionLengths.length, medianMs: median(sessionLengths), bins },
    trend: weekStarts.map((ws) => ({ ...bucket(ws), ms: weekMs.get(ws) as number })),
    showedUp: { total: showedUpTotal, byWeek: weekStarts.map((ws) => ({ ...bucket(ws), days: weekShowed.get(ws) as number })) },
    gold: {
      rings: goldRings,
      days: goldDays,
      byWeek: weekStarts.map((ws) => ({ ...bucket(ws), rings: weekRings.get(ws) as number, days: weekGoldDays.get(ws) as number })),
    },
    carry: {
      moved,
      letGo,
      byWeek: weekStarts.map((ws) => ({ ...bucket(ws), moved: weekMoved.get(ws) as number, letGo: weekLetGo.get(ws) as number })),
    },
    checks: { ticked, notTicked },
    records: { bestDay, longestSession, longestRun },
  };
}
