import { useMemo } from 'react';
import { getDayStartHour } from '../../data/repos/settings';
import type { Epoch } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayEnd } from '../today';

/** The "my day starts" setting plus the instant today really ends (differs right after a change). */
export function useDayStart(): { hour: number; todayEndsAt: Epoch } {
  const version = useDataVersion(['settings', 'days']);
  const db = getDb();
  return useMemo(
    () => ({ hour: getDayStartHour(db), todayEndsAt: todayEnd(db, now()) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
