import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import { listTopics } from '../../data/repos/topics';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import { dayKeyOf } from '../../domain/dayKey';
import { timerState } from '../../domain/timer';
import type { TimerState } from '../../domain/timer';
import type { Day, DayKey, DayTask, Session } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';

export interface TodayRow {
  dayTask: DayTask;
  topicName: string;
  state: TimerState | 'check-open' | 'check-done';
  sessions: Session[];
}

export interface TodayView {
  todayKey: DayKey;
  day: Day | null;
  closed: boolean;
  rows: TodayRow[];
  done: number;
  total: number;
  items: CollectionItem[];
}

/**
 * Today's rows (topic order, then sortOrder). Re-reads when days/sessions/topics/tasks/settings change.
 * It does NOT tick: remaining/overtime are computed by the UI from `sessions` + useNow in the running row only.
 */
export function useToday(): TodayView {
  const version = useDataVersion(['days', 'sessions', 'topics', 'tasks', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = dayKeyOf(at, getDayStartHour(db));
    const bundle = loadDayBundle(db, todayKey);
    if (!bundle) return { todayKey, day: null, closed: false, rows: [], done: 0, total: 0, items: [] };
    const topics = listTopics(db);
    const order = new Map(topics.map((t, i) => [t.id, i]));
    const names = new Map(topics.map((t) => [t.id, t.name]));
    const rank = (t: DayTask): number => order.get(t.topicId) ?? Number.MAX_SAFE_INTEGER;
    const rows: TodayRow[] = [...bundle.dayTasks]
      .sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder)
      .map((dayTask) => {
        const sessions = bundle.sessionsByDayTask[dayTask.id] ?? [];
        const state: TodayRow['state'] =
          dayTask.kind === 'timed'
            ? timerState(dayTask, sessions)
            : dayTask.completedAt === null ? 'check-open' : 'check-done';
        return { dayTask, topicName: names.get(dayTask.topicId) ?? 'Removed topic', state, sessions };
      });
    return {
      todayKey,
      day: bundle.day,
      closed: bundle.day.closedAt !== null,
      rows,
      done: rows.filter((r) => r.dayTask.completedAt !== null).length,
      total: rows.length,
      items: collectionItems(bundle, at),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version]);
}
