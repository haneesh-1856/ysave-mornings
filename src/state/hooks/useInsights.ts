import { useMemo } from 'react';
import { listDays, loadDayBundle } from '../../data/repos/days';
import { listTopics } from '../../data/repos/topics';
import { addDays } from '../../domain/dayKey';
import { computeInsights, INSIGHT_DAYS, type Insights } from '../../domain/insights';
import type { DayBundle, Epoch } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

/**
 * Insights for the last 30 days (M14): the day rows of the window, each as a full bundle, plus every topic
 * (deleted ones too, so history keeps its names). Open sessions count up to `at`. Plain, so tests can call it.
 */
export function loadInsights(at: Epoch): Insights {
  const db = getDb();
  const todayKey = resolveTodayKey(db, at);
  const rows = listDays(db, addDays(todayKey, -(INSIGHT_DAYS - 1)), todayKey);
  const days: DayBundle[] = [];
  for (const d of rows) {
    const bundle = loadDayBundle(db, d.dayKey);
    if (bundle) days.push(bundle);
  }
  return computeInsights({ todayKey, at, days, topics: listTopics(db, { includeDeleted: true }) });
}

export function useInsights(): Insights {
  const version = useDataVersion(['days', 'sessions', 'topics', 'tasks', 'settings']);
  return useMemo(
    () => loadInsights(now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [version],
  );
}
