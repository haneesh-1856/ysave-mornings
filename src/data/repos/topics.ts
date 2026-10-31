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

/** Soft delete (doc 04 §11): the topic and all its tasks get deletedAt = now, in one transaction. */
export function softDeleteTopic(db: DB, id: string, now: Epoch): void {
  refuseNoTopic(id, 'deleted');
  db.transaction((tx) => {
    tx.update(topics).set({ deletedAt: now, updatedAt: now }).where(and(eq(topics.id, id), isNull(topics.deletedAt))).run();
    tx.update(tasks).set({ deletedAt: now, updatedAt: now }).where(and(eq(tasks.topicId, id), isNull(tasks.deletedAt))).run();
  });
}
