import { addDays, compareDayKeys, weekdayIndex } from './dayKey';
import type { DayBundle, DayKey, MonthKey } from './types';

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

/** 'YYYY-MM' of a dayKey. */
export function monthKeyOf(dayKey: DayKey): MonthKey {
  return dayKey.slice(0, 7);
}

/** The month n months away (n may be negative). */
export function addMonths(m: MonthKey, n: number): MonthKey {
  const [y, mo] = m.split('-').map(Number);
  const idx = y * 12 + (mo - 1) + n;
  const year = Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
}

/** Weeks Monday..Sunday; null = blank before the 1st / after the last day. 4 to 6 rows. */
export function monthGrid(m: MonthKey): (DayKey | null)[][] {
  const length = Number(addDays(`${addMonths(m, 1)}-01`, -1).slice(8));
  const lead = weekdayIndex(`${m}-01`);
  const cells: (DayKey | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= length; d++) cells.push(`${m}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
