import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import type { Day, DayKey, DayTask } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** A day's stored plan for the Planned screen: rows by sortOrder and the jar's items. */
export function useDayPlan(dayKey: DayKey): { day: Day | null; rows: DayTask[]; items: CollectionItem[] } {
  const version = useDataVersion(['days', 'sessions']);
  const db = getDb();
  return useMemo(() => {
    const bundle = loadDayBundle(db, dayKey);
    if (!bundle) return { day: null, rows: [], items: [] };
    const rows = [...bundle.dayTasks].sort((a, b) => a.sortOrder - b.sortOrder);
    return { day: bundle.day, rows, items: collectionItems(bundle, now()) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, dayKey, version]);
}
