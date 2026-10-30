import { loadDayBundle, loadOpenPastDays, setCompletedAt } from '../../data/repos/days';
import { applyOps } from '../../data/repos/ops';
import { getDayStartHour } from '../../data/repos/settings';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import { dayKeyOf } from '../../domain/dayKey';
import { rollover } from '../../domain/rollover';
import type { Ops } from '../../domain/rollover';
import { pendingCompletions } from '../../domain/timer';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';

function isEmpty(o: Ops): boolean {
  return (
    o.closeSessions.length === 0 && o.completions.length === 0 && o.outcomes.length === 0 &&
    o.closeDays.length === 0 && o.createDays.length === 0 && o.insertDayTasks.length === 0
  );
}

/**
 * Brings stored state up to date with the clock (doc 04 section 3 and 6, doc 02 "a timed task hits 0").
 * 1) rollover: auto-closes every open past day at its own end (stale sessions never leak into today),
 *    prefills an unplanned today. 2) today's pendingCompletions -> completedAt at the exact instant.
 * Idempotent: a second call with the same clock writes nothing and bumps nothing.
 */
export function reconcile(): { autoClosed: DayKey[] } {
  const db = getDb();
  const at = now();
  const dayStartHour = getDayStartHour(db);
  const todayKey = dayKeyOf(at, dayStartHour);

  const todayBefore = loadDayBundle(db, todayKey);
  const { autoClosed, ...ops } = rollover({
    now: at,
    dayStartHour,
    openDays: loadOpenPastDays(db, todayKey),
    today: { day: todayBefore?.day ?? null, dayTasks: todayBefore?.dayTasks ?? [] },
    topics: listTopics(db),
    tasks: listTasks(db),
  });
  let changed = false;
  if (!isEmpty(ops)) {
    applyOps(db, ops, newId, at);
    changed = true;
  }

  const today = loadDayBundle(db, todayKey);
  if (today) {
    const pending = pendingCompletions(today.dayTasks, today.sessionsByDayTask, at);
    if (pending.length > 0) {
      setCompletedAt(db, pending, at);
      changed = true;
    }
  }
  if (changed) bump('days', 'sessions');
  return { autoClosed };
}
