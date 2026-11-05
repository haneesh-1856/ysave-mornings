import { useMemo } from 'react';
import { getMomentsEnabled } from '../../data/repos/settings';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** Whether the moments at close are on (default true). */
export function useMomentsEnabled(): boolean {
  const version = useDataVersion(['settings']);
  const db = getDb();
  return useMemo(
    () => getMomentsEnabled(db),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
