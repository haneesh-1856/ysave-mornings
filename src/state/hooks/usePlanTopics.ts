import { useMemo } from 'react';
import { listTopics } from '../../data/repos/topics';
import type { Topic } from '../../domain/types';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** Live (not deleted) topics in sortOrder, for the Plan / Planned screens. Re-reads when topics change. */
export function usePlanTopics(): Topic[] {
  const version = useDataVersion(['topics']);
  const db = getDb();
  return useMemo(
    () => listTopics(db).filter(x => x.deletedAt == null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, version],
  );
}
