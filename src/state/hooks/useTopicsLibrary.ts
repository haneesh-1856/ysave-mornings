import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { getTopic, listTopics } from '../../data/repos/topics';
import type { CollectionItem } from '../../domain/collection';
import { addDays, weekStartOf } from '../../domain/dayKey';
import { topicWeeklyMinutes, weekDots } from '../../domain/stats';
import { NO_TOPIC_ID, type DayBundle, type Task, type Topic } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey } from '../today';

export interface TopicEntry {
  topic: Topic;
  tasks: Task[];
  weeklyMinutes: number;
  weekDots: CollectionItem[];
}

/** The topics to manage, in order. The built-in No topic is listed (last) only while it holds a live task. */
export function useTopicsLibrary(): { topics: TopicEntry[]; taskCount: number } {
  const version = useDataVersion(['topics', 'tasks', 'days']);
  const db = getDb();
  const at = now();
  const dayKey = todayKey(db, at); // cheap; a new day recomputes the memo
  return useMemo(() => {
    const topics = listTopics(db);
    const tasks = listTasks(db);
    const start = weekStartOf(dayKey);
    const bundles: DayBundle[] = [];
    for (let i = 0; i < 7; i++) {
      const b = loadDayBundle(db, addDays(start, i));
      if (b) bundles.push(b);
    }
    const entries = topics
      .filter(topic => topic.id !== NO_TOPIC_ID || tasks.some(t => t.topicId === NO_TOPIC_ID))
      .map(topic => {
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
    return topic && topic.deletedAt === null && topic.id !== NO_TOPIC_ID ? topic : null; // No topic has no edit screen
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, id, version]);
}
