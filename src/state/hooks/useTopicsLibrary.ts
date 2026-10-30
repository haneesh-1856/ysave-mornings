import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import { listTasks } from '../../data/repos/tasks';
import { getTopic, listTopics } from '../../data/repos/topics';
import type { CollectionItem } from '../../domain/collection';
import { addDays, dayKeyOf, weekStartOf } from '../../domain/dayKey';
import { topicWeeklyMinutes, weekDots } from '../../domain/stats';
import type { DayBundle, Task, Topic } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

export interface TopicEntry {
  topic: Topic;
  tasks: Task[];
  weeklyMinutes: number;
  weekDots: CollectionItem[];
}

export function useTopicsLibrary(): { topics: TopicEntry[]; taskCount: number } {
  const version = useDataVersion(['topics', 'tasks', 'days']);
  const db = getDb();
  const at = now();
  const dayKey = dayKeyOf(at, getDayStartHour(db)); // cheap; a new day recomputes the memo
  return useMemo(() => {
    const topics = listTopics(db);
    const tasks = listTasks(db);
    const start = weekStartOf(dayKey);
    const bundles: DayBundle[] = [];
    for (let i = 0; i < 7; i++) {
      const b = loadDayBundle(db, addDays(start, i));
      if (b) bundles.push(b);
    }
    const entries = topics.map(topic => {
      const own = tasks.filter(t => t.topicId === topic.id);
      return {
        topic,
        tasks: own,
        weeklyMinutes: topicWeeklyMinutes(own, topic.id),
        weekDots: weekDots(topic.id, bundles, at),
      };
    });
    return { topics: entries, taskCount: entries.reduce((n, e) => n + e.tasks.length, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version and dayKey are the invalidation keys
  }, [db, version, dayKey]);
}

export function useTopic(id: string): Topic | null {
  const version = useDataVersion(['topics']);
  const db = getDb();
  return useMemo(() => {
    const topic = getTopic(db, id);
    return topic && topic.deletedAt === null ? topic : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, id, version]);
}
