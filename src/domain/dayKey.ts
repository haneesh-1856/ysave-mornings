import { addDays as addDaysFns, format, getISODay, setHours } from 'date-fns';
import type { DayKey, Epoch } from './types';

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for real calendar dates written as 'YYYY-MM-DD' (so 2026-02-30 is false). */
export function isDayKey(s: string): boolean {
  const m = DAY_KEY_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // new Date(y, ...) maps years 0-99 to 1900-1999, so check the year field too.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function assertDayKey(s: string): void {
  if (!isDayKey(s)) throw new Error(`Invalid dayKey: ${JSON.stringify(s)}`);
}

function assertHour(h: number): void {
  if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error(`Invalid dayStartHour: ${h}`);
}

/** Local midnight of a dayKey. Caller must have validated it. */
function parse(dayKey: DayKey): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const toKey = (d: Date): DayKey => format(d, 'yyyy-MM-dd');

export function addDays(dayKey: DayKey, n: number): DayKey {
  assertDayKey(dayKey);
  if (!Number.isInteger(n)) throw new Error(`Invalid day count: ${n}`);
  return toKey(addDaysFns(parse(dayKey), n));
}

/** The instant a day begins: local wall clock H:00 on that date. */
export function dayStartOf(dayKey: DayKey, dayStartHour: number): Epoch {
  assertDayKey(dayKey);
  assertHour(dayStartHour);
  return setHours(parse(dayKey), dayStartHour).getTime();
}

/** The instant a day ends: the next day's start. */
export function dayEndOf(dayKey: DayKey, dayStartHour: number): Epoch {
  return dayStartOf(addDays(dayKey, 1), dayStartHour);
}

/**
 * The day an instant belongs to: the local calendar date, minus one day if the instant is before
 * that date's H:00. (H = 4: Tue 02:30 -> Monday, Tue 04:00 -> Tuesday.) Compared against dayStartOf
 * on purpose, so the two always agree even on DST days.
 */
export function dayKeyOf(instant: Epoch, dayStartHour: number): DayKey {
  assertHour(dayStartHour);
  if (!Number.isFinite(instant)) throw new Error(`Invalid instant: ${instant}`);
  const calendarKey = toKey(new Date(instant));
  return instant < dayStartOf(calendarKey, dayStartHour) ? addDays(calendarKey, -1) : calendarKey;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(dayKey: DayKey): number {
  assertDayKey(dayKey);
  return getISODay(parse(dayKey)) - 1;
}

export function repeatsOn(repeatMask: number, dayKey: DayKey): boolean {
  return ((repeatMask >> weekdayIndex(dayKey)) & 1) === 1;
}

/** The Monday of the week containing dayKey. */
export function weekStartOf(dayKey: DayKey): DayKey {
  return addDays(dayKey, -weekdayIndex(dayKey));
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
  assertDayKey(a);
  assertDayKey(b);
  return a < b ? -1 : a > b ? 1 : 0;
}
