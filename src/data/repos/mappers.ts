import type { days, dayTasks, sessions, tasks, topics } from '../schema';
import type { Day, DayTask, Session, Task, Topic } from '../../domain/types';
import type { DB } from '../types';

/** A db or the transaction handle passed to a `db.transaction` callback. */
export type Executor = Pick<DB, 'select' | 'insert' | 'update' | 'delete'>;

type TopicRow = typeof topics.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type DayRow = typeof days.$inferSelect;
type DayTaskRow = typeof dayTasks.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

export const toTopic = (r: TopicRow): Topic => ({
  id: r.id,
  name: r.name,
  colorKey: r.colorKey,
  sortOrder: r.sortOrder,
  isOpen: r.isOpen,
  deletedAt: r.deletedAt ?? null,
});

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  topicId: r.topicId,
  name: r.name,
  kind: r.kind,
  minutes: r.minutes,
  repeatMask: r.repeatMask,
  isDefault: r.isDefault,
  cue: r.cue ?? null,
  treat: r.treat ?? null,
  note: r.note,
  sortOrder: r.sortOrder,
  deletedAt: r.deletedAt ?? null,
  defaultChangedAt: r.defaultChangedAt ?? null,
});

export const toDay = (r: DayRow): Day => ({
  dayKey: r.dayKey,
  planConfirmedAt: r.planConfirmedAt ?? null,
  planDraftedAt: r.planDraftedAt ?? null,
  planUpdatedAt: r.planUpdatedAt ?? null,
  closedAt: r.closedAt ?? null,
  closedBy: r.closedBy ?? null,
  dayStartHour: r.dayStartHour,
});

export const toDayTask = (r: DayTaskRow): DayTask => ({
  id: r.id,
  dayKey: r.dayKey,
  taskId: r.taskId ?? null,
  topicId: r.topicId,
  name: r.name,
  colorKey: r.colorKey,
  kind: r.kind,
  budgetSec: r.budgetSec,
  cue: r.cue ?? null,
  treat: r.treat ?? null,
  forwardedFromDayKey: r.forwardedFromDayKey ?? null,
  completedAt: r.completedAt ?? null,
  closeOutcome: r.closeOutcome ?? null,
  sortOrder: r.sortOrder,
});

export const toSession = (r: SessionRow): Session => ({
  id: r.id,
  dayTaskId: r.dayTaskId,
  startedAt: r.startedAt,
  endedAt: r.endedAt ?? null,
});
