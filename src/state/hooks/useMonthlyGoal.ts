import { useMemo } from 'react';
import { getMonthlyGoalHours } from '../../data/repos/settings';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** The monthly focus goal in whole hours, or null when there is none. */
export function useMonthlyGoal(): number | null {
  const version = useDataVersion(['settings']);
  const db = getDb();
  return useMemo(
    () => getMonthlyGoalHours(db),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
