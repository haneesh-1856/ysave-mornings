import { useMemo } from 'react';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { Task, Topic } from '../../domain/types';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

/** What deleting a topic can still move: its live tasks (in order) and the topics they may go to (No topic first, the topic itself left out). */
export function useTopicRemoval(id: string): { tasks: Task[]; targets: Topic[] } {
  const version = useDataVersion(['topics', 'tasks']);
  const db = getDb();
  return useMemo(() => {
    const targets = listTopics(db).filter(t => t.id !== id);
    return { tasks: listTasks(db, id), targets };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, id, version]);
}
