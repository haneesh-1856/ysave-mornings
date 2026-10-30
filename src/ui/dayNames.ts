import type { DayKey } from '@/domain/types';

/** Local calendar date at noon, so a DST shift can never move it to another day (no UTC parsing). */
function localDate(dayKey: DayKey): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

const name = (dayKey: DayKey, weekday: 'long' | 'short', locale?: string): string =>
  new Intl.DateTimeFormat(locale, { weekday }).format(localDate(dayKey));

/** "Friday". `locale` defaults to the device's; tests pin 'en-US'. */
export const weekdayName = (dayKey: DayKey, locale?: string): string => name(dayKey, 'long', locale);

/** "Fridays" (simple "s" suffix: English copy; other locales are an M7 concern). */
export const weekdayPlural = (dayKey: DayKey, locale?: string): string => `${weekdayName(dayKey, locale)}s`;

/** "Fri". */
export const shortWeekday = (dayKey: DayKey, locale?: string): string => name(dayKey, 'short', locale);
