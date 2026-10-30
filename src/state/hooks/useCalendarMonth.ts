import { useMemo } from 'react';
import { listDays, loadDayBundle } from '../../data/repos/days';
import { glows, monthGrid } from '../../domain/calendar';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import { addDays, compareDayKeys } from '../../domain/dayKey';
import { dayNumber } from '../../domain/stats';
import type { DayKey, MonthKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

export interface CalendarCell {
  dayKey: DayKey;
  items: CollectionItem[];
  glows: boolean;
  closed: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isFuture: boolean;
  /** A saved draft on a future day (ADR-010); never a planned day. */
  drafted: boolean;
}

export interface CalendarMonth {
  month: MonthKey;
  weeks: (CalendarCell | null)[][];
  todayKey: DayKey;
  tomorrowKey: DayKey;
  dayNumber: number;
}

/** One month of the Calendar (any month, past or future). Only days with a row are read; the rest are empty cells. */
export function useCalendarMonth(month: MonthKey): CalendarMonth {
  const version = useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = resolveTodayKey(db, at);
    const tomorrowKey = addDays(todayKey, 1);
    // One light read of the day rows (no bundles): the first row gives "Day N"; bundles load only for days that exist.
    const allDays = listDays(db, '0000-01-01', '9999-12-31');
    const firstKey = allDays[0]?.dayKey ?? null;
    const existing = new Set(allDays.map((d) => d.dayKey));
    const weeks = monthGrid(month).map((week) =>
      week.map((dayKey): CalendarCell | null => {
        if (dayKey === null) return null;
        const bundle = existing.has(dayKey) ? loadDayBundle(db, dayKey) : null;
        return {
          dayKey,
          items: bundle ? collectionItems(bundle, at) : [],
          glows: bundle ? glows(bundle, todayKey) : false,
          closed: bundle?.day.closedAt != null,
          isToday: dayKey === todayKey,
          isTomorrow: dayKey === tomorrowKey,
          isFuture: compareDayKeys(dayKey, todayKey) > 0,
          drafted:
            compareDayKeys(dayKey, todayKey) > 0 && bundle != null && bundle.day.planDraftedAt !== null &&
            bundle.day.planConfirmedAt === null,
        };
      }),
    );
    return {
      month,
      weeks,
      todayKey,
      tomorrowKey,
      dayNumber: dayNumber(firstKey, todayKey),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version, month]);
}
