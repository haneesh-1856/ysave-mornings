import type { DayKey } from '@/domain/types';
import { formatHM, spokenDuration } from '@/ui/momentText';

/** Local calendar date at noon (no UTC parsing, so a DST shift never moves the day). */
function localDate(dayKey: DayKey): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** "Mon, Oct 26" in the device's locale. */
export function dateText(dayKey: DayKey, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(localDate(dayKey));
}

/** "Oct 26" in the device's locale. */
export function shortDateText(dayKey: DayKey, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(localDate(dayKey));
}

/** "3 of 7 days" for a week that has fewer than 7 of its days in the window, else null. */
export function partialText(daysInWindow: number): string | null {
  return daysInWindow < 7 ? `${daysInWindow} of 7 days` : null;
}

export const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The noun alone, singular for 1: nounFor(1, "day") -> "day". */
export const nounFor = (n: number, one: string): string => `${one}${n === 1 ? '' : 's'}`;

/** H:MM, but a real value under one minute reads "<0:01" instead of "0:00". */
export const durationText = (ms: number): string => (ms > 0 && ms < 60_000 ? '<0:01' : formatHM(ms));

/** Spoken counterpart: 0 is "no focus", under a minute is "less than a minute", else the app's spoken duration. */
export const spokenMs = (ms: number): string => (ms <= 0 ? 'no focus' : ms < 60_000 ? 'less than a minute' : spokenDuration(ms));
