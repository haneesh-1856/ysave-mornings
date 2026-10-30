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

/**
 * The hour day `dayKey` ENDS at (its boundary with the next day): its own row's snapshot; for a day with no
 * row, the next day's row snapshot (that row was created under the hour in force when it began, and rows
 * after today always carry the setting); only with neither, the setting. So a setting change can never
 * move the boundary into an existing today, even when yesterday has no row.
 */
export function dayEndHourOf(
  dayKey: DayKey,
  settingHour: number,
  snapshotOf: (k: DayKey) => number | undefined,
): number {
  return snapshotOf(dayKey) ?? snapshotOf(addDays(dayKey, 1)) ?? settingHour;
}

/**
 * The day running at `now` when each day ends at its own hour (doc 04 section 1, see dayEndHourOf).
 * Day D runs [end(D-1), end(D)) with end(D) = dayEndOf(D, dayEndHourOf(D)), always within D+1's calendar
 * date (00:00-23:00), so the days never overlap or skip and today is either the calendar date c of `now`
 * or c-1: c-1 while it has not ended yet, else c. With no rows (or equal hours everywhere) this equals
 * dayKeyOf(now, settingHour).
 */
export function currentDayKey(
  now: Epoch,
  settingHour: number,
  snapshotOf: (k: DayKey) => number | undefined,
): DayKey {
  assertHour(settingHour);
  if (!Number.isFinite(now)) throw new Error(`Invalid instant: ${now}`);
  const prev = addDays(toKey(new Date(now)), -1);
  return now < dayEndOf(prev, dayEndHourOf(prev, settingHour, snapshotOf)) ? prev : addDays(prev, 1);
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
