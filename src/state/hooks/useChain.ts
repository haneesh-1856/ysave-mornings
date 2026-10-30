import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import { chain } from '../../domain/calendar';
import type { ChainLink } from '../../domain/calendar';
import { collectionItems } from '../../domain/collection';
import { addDays, dayKeyOf } from '../../domain/dayKey';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** The soft chain (doc 04 section 9): 8 links, today-7 .. today. A missing day counts as 0 items (a rest day). */
export function useChain(): ChainLink[] {
  const version = useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = dayKeyOf(at, getDayStartHour(db));
    const counts: Record<DayKey, number> = {};
    for (let i = 7; i >= 1; i--) {
      const key = addDays(todayKey, -i);
      const bundle = loadDayBundle(db, key);
      counts[key] = bundle ? collectionItems(bundle, at).length : 0;
    }
    return chain(todayKey, counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version]);
}
