// Builds a past from a day-by-day script by LIVING it with the app's real actions and the virtual clock: each morning
// the clock jumps to the day start and reconcile runs (as when the app opens), the plan is confirmed, timed tasks are
// started and paused/stopped as the clock moves, checklist tasks are ticked, and the day is closed by hand or left for
// the next morning's auto-close. Nothing is written to the database directly.
import { loadDayBundle } from '@/data/repos/days';
import { getDayStartHour } from '@/data/repos/settings';
import { listTasks } from '@/data/repos/tasks';
import { listTopics } from '@/data/repos/topics';
import { addDays, dayStartOf } from '@/domain/dayKey';
import type { Moment } from '@/domain/moments';
import { buildPlan, type PlanDraft } from '@/domain/plan';
import { focusedMs } from '@/domain/timer';
import type { CloseOutcome, DayKey, DayTask } from '@/domain/types';
import { closeToday } from '@/state/actions/close';
import { createTask, createTopic } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '@/state/actions/run';
import { setDayStart, setMomentsEnabled, setMonthlyGoal } from '@/state/actions/settings';
import { getDb } from '@/state/dbRef';
import { todayKey as resolveTodayKey } from '@/state/today';

import { clock, freshDb } from './engine';

const MIN = 60_000;

export type ColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5';
export type LibTask = { name: string; topic: string; kind: 'timed' | 'check'; minutes: number; days: number[]; isDefault: boolean };
export type LibTopic = { name: string; colorKey: ColorKey };
/** Per task name: a timed task's minutes of focus (0 = planned, none done), 'done' / 'open' for a checklist task. Missing = not in that day's plan. */
export type DayScript = { day: DayKey; work: Record<string, number | 'done' | 'open'>; end: 'hand' | 'auto'; leftover: CloseOutcome };
export type Scenario = {
  topics: LibTopic[];
  tasks: LibTask[];
  dayStartHour: number;
  monthlyGoalHours: number | null;
  momentsOn: boolean;
  /** The day the sandbox lands on, live: planned from its script row but nothing done yet (you do it by hand). */
  liveDay: DayKey;
  days: DayScript[];
};

export type LogLine = { at: number; kind: 'action' | 'moments' | 'error' | 'auto'; text: string };
export type CloseRecord = { day: DayKey; at: number; moments: Moment[]; bars: { name: string; focusedMs: number }[] };

export const maskOf = (days: number[]): number => days.reduce((m, d) => m | (1 << d), 0);

/** The draft the plan screen would show for `dayKey`, with exactly the script's task names ticked (others unticked). */
export function scriptedDraft(dayKey: DayKey, names: Set<string> | null): PlanDraft {
  const db = getDb();
  const b = loadDayBundle(db, dayKey);
  let d = buildPlan({ dayKey, topics: listTopics(db), tasks: listTasks(db), day: b?.day ?? null, dayTasks: b?.dayTasks ?? [] });
  if (names) {
    const tick = (r: PlanDraft['notOn'][number]) => ({ ...r, ticked: names.has(r.name) || r.reason === 'forwarded' });
    d = { ...d, groups: d.groups.map((g) => ({ ...g, rows: g.rows.map(tick) })), notOn: d.notOn.map(tick) };
  }
  return d;
}

/** Moves the clock and runs reconcile, as the app does on open / at the day boundary. Returns auto-closed days. */
export function moveClock(ms: number, log: (l: LogLine) => void): DayKey[] {
  clock.add(ms);
  const { autoClosed } = reconcile();
  for (const k of autoClosed) log({ at: clock.get(), kind: 'auto', text: `Auto-closed ${k} at its day end (app rule)` });
  return autoClosed;
}

/** Focus a timed task for `min` minutes from now: start, move the clock, then pause (or stop if it reached its time). */
export function focusFor(dt: DayTask, min: number, log: (l: LogLine) => void): void {
  startTask(dt.id);
  moveClock(min * MIN, log);
  const after = loadDayBundle(getDb(), dt.dayKey)?.dayTasks.find((t) => t.id === dt.id);
  if (after?.completedAt != null) stopTask(dt.id);
  else pauseTask(dt.id);
}

export function runScenario(sc: Scenario, log: (l: LogLine) => void, onClose: (r: CloseRecord) => void): void {
  freshDb();
  const first = sc.days[0]?.day ?? sc.liveDay;
  // Library and settings are made the evening before the first day, through the app's own actions.
  clock.set(dayStartOf(addDays(first, -1), sc.dayStartHour) + 18 * 60 * MIN);
  setDayStart(sc.dayStartHour);
  setMonthlyGoal(sc.monthlyGoalHours);
  setMomentsEnabled(sc.momentsOn);
  const topicIds = new Map<string, string>();
  for (const t of sc.topics) topicIds.set(t.name, createTopic({ name: t.name, colorKey: t.colorKey }).id);
  for (const t of sc.tasks) {
    createTask(topicIds.get(t.topic) ?? null, { name: t.name, kind: t.kind, minutes: t.minutes, repeatMask: maskOf(t.days), isDefault: t.isDefault });
  }
  log({ at: clock.get(), kind: 'action', text: `Library: ${sc.topics.length} topics, ${sc.tasks.length} tasks` });

  const h = getDayStartHour(getDb());
  const all = [...sc.days.filter((d) => d.day < sc.liveDay), { day: sc.liveDay, work: sc.days.find((d) => d.day === sc.liveDay)?.work ?? {}, end: 'auto' as const, leftover: 'let_go' as const }];
  for (const ds of all) {
    // Morning: open the app half an hour after the day starts.
    const target = dayStartOf(ds.day, h) + 30 * MIN;
    moveClock(Math.max(0, target - clock.get()), log);
    const names = new Set(Object.keys(ds.work));
    if (names.size > 0) {
      confirmDayPlan(ds.day, scriptedDraft(ds.day, names));
    }
    if (ds.day === sc.liveDay) break;
    // Work from 09:00 (after the day start), one task after another.
    moveClock(Math.max(0, dayStartOf(ds.day, h) + (9 - h) * 60 * MIN - clock.get()), log);
    const rows = loadDayBundle(getDb(), ds.day)?.dayTasks ?? [];
    for (const dt of rows) {
      const w = ds.work[dt.name];
      if (dt.kind === 'timed' && typeof w === 'number' && w > 0) focusFor(dt, w, log);
      if (dt.kind === 'check' && w === 'done') toggleCheckTask(dt.id);
      moveClock(10 * MIN, log);
    }
    if (ds.end === 'hand') {
      moveClock(Math.max(0, dayStartOf(ds.day, h) + (21 - h) * 60 * MIN - clock.get()), log);
      const open = (loadDayBundle(getDb(), ds.day)?.dayTasks ?? []).filter((t) => t.completedAt == null);
      const outcomes: Record<string, CloseOutcome> = Object.fromEntries(open.map((t) => [t.id, ds.leftover]));
      const bars = timedBars(ds.day);
      const moments = closeToday(outcomes);
      onClose({ day: ds.day, at: clock.get(), moments, bars });
      log({ at: clock.get(), kind: 'moments', text: `Closed ${ds.day} by hand: ${moments.length ? moments.map((m) => m.kind).join(', ') : 'no moments'}` });
    }
  }
  log({ at: clock.get(), kind: 'action', text: `Now live on ${resolveTodayKey(getDb(), clock.get())}` });
}

/**
 * For closes made by the script (no screen mounted): the same lines as useCloseSummary().timedFocus, with the same
 * domain focusedMs. The live Close panel uses the real hook itself.
 */
export function timedBars(dayKey: DayKey): { name: string; focusedMs: number }[] {
  const b = loadDayBundle(getDb(), dayKey);
  if (!b) return [];
  const at = clock.get();
  const out: { name: string; focusedMs: number }[] = [];
  for (const t of [...b.dayTasks].sort((x, y) => x.sortOrder - y.sortOrder)) {
    const ms = focusedMs(b.sessionsByDayTask[t.id] ?? [], at);
    if (t.kind === 'timed' && ms > 0) out.push({ name: t.name, focusedMs: ms });
  }
  return out.sort((a, z) => z.focusedMs - a.focusedMs);
}
