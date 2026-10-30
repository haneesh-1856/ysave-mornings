import { addDays, compareDayKeys } from './dayKey';
import type { DayBundle, DayKey } from './types';

// Calendar glow (doc 04 section 8) and soft chain (section 9). Pure.

export type ChainLink = 'solid' | 'rest' | 'today';

/** Closed or past, at least one planned task, and every day task completed. */
export function glows(b: DayBundle, todayKey: DayKey): boolean {
  const over = b.day.closedAt !== null || compareDayKeys(b.day.dayKey, todayKey) < 0;
  return over && b.dayTasks.length > 0 && b.dayTasks.every((t) => t.completedAt !== null);
}

/** 8 links, todayKey-7 .. todayKey, oldest first. Counts include the planning marble. */
export function chain(todayKey: DayKey, itemCountByDay: Record<DayKey, number>): ChainLink[] {
  const links: ChainLink[] = [];
  for (let i = 7; i >= 1; i--) {
    links.push((itemCountByDay[addDays(todayKey, -i)] ?? 0) >= 1 ? 'solid' : 'rest');
  }
  links.push('today');
  return links;
}
