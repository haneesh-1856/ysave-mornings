import { and, asc, eq, isNull, max } from 'drizzle-orm';
import { MINUTES, type Epoch, type Task, type TaskKind } from '../../domain/types';
import { NotFoundError, ValidationError } from '../errors';
import { tasks } from '../schema';
import type { DB } from '../types';
import { toTask } from './mappers';

export const TASK_NAME_MAX = 40;
export const CUE_MAX = 80;
export const TREAT_MAX = 80;
export const NOTE_MAX = 1000;

export interface TaskInput {
  topicId: string;
  name: string;
  kind: TaskKind;
  minutes: number;
  repeatMask: number;
  isDefault: boolean;
  cue: string | null;
  treat: string | null;
}

function validName(name: string): string {
  const n = name.trim();
  if (n.length < 1 || n.length > TASK_NAME_MAX) {
    throw new ValidationError('name', `Task name must be 1-${TASK_NAME_MAX} characters`);
  }
  return n;
}
function validKind(kind: TaskKind): TaskKind {
  if (kind !== 'timed' && kind !== 'check') throw new ValidationError('kind', `Unknown kind ${String(kind)}`);
  return kind;
}
function validMinutes(m: number): number {
  if (!Number.isInteger(m) || m < MINUTES.min || m > MINUTES.max || m % MINUTES.step !== 0) {
    throw new ValidationError('minutes', `Minutes must be ${MINUTES.min}-${MINUTES.max} in steps of ${MINUTES.step}`);
  }
  return m;
}
function validMask(m: number): number {
  if (!Number.isInteger(m) || m < 0 || m > 127) throw new ValidationError('repeatMask', 'repeatMask must be 0-127');
  return m;
}
/** Trims; empty becomes null. */
function validOptText(field: string, v: string | null, maxLen: number): string | null {
  if (v === null) return null;
  const t = v.trim();
  if (t.length > maxLen) throw new ValidationError(field, `${field} must be at most ${maxLen} characters`);
  return t.length === 0 ? null : t;
}
function validNote(note: string): string {
  if (note.length > NOTE_MAX) throw new ValidationError('note', `note must be at most ${NOTE_MAX} characters`);
  return note;
}

/** Tasks that are not deleted, in topic then sortOrder. Optional topic filter. */
export function listTasks(db: DB, topicId?: string): Task[] {
  const where = topicId === undefined ? isNull(tasks.deletedAt) : and(isNull(tasks.deletedAt), eq(tasks.topicId, topicId));
  return db.select().from(tasks).where(where).orderBy(asc(tasks.topicId), asc(tasks.sortOrder)).all().map(toTask);
}

/** Includes deleted tasks (history reads them). */
export function getTask(db: DB, id: string): Task | null {
  const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
  return row ? toTask(row) : null;
}

export function createTask(db: DB, input: TaskInput, now: Epoch, newId: () => string): Task {
  const v = {
    topicId: input.topicId,
    name: validName(input.name),
    kind: validKind(input.kind),
    minutes: validMinutes(input.minutes),
    repeatMask: validMask(input.repeatMask),
    isDefault: input.isDefault,
    cue: validOptText('cue', input.cue, CUE_MAX),
    treat: validOptText('treat', input.treat, TREAT_MAX),
  };
  return db.transaction((tx) => {
    const top = tx.select({ m: max(tasks.sortOrder) }).from(tasks).where(eq(tasks.topicId, v.topicId)).get();
    const row = {
      id: newId(),
      ...v,
      note: '',
      sortOrder: (top?.m ?? -1) + 1,
      deletedAt: null,
      defaultChangedAt: v.isDefault ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(tasks).values(row).run();
    return toTask(row);
  });
}

export function updateTask(
  db: DB,
  id: string,
  patch: Partial<TaskInput & { sortOrder: number }>,
  now: Epoch,
): Task {
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
  if (patch.topicId !== undefined) set.topicId = patch.topicId;
  if (patch.name !== undefined) set.name = validName(patch.name);
  if (patch.kind !== undefined) set.kind = validKind(patch.kind);
  if (patch.minutes !== undefined) set.minutes = validMinutes(patch.minutes);
  if (patch.repeatMask !== undefined) set.repeatMask = validMask(patch.repeatMask);
  if (patch.isDefault !== undefined) {
    set.isDefault = patch.isDefault;
    // only a real change moves the stamp, so saving the editor with the switch untouched never re-ticks a task
    const before = db.select({ d: tasks.isDefault }).from(tasks).where(eq(tasks.id, id)).get();
    if (before && before.d !== patch.isDefault) set.defaultChangedAt = now;
  }
  if (patch.cue !== undefined) set.cue = validOptText('cue', patch.cue, CUE_MAX);
  if (patch.treat !== undefined) set.treat = validOptText('treat', patch.treat, TREAT_MAX);
  if (patch.sortOrder !== undefined) {
    if (!Number.isInteger(patch.sortOrder)) throw new ValidationError('sortOrder', 'sortOrder must be an integer');
    set.sortOrder = patch.sortOrder;
  }
  db.update(tasks).set(set).where(eq(tasks.id, id)).run();
  const task = getTask(db, id);
  if (!task) throw new NotFoundError(`Task ${id} not found`);
  return task;
}

/** Notes live on the library task (doc 04 §2), not on the day. */
export function setTaskNote(db: DB, id: string, note: string, now: Epoch): void {
  const n = validNote(note);
  if (!getTask(db, id)) throw new NotFoundError(`Task ${id} not found`);
  db.update(tasks).set({ note: n, updatedAt: now }).where(eq(tasks.id, id)).run();
}

export function softDeleteTask(db: DB, id: string, now: Epoch): void {
  db.update(tasks).set({ deletedAt: now, updatedAt: now }).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).run();
}
