import { useMemo } from 'react';
import { loadDayBundle } from '../../data/repos/days';
import { listTopics } from '../../data/repos/topics';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import { addDays } from '../../domain/dayKey';
import { unfinishedTasks } from '../../domain/rollover';
import { focusedMs, overtimeMs } from '../../domain/timer';
import type { ColorKey, Day, DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

/** An unticked check, or a timed task with minutes left (then `leftoverMin`, rounded up, is set). */
export interface UnfinishedRow {
  dayTaskId: string;
  name: string;
  topicName: string;
  colorKey: ColorKey;
  leftoverMin?: number;
}

export interface CloseSummary {
  todayKey: DayKey;
  day: Day | null;
  closed: boolean;
  unfinished: UnfinishedRow[];
  done: number;
  total: number;
  focusedMs: number;
  extraMs: number;
  items: CollectionItem[];
  tomorrowKey: DayKey;
}

/** Everything the Close screen shows about today. Re-reads on days/sessions/topics/tasks/settings changes. */
export function useCloseSummary(): CloseSummary {
  const version = useDataVersion(['days', 'sessions', 'topics', 'tasks', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = resolveTodayKey(db, at);
    const tomorrowKey = addDays(todayKey, 1);
    const bundle = loadDayBundle(db, todayKey);
    const base = { todayKey, tomorrowKey };
    if (!bundle) {
      return { ...base, day: null, closed: false, unfinished: [], done: 0, total: 0, focusedMs: 0, extraMs: 0, items: [] };
    }
    const names = new Map(listTopics(db).map((t) => [t.id, t.name]));
    const tasks = [...bundle.dayTasks].sort((a, b) => a.sortOrder - b.sortOrder);
    let focused = 0;
    let extra = 0;
    for (const t of tasks) {
      const sessions = bundle.sessionsByDayTask[t.id] ?? [];
      focused += focusedMs(sessions, at);
      if (t.kind === 'timed') extra += overtimeMs(t.budgetSec, sessions, at);
    }
    return {
      ...base,
      day: bundle.day,
      closed: bundle.day.closedAt !== null,
      unfinished: unfinishedTasks(bundle, at).map(({ task: t, leftoverMin }) => ({
        dayTaskId: t.id,
        name: t.name,
        topicName: names.get(t.topicId) ?? 'Removed topic',
        colorKey: t.colorKey,
        ...(leftoverMin !== undefined ? { leftoverMin } : {}),
      })),
      done: tasks.filter((t) => t.completedAt !== null).length,
      total: tasks.length,
      focusedMs: focused,
      extraMs: extra,
      items: collectionItems(bundle, at),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version]);
}
