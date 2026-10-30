import { useMemo } from 'react';
import { getTask } from '../../data/repos/tasks';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** The library task's note; '' for a null id, an unknown task or a task with no note. Re-reads when tasks change. */
export function useTaskNote(taskId: string | null): string {
  const version = useDataVersion(['tasks']);
  const db = getDb();
  return useMemo(
    () => (taskId == null ? '' : getTask(db, taskId)?.note ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
    [db, taskId, version],
  );
}
