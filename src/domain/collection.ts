import { isGold } from './timer';
import type { ColorKey, Day, DayBundle, DayTask, Epoch } from './types';

// Collection items (doc 04 section 7). Pure: `now` is an argument.

export interface CollectionItem {
  kind: 'planning' | 'task';
  dayTaskId: string | null;
  colorKey: ColorKey;
  small: boolean;
  gold: boolean;
  at: Epoch;
}

function taskItem(t: DayTask, b: DayBundle, now: Epoch): CollectionItem {
  return {
    kind: 'task',
    dayTaskId: t.id,
    colorKey: t.colorKey,
    small: t.kind === 'check',
    gold: t.kind === 'timed' && isGold(t.budgetSec, b.sessionsByDayTask[t.id] ?? [], now),
    at: t.completedAt as Epoch,
  };
}

/** Planning marble first (if the plan was confirmed), then completed tasks by completedAt, ties by sortOrder. */
export function collectionItems(b: DayBundle, now: Epoch): CollectionItem[] {
  const items: CollectionItem[] = [];
  if (b.day.planConfirmedAt !== null) {
    items.push({
      kind: 'planning',
      dayTaskId: null,
      colorKey: 'sun',
      small: false,
      gold: false,
      at: b.day.planConfirmedAt,
    });
  }
  const done = b.dayTasks
    .filter((t) => t.completedAt !== null)
    .sort((a, c) => (a.completedAt as Epoch) - (c.completedAt as Epoch) || a.sortOrder - c.sortOrder);
  for (const t of done) items.push(taskItem(t, b, now));
  return items;
}

/** The lid decoration shows once the day is closed. */
export function isLidClosed(day: Day): boolean {
  return day.closedAt !== null;
}
