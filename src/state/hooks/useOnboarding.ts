import { useMemo } from 'react';
import { listDays } from '../../data/repos/days';
import { getSetting } from '../../data/repos/settings';
import { listTopics } from '../../data/repos/topics';
import { ONBOARDED_SETTING } from '../actions/onboarding';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/**
 * True when the welcome flow should show: no `onboardedAt` AND no topics AND no days rows.
 * Existing installs (any topic or day) count as onboarded, so nobody already using the app sees it.
 */
export function needsOnboarding(): boolean {
  const db = getDb();
  if (getSetting(db, ONBOARDED_SETTING) != null) return false;
  if (listTopics(db).length > 0) return false;
  return listDays(db, '0000-01-01', '9999-12-31').length === 0;
}

export function useNeedsOnboarding(): boolean {
  const version = useDataVersion(['settings', 'topics', 'days']);
  const db = getDb();
  return useMemo(
    () => needsOnboarding(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
