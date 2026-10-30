import { useMemo } from 'react';
import { listDays, loadDayBundle } from '../../data/repos/days';
import { getSetting, setSetting } from '../../data/repos/settings';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import { addDays } from '../../domain/dayKey';
import { dayNumber } from '../../domain/stats';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { bump, useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

export const MORNING_SETTING = 'morningShownFor';

export interface MorningView {
  due: boolean;
  todayKey: DayKey;
  dayNumber: number;
  plannedToday: boolean;
  items: CollectionItem[];
}

/**
 * Morning is due when there is history before today (at least one earlier days row) and it has not been
 * shown for today yet. First-ever use never shows it.
 */
export function useMorning(): MorningView {
  const version = useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = resolveTodayKey(db, at);
    const earlier = listDays(db, '0000-01-01', addDays(todayKey, -1));
    const shownFor = getSetting(db, MORNING_SETTING);
    const bundle = loadDayBundle(db, todayKey);
    return {
      due: earlier.length > 0 && shownFor !== todayKey,
      todayKey,
      dayNumber: dayNumber(earlier[0]?.dayKey ?? bundle?.day.dayKey ?? null, todayKey),
      plannedToday: bundle?.day.planConfirmedAt != null,
      items: bundle ? collectionItems(bundle, at) : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version]);
}

/** Records that Morning was shown for today's key (so it shows once per day). */
export function markMorningSeen(): void {
  const db = getDb();
  const at = now();
  setSetting(db, MORNING_SETTING, resolveTodayKey(db, at), at);
  bump('settings');
}
