import { NO_TOPIC_ID, type ColorKey, type Task, type Topic } from '../../domain/types';
import * as tasksRepo from '../../data/repos/tasks';
import * as topicsRepo from '../../data/repos/topics';
import type { TaskInput } from '../../data/repos/tasks';
import { NotFoundError } from '../../data/errors';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';

/** Starting values for a draft task in the UI (not written until it has a name). */
export const DEFAULT_TASK = {
  kind: 'timed',
  minutes: 30,
  repeatMask: 0,
  isDefault: false,
  cue: null,
  treat: null,
} as const;

export function createTopic(input: { name: string; colorKey: ColorKey }): Topic {
  const topic = topicsRepo.createTopic(getDb(), input, now(), newId);
  bump('topics');
  return topic;
}

export function updateTopic(id: string, patch: { name?: string; colorKey?: ColorKey; isOpen?: boolean }): Topic {
  const topic = topicsRepo.updateTopic(getDb(), id, patch, now());
  bump('topics');
  return topic;
}

/**
 * Soft delete; the repo cascades to the topic's tasks. `moves` first sends each listed task to its own target
 * (another live topic or No topic) in the same transaction (ADR-013); tasks not listed are deleted with the topic.
 */
export function removeTopic(id: string, opts?: { moves: { taskId: string; toTopicId: string }[] }): void {
  topicsRepo.softDeleteTopic(getDb(), id, now(), opts);
  bump('topics', 'tasks');
}

/** Swaps sortOrder with the neighbour in that direction. No-op at the ends (or for an unknown id). */
export function moveTopic(id: string, dir: -1 | 1): void {
  const db = getDb();
  const t = now();
  const moved = db.transaction((tx) => {
    const list = topicsRepo.listUserTopics(tx as typeof db);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    const a = list[i];
    const b = list[j];
    topicsRepo.updateTopic(tx as typeof db, a.id, { sortOrder: b.sortOrder }, t);
    topicsRepo.updateTopic(tx as typeof db, b.id, { sortOrder: a.sortOrder }, t);
    return true;
  });
  if (moved) bump('topics');
}

/** A missing or null topicId puts the task in the built-in No topic (ADR-012). */
export function createTask(topicId: string | null | undefined, input: { name: string } & Partial<Omit<TaskInput, 'topicId'>>): Task {
  const { name, ...rest } = input;
  const task = tasksRepo.createTask(getDb(), { ...DEFAULT_TASK, ...rest, name, topicId: topicId ?? NO_TOPIC_ID }, now(), newId);
  bump('tasks');
  return task;
}

/** `patch.topicId` moves the task to the end of that topic (a live topic or NO_TOPIC_ID); anything else is refused. */
export function updateTask(id: string, patch: Partial<TaskInput>): Task {
  const task = tasksRepo.updateTask(getDb(), id, patch, now());
  bump('tasks');
  return task;
}

export function setTaskNote(id: string, note: string): Task {
  const db = getDb();
  tasksRepo.setTaskNote(db, id, note, now());
  const task = tasksRepo.getTask(db, id);
  if (!task) throw new NotFoundError(`Task ${id} not found`);
  bump('tasks');
  return task;
}

export function removeTask(id: string): void {
  tasksRepo.softDeleteTask(getDb(), id, now());
  bump('tasks');
}
