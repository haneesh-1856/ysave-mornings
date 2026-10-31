import { and, asc, eq, isNull, max, ne } from 'drizzle-orm';
import { NO_TOPIC_ID, type ColorKey, type Epoch, type Topic } from '../../domain/types';
import { NotFoundError, ValidationError } from '../errors';
import { tasks, topics } from '../schema';
import type { DB } from '../types';
import { toTopic } from './mappers';

export const TOPIC_NAME_MAX = 24;
const COLOR_KEYS: readonly ColorKey[] = ['study', 'health', 'home', 'sun', 'c4', 'c5'];

function validName(name: string): string {
  const n = name.trim();
  if (n.length < 1 || n.length > TOPIC_NAME_MAX) {
    throw new ValidationError('name', `Topic name must be 1-${TOPIC_NAME_MAX} characters`);
  }
  return n;
}

function validColor(colorKey: ColorKey): ColorKey {
  if (!COLOR_KEYS.includes(colorKey)) throw new ValidationError('colorKey', `Unknown colorKey ${String(colorKey)}`);
  return colorKey;
}

/** Topics that are not deleted, in sortOrder; includes the built-in No topic (last). Grouping and names use this. */
export function listTopics(db: DB): Topic[] {
  return db.select().from(topics).where(isNull(topics.deletedAt)).orderBy(asc(topics.sortOrder)).all().map(toTopic);
}

/** The topics the user made: listTopics without the built-in No topic. Management screens and the empty-library checks use this. */
export function listUserTopics(db: DB): Topic[] {
  return listTopics(db).filter(x => x.id !== NO_TOPIC_ID);
}

function refuseNoTopic(id: string, what: string): void {
  if (id === NO_TOPIC_ID) throw new ValidationError('id', `No topic cannot be ${what}`);
}

/** Includes deleted topics (history may still reference them). */
export function getTopic(db: DB, id: string): Topic | null {
  const row = db.select().from(topics).where(eq(topics.id, id)).get();
  return row ? toTopic(row) : null;
}

export function createTopic(
  db: DB,
  input: { name: string; colorKey: ColorKey },
  now: Epoch,
  newId: () => string,
): Topic {
  const name = validName(input.name);
  const colorKey = validColor(input.colorKey);
  return db.transaction((tx) => {
    const top = tx.select({ m: max(topics.sortOrder) }).from(topics).where(ne(topics.id, NO_TOPIC_ID)).get();
    const row = {
      id: newId(),
      name,
      colorKey,
      sortOrder: (top?.m ?? -1) + 1,
      isOpen: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(topics).values(row).run();
    return toTopic(row);
  });
}

export function updateTopic(
  db: DB,
  id: string,
  patch: Partial<Pick<Topic, 'name' | 'colorKey' | 'isOpen' | 'sortOrder'>>,
  now: Epoch,
): Topic {
  if (patch.name !== undefined || patch.colorKey !== undefined || patch.sortOrder !== undefined) refuseNoTopic(id, 'renamed, recoloured or moved');
  const set: Partial<typeof topics.$inferInsert> = { updatedAt: now };
  if (patch.name !== undefined) set.name = validName(patch.name);
  if (patch.colorKey !== undefined) set.colorKey = validColor(patch.colorKey);
  if (patch.isOpen !== undefined) set.isOpen = patch.isOpen;
  if (patch.sortOrder !== undefined) {
    if (!Number.isInteger(patch.sortOrder)) throw new ValidationError('sortOrder', 'sortOrder must be an integer');
    set.sortOrder = patch.sortOrder;
  }
  db.update(topics).set(set).where(eq(topics.id, id)).run();
  const topic = getTopic(db, id);
  if (!topic) throw new NotFoundError(`Topic ${id} not found`);
  return topic;
}

/**
 * Soft delete (doc 04 §11): the topic and all its tasks get deletedAt = now, in one transaction.
 * With `moves`, each listed task first joins the end of its own target topic (tasks sent to the same target keep their
 * old order) and so is not deleted; a bad target or task id throws before anything is written. Day rows are snapshots
 * and are not touched.
 */
export function softDeleteTopic(db: DB, id: string, now: Epoch, opts?: { moves: { taskId: string; toTopicId: string }[] }): void {
  refuseNoTopic(id, 'deleted');
  db.transaction((tx) => {
    if (opts) {
      const own = tx.select().from(tasks).where(and(eq(tasks.topicId, id), isNull(tasks.deletedAt))).orderBy(asc(tasks.sortOrder)).all();
      const target = new Map<string, string>();
      for (const m of opts.moves) {
        if (target.has(m.taskId)) throw new ValidationError('moves', 'A task can only move once');
        if (!own.some(t => t.id === m.taskId)) throw new ValidationError('moves', 'Only tasks of this topic can be moved');
        const live = tx.select({ id: topics.id }).from(topics).where(and(eq(topics.id, m.toTopicId), isNull(topics.deletedAt))).get();
        if (m.toTopicId === id || !live) throw new ValidationError('toTopicId', `Topic ${m.toTopicId} does not exist`);
        target.set(m.taskId, m.toTopicId);
      }
      const next = new Map<string, number>();
      for (const t of own) { // old order, so tasks sent to one target keep their relative order
        const to = target.get(t.id);
        if (to === undefined) continue;
        if (!next.has(to)) next.set(to, (tx.select({ m: max(tasks.sortOrder) }).from(tasks).where(eq(tasks.topicId, to)).get()?.m ?? -1) + 1);
        const order = next.get(to)!;
        next.set(to, order + 1);
        tx.update(tasks).set({ topicId: to, sortOrder: order, updatedAt: now }).where(eq(tasks.id, t.id)).run();
      }
    }
    tx.update(topics).set({ deletedAt: now, updatedAt: now }).where(and(eq(topics.id, id), isNull(topics.deletedAt))).run();
    tx.update(tasks).set({ deletedAt: now, updatedAt: now }).where(and(eq(tasks.topicId, id), isNull(tasks.deletedAt))).run();
  });
}
