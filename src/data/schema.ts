import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ClosedBy, CloseOutcome, ColorKey, TaskKind } from '../domain/types';

const COLOR_KEYS = ['study', 'health', 'home', 'sun', 'c4', 'c5'] as const satisfies readonly ColorKey[];
const TASK_KINDS = ['timed', 'check'] as const satisfies readonly TaskKind[];
const CLOSED_BY = ['user', 'auto'] as const satisfies readonly ClosedBy[];
const CLOSE_OUTCOMES = ['moved', 'let_go'] as const satisfies readonly CloseOutcome[];

// Every table carries createdAt/updatedAt (epoch ms). Library tables also soft-delete.
const timestamps = {
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
};

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  colorKey: text('colorKey', { enum: COLOR_KEYS }).notNull(),
  sortOrder: integer('sortOrder').notNull(),
  isOpen: integer('isOpen', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deletedAt'),
  ...timestamps,
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  topicId: text('topicId')
    .notNull()
    .references(() => topics.id),
  name: text('name').notNull(),
  kind: text('kind', { enum: TASK_KINDS }).notNull(),
  minutes: integer('minutes').notNull(),
  repeatMask: integer('repeatMask').notNull(),
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull(),
  cue: text('cue'),
  treat: text('treat'),
  note: text('note').notNull(),
  sortOrder: integer('sortOrder').notNull(),
  deletedAt: integer('deletedAt'),
  ...timestamps,
});

export const days = sqliteTable('days', {
  dayKey: text('dayKey').primaryKey(),
  planConfirmedAt: integer('planConfirmedAt'),
  closedAt: integer('closedAt'),
  closedBy: text('closedBy', { enum: CLOSED_BY }),
  dayStartHour: integer('dayStartHour').notNull(),
  ...timestamps,
});

export const dayTasks = sqliteTable(
  'day_tasks',
  {
    id: text('id').primaryKey(),
    dayKey: text('dayKey')
      .notNull()
      .references(() => days.dayKey),
    taskId: text('taskId').references(() => tasks.id),
    topicId: text('topicId').notNull(),
    name: text('name').notNull(),
    colorKey: text('colorKey', { enum: COLOR_KEYS }).notNull(),
    kind: text('kind', { enum: TASK_KINDS }).notNull(),
    budgetSec: integer('budgetSec').notNull(),
    cue: text('cue'),
    treat: text('treat'),
    forwardedFromDayKey: text('forwardedFromDayKey'),
    completedAt: integer('completedAt'),
    closeOutcome: text('closeOutcome', { enum: CLOSE_OUTCOMES }),
    sortOrder: integer('sortOrder').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('day_tasks_day_task_unique')
      .on(t.dayKey, t.taskId)
      .where(sql`${t.taskId} IS NOT NULL`),
    index('day_tasks_dayKey_idx').on(t.dayKey),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    dayTaskId: text('dayTaskId')
      .notNull()
      .references(() => dayTasks.id),
    startedAt: integer('startedAt').notNull(),
    endedAt: integer('endedAt'),
    ...timestamps,
  },
  (t) => [
    // At most one open session (endedAt IS NULL) in the whole database.
    uniqueIndex('sessions_one_open')
      .on(sql`(${t.endedAt} IS NULL)`)
      .where(sql`${t.endedAt} IS NULL`),
    index('sessions_dayTaskId_idx').on(t.dayTaskId),
  ],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'), // JSON-encoded
  ...timestamps,
});
