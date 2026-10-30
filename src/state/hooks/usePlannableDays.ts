import { useMemo } from 'react';
import { getDay } from '../../data/repos/days';
import { plannableDays } from '../../domain/plan';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

/** Tomorrow always; today only while it has no confirmed plan. Past days never. */
export function usePlannableDays(): { todayKey: DayKey; days: DayKey[] } {
  const version = useDataVersion(['days', 'settings']);
  const db = getDb();
  const todayKey = resolveTodayKey(db, now()); // a new day recomputes the memo
  return useMemo(
    () => ({ todayKey, days: plannableDays(todayKey, getDay(db, todayKey)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version and todayKey are the invalidation keys
    [db, version, todayKey],
  );
}
