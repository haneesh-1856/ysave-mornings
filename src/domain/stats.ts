import { compareDayKeys } from './dayKey';
import { collectionItems } from './collection';
import type { CollectionItem } from './collection';
import { focusedMs } from './timer';
import type { DayBundle, DayKey, Epoch, Session, Task } from './types';

// Profile and Topics stats (doc 04 section 10). Pure.

const MS_PER_HOUR = 3_600_000;
const MAX_DOTS = 6;

/**
 * Days since the first `days` row, inclusive (first == today gives 1). With no days row yet
 * (null) the first open still shows "Day 1". Never below 1.
 */
export function dayNumber(firstDayKey: DayKey | null, todayKey: DayKey): number {
  if (firstDayKey === null || compareDayKeys(firstDayKey, todayKey) >= 0) return 1;
  const ms = (k: DayKey): number => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d); // UTC midnights: DST-proof day counting
  };
  return Math.round((ms(todayKey) - ms(firstDayKey)) / 86_400_000) + 1;
}

export function daysShowedUp(itemCountByDay: Record<DayKey, number>): number {
  return Object.values(itemCountByDay).filter((n) => n >= 1).length;
}

/** Total focused hours, unrounded (the UI formats). */
export function focusedHours(allSessions: Session[], now: Epoch): number {
  return focusedMs(allSessions, now) / MS_PER_HOUR;
}

export function marbles(itemCountByDay: Record<DayKey, number>): number {
  return Object.values(itemCountByDay).reduce((sum, n) => sum + n, 0);
}

function popcount7(mask: number): number {
  let n = 0;
  for (let bit = 0; bit < 7; bit++) n += (mask >> bit) & 1;
  return n;
}

/** Minutes per week across the topic's live timed tasks: minutes x repeat days. */
export function topicWeeklyMinutes(tasks: Task[], topicId: string): number {
  return tasks
    .filter((t) => t.topicId === topicId && t.kind === 'timed' && t.deletedAt === null)
    .reduce((sum, t) => sum + t.minutes * popcount7(t.repeatMask), 0);
}

/** The topic's completed task items across the week's bundles, in time order, at most 6 (the earliest 6). */
export function weekDots(topicId: string, weekBundles: DayBundle[], now: Epoch): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (const b of weekBundles) {
    const topicOf = new Map(b.dayTasks.map((t) => [t.id, t.topicId]));
    for (const it of collectionItems(b, now)) {
      if (it.kind === 'task' && it.dayTaskId !== null && topicOf.get(it.dayTaskId) === topicId) items.push(it);
    }
  }
  return items.sort((a, c) => a.at - c.at).slice(0, MAX_DOTS);
}
