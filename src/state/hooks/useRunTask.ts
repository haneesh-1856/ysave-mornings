import { useEffect, useRef } from 'react';
import { remainingMs } from '../../domain/timer';
import type { Day } from '../../domain/types';
import { reconcile } from '../actions/reconcile';
import { now } from '../clock';
import { useTaskNote } from './useTaskNote';
import { useToday } from './useToday';
import type { TodayRow } from './useToday';

/** Extra wait after an early timer fire, so the re-armed timeout lands just past the completion instant. */
const REARM_MARGIN_MS = 25;

/**
 * Detects a running timed task hitting 0 while the app is open and calls reconcile() for it, so
 * completedAt is written at the exact completion instant. Uses one timeout set for the remaining time
 * (no per-second re-render). useRunTask calls it; the Today screen calls it once per running row.
 * JS timers can fire a few ms early: after reconcile() the callback re-checks the remaining time and,
 * if still > 0, re-arms (at least REARM_MARGIN_MS later, so no tight loop). The guard is set only once
 * the remaining time is <= 0. If the app is backgrounded the timeout may not fire: useReconcileOnForeground covers that.
 */
export function useCompletionWatcher(row: TodayRow | null): void {
  const firedFor = useRef<string | null>(null);
  const running = row !== null && row.dayTask.kind === 'timed' && row.state === 'running';
  const key = running
    ? `${row.dayTask.id}:${row.sessions.map((s) => `${s.id}/${s.endedAt ?? ''}`).join(',')}`
    : null;
  const budgetSec = row?.dayTask.budgetSec ?? 0;
  const sessions = row?.sessions;
  useEffect(() => {
    if (key === null || !sessions || firedFor.current === key) return;
    let cancelled = false;
    let id: ReturnType<typeof setTimeout> | null = null; // the current timer, initial or re-armed
    const fire = () => {
      id = null;
      if (cancelled) return;
      reconcile();
      if (cancelled) return; // reconcile's bump unmounted us or changed the key
      const left = remainingMs(budgetSec, sessions, now());
      if (left > 0) id = setTimeout(fire, left + REARM_MARGIN_MS);
      else firedFor.current = key;
    };
    id = setTimeout(fire, Math.max(0, remainingMs(budgetSec, sessions, now())));
    return () => {
      cancelled = true;
      if (id !== null) clearTimeout(id);
      id = null;
    };
  }, [key, budgetSec, sessions]);
}

/** One day task for the Run screen: the row, the library task's note and its day. null if not on today's list. */
export function useRunTask(dayTaskId: string): { row: TodayRow | null; note: string; day: Day | null } | null {
  const today = useToday();
  const row = today.rows.find((r) => r.dayTask.id === dayTaskId) ?? null;
  const note = useTaskNote(row?.dayTask.taskId ?? null);
  useCompletionWatcher(row);
  if (!row) return null;
  return { row, note, day: today.day };
}
