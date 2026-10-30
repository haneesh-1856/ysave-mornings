import { GOLD_OVERTIME_MS } from './types';
import type { Day, DayTask, Epoch, Session } from './types';

// Timer + checklist rules (doc 04 §4, §5). Pure: every function takes `now` as an argument.

export type TimerState = 'idle' | 'running' | 'paused' | 'overtime' | 'stopped';

export type StartDecision =
  | { ok: true; closeSessionId: string | null }
  | { ok: false; reason: 'not_timed' | 'done' | 'day_closed' | 'already_running' };

/** Length of one session; an open session is bounded by `now`. Negative lengths clamp to 0. */
function lengthOf(s: Session, now: Epoch): number {
  return Math.max(0, (s.endedAt ?? now) - s.startedAt);
}

/** Total focused time in ms. */
export function focusedMs(sessions: Session[], now: Epoch): number {
  return sessions.reduce((sum, s) => sum + lengthOf(s, now), 0);
}

/** Budget minus focused, in ms. Negative once the task is in overtime. */
export function remainingMs(budgetSec: number, sessions: Session[], now: Epoch): number {
  return budgetSec * 1000 - focusedMs(sessions, now);
}

/**
 * The exact instant cumulative focus reached the budget, or null if it has not by `now`.
 * Walks sessions in start order, so a completion detected long after the fact (app killed)
 * still returns the original instant. A budget <= 0 completes at the first session's start.
 */
export function completionTime(budgetSec: number, sessions: Session[], now: Epoch): Epoch | null {
  const budget = budgetSec * 1000;
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  let acc = 0;
  for (const s of sorted) {
    const len = lengthOf(s, now);
    if (acc + len >= budget) {
      const at = s.startedAt + (budget - acc);
      return at <= now ? at : null;
    }
    acc += len;
  }
  return null;
}

/** Focus beyond the budget, never negative. */
export function overtimeMs(budgetSec: number, sessions: Session[], now: Epoch): number {
  return Math.max(0, -remainingMs(budgetSec, sessions, now));
}

/** Gold ring: at least GOLD_OVERTIME_MS of overtime. */
export function isGold(budgetSec: number, sessions: Session[], now: Epoch): boolean {
  return overtimeMs(budgetSec, sessions, now) >= GOLD_OVERTIME_MS;
}

/**
 * Visible state of a day task. Relies on `completedAt` being reconciled: callers set it from
 * `pendingCompletions` (on every tick / app open), which is how 'overtime' and 'stopped' arise.
 */
export function timerState(dayTask: DayTask, sessions: Session[]): TimerState {
  const open = sessions.some((s) => s.endedAt === null);
  if (dayTask.completedAt !== null) return open ? 'overtime' : 'stopped';
  if (open) return 'running';
  return sessions.length > 0 ? 'paused' : 'idle';
}

/** Minutes shown as "left": rounds up, floors at 0. */
export function minutesLeftLabel(remainingMs: number): number {
  return Math.ceil(Math.max(0, remainingMs) / 60_000);
}

/** Minutes shown as "+N extra": rounds down. */
export function extraMinutesLabel(overtimeMs: number): number {
  return Math.floor(Math.max(0, overtimeMs) / 60_000);
}

/** May `target` be started? `openSession` is the open session anywhere (at most one exists). */
export function startDecision(target: DayTask, day: Day, openSession: Session | null): StartDecision {
  if (target.kind !== 'timed') return { ok: false, reason: 'not_timed' };
  if (target.completedAt !== null) return { ok: false, reason: 'done' };
  if (day.closedAt !== null) return { ok: false, reason: 'day_closed' };
  if (openSession && openSession.dayTaskId === target.id) return { ok: false, reason: 'already_running' };
  return { ok: true, closeSessionId: openSession ? openSession.id : null };
}

/** Timed tasks not yet marked complete whose budget has been reached by `now`. */
export function pendingCompletions(
  dayTasks: DayTask[],
  sessionsByDayTask: Record<string, Session[]>,
  now: Epoch,
): { dayTaskId: string; completedAt: Epoch }[] {
  const out: { dayTaskId: string; completedAt: Epoch }[] = [];
  for (const t of dayTasks) {
    if (t.kind !== 'timed' || t.completedAt !== null) continue;
    const at = completionTime(t.budgetSec, sessionsByDayTask[t.id] ?? [], now);
    if (at !== null) out.push({ dayTaskId: t.id, completedAt: at });
  }
  return out;
}

/** Tick sets completedAt = now, un-tick clears it. Only checklist tasks, only while the day is open. */
export function toggleCheck(
  dayTask: DayTask,
  day: Day,
  now: Epoch,
): { ok: true; completedAt: Epoch | null } | { ok: false; reason: 'not_check' | 'day_closed' } {
  if (dayTask.kind !== 'check') return { ok: false, reason: 'not_check' };
  if (day.closedAt !== null) return { ok: false, reason: 'day_closed' };
  return { ok: true, completedAt: dayTask.completedAt === null ? now : null };
}
