import { useMemo } from 'react';
import { getSetting } from '../../data/repos/settings';
import { normalizeFavourites, type LookFavourite } from '../../theme/favourites';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** The Look screen's favourites, most recently used first (absent or corrupt -> the seeds). */
export function useLookFavourites(): LookFavourite[] {
  const version = useDataVersion(['settings']);
  const db = getDb();
  return useMemo(
    () => normalizeFavourites(getSetting(db, 'lookFavourites')),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
