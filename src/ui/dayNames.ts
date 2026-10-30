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

/** "October" (the month of a day key). */
export const monthName = (dayKey: DayKey, locale?: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'long' }).format(localDate(dayKey));

/** Seven narrow weekday initials, Monday first ("M", "T", "W", ...). Locale-aware; some locales repeat letters. */
export function weekdayInitials(locale?: string): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i, 12)),
  );
}

/** "4:00 AM" for an hour 0-23, in the device's (or given) locale. */
export function hourText(hour: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2024, 0, 1, hour, 0))
    .replace(/[\u202f\u00a0]/g, ' '); // newer ICU uses a narrow no-break space before AM/PM
}
