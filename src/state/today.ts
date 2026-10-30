import { getDay } from '../data/repos/days';
import { getDayStartHour } from '../data/repos/settings';
import type { DB } from '../data/types';
import { currentDayKey, dayEndHourOf, dayEndOf } from '../domain/dayKey';
import type { DayKey, Epoch } from '../domain/types';

/** The one place that resolves "what is today": each day ends at its own snapshotted hour (doc 04 section 1). */
export function todayKey(db: DB, at: Epoch): DayKey {
  return currentDayKey(at, getDayStartHour(db), (k) => getDay(db, k)?.dayStartHour);
}

/** The instant today really ends: the same boundary todayKey uses (its snapshot; if rowless, see dayEndHourOf). */
export function todayEnd(db: DB, at: Epoch): Epoch {
  const key = todayKey(db, at);
  return dayEndOf(key, dayEndHourOf(key, getDayStartHour(db), (k) => getDay(db, k)?.dayStartHour));
}
