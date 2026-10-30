import { useMemo } from 'react';
import { listDays, loadDayBundle } from '../../data/repos/days';
import { collectionItems } from '../../domain/collection';
import { dayNumber, daysShowedUp, focusedHours, marbles } from '../../domain/stats';
import type { DayKey, Session } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

export interface ProfileStats {
  dayNumber: number;
  daysShowedUp: number;
  focusedHours: number;
  marbles: number;
}

/**
 * Lifetime numbers for the Profile (doc 04 section 10), from days rows up to and including today.
 * Tomorrow's planning marble belongs to tomorrow: it counts once tomorrow arrives.
 */
export function useProfileStats(): ProfileStats {
  const version = useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = resolveTodayKey(db, at);
    const days = listDays(db, '0000-01-01', todayKey);
    const counts: Record<DayKey, number> = {};
    const sessions: Session[] = [];
    for (const d of days) {
      const bundle = loadDayBundle(db, d.dayKey);
      if (!bundle) continue;
      counts[d.dayKey] = collectionItems(bundle, at).length;
      for (const list of Object.values(bundle.sessionsByDayTask)) sessions.push(...list);
    }
    return {
      dayNumber: dayNumber(days[0]?.dayKey ?? null, todayKey),
      daysShowedUp: daysShowedUp(counts),
      focusedHours: focusedHours(sessions, at),
      marbles: marbles(counts),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version]);
}
