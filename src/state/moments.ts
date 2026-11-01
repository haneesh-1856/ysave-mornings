import { listDays, loadDayBundle } from '../data/repos/days';
import { focusTotalsByDay } from '../data/repos/sessions';
import {
  getMomentMarkers,
  getMomentsEnabled,
  getMonthlyGoalHours,
  setMomentMarkers,
} from '../data/repos/settings';
import { collectionItems } from '../domain/collection';
import { addDays, weekStartOf } from '../domain/dayKey';
import { monthKeyOf } from '../domain/calendar';
import { momentsAtClose, nextMarkers, type Moment } from '../domain/moments';
import type { DayBundle, DayKey, Epoch } from '../domain/types';
import { getDb } from './dbRef';
import { bump } from './store';

function bundlesBetween(from: DayKey, to: DayKey): DayBundle[] {
  const db = getDb();
  return listDays(db, from, to).flatMap((d) => loadDayBundle(db, d.dayKey) ?? []);
}

/**
 * Moments for the day just closed by hand at `at` (call AFTER the close is applied). Empty when the user turned
 * moments off, leaving markers alone. Otherwise saves the updated markers and returns the moments in play order.
 */
export function computeMomentsAfterClose(todayKey: DayKey, at: Epoch): Moment[] {
  const db = getDb();
  if (!getMomentsEnabled(db)) return [];
  const today = loadDayBundle(db, todayKey);
  if (!today) return [];

  // Item counts walking back from today until the first day that does not count (the chain rule).
  const itemCountByDay: Record<DayKey, number> = {};
  for (let k = todayKey; ; k = addDays(k, -1)) {
    const b = k === todayKey ? today : loadDayBundle(db, k);
    const n = b ? collectionItems(b, at).length : 0;
    itemCountByDay[k] = n;
    if (n < 1) break;
  }

  const earlier = focusTotalsByDay(db, todayKey, at);
  const markers = getMomentMarkers(db);
  const moments = momentsAtClose({
    closedAt: at,
    today,
    earlierDayFocusMs: Object.values(earlier),
    itemCountByDay,
    weekBundles: bundlesBetween(weekStartOf(todayKey), todayKey),
    monthBundles: bundlesBetween(`${monthKeyOf(todayKey)}-01`, todayKey),
    monthlyGoalHours: getMonthlyGoalHours(db),
    markers,
  });
  const next = nextMarkers(markers, moments);
  if (next !== markers) {
    setMomentMarkers(db, next, at);
    bump('settings');
  }
  return moments;
}
