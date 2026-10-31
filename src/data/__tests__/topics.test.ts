/** @jest-environment node */
import { ValidationError } from '../errors';
import { createTopic, getTopic, listUserTopics, softDeleteTopic, updateTopic } from '../repos/topics';
import { createTask, getTask, listTasks } from '../repos/tasks';
import { createTestDb } from './testDb';

function setup() {
  const { db } = createTestDb();
  let n = 0;
  const newId = () => `id-${++n}`;
  return { db, newId };
}

describe('topics repo', () => {
  it('creates a trimmed topic, appends sortOrder, returns a domain Topic', () => {
    const { db, newId } = setup();
    const a = createTopic(db, { name: '  Study  ', colorKey: 'study' }, 1000, newId);
    const b = createTopic(db, { name: 'Health', colorKey: 'health' }, 1001, newId);
    expect(a).toEqual({ id: 'id-1', name: 'Study', colorKey: 'study', sortOrder: 0, isOpen: true, deletedAt: null });
    expect(b.sortOrder).toBe(1);
    expect(getTopic(db, 'id-1')).toEqual(a);
    expect(getTopic(db, 'nope')).toBeNull();
    expect(listUserTopics(db).map((t) => t.name)).toEqual(['Study', 'Health']);
    expect(typeof listUserTopics(db)[0].isOpen).toBe('boolean');
  });

  it('validates name length and colorKey', () => {
    const { db, newId } = setup();
    expect(() => createTopic(db, { name: '   ', colorKey: 'study' }, 1, newId)).toThrow(ValidationError);
    expect(() => createTopic(db, { name: 'x'.repeat(25), colorKey: 'study' }, 1, newId)).toThrow(ValidationError);
    expect(createTopic(db, { name: 'x'.repeat(24), colorKey: 'study' }, 1, newId).name).toHaveLength(24);
    // @ts-expect-error invalid color on purpose
    expect(() => createTopic(db, { name: 'ok', colorKey: 'pink' }, 1, newId)).toThrow(ValidationError);
    expect(listUserTopics(db)).toHaveLength(1);
  });

  it('updates fields, keeps updatedAt, rejects bad input and unknown ids', () => {
    const { db, newId } = setup();
    const t = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, newId);
    const u = updateTopic(db, t.id, { name: ' Math ', colorKey: 'sun', isOpen: false, sortOrder: 5 }, 2);
    expect(u).toMatchObject({ name: 'Math', colorKey: 'sun', isOpen: false, sortOrder: 5 });
    expect(() => updateTopic(db, t.id, { name: '' }, 3)).toThrow(ValidationError);
    expect(() => updateTopic(db, t.id, { sortOrder: 1.5 }, 3)).toThrow(ValidationError);
    expect(() => updateTopic(db, 'missing', { isOpen: true }, 3)).toThrow('not found');
  });

  it('softDeleteTopic marks the topic and its tasks deleted in one go', () => {
    const { db, newId } = setup();
    const t1 = createTopic(db, { name: 'A', colorKey: 'study' }, 1, newId);
    const t2 = createTopic(db, { name: 'B', colorKey: 'home' }, 1, newId);
    const base = { kind: 'timed', minutes: 25, repeatMask: 127, isDefault: true, cue: null, treat: null } as const;
    const k1 = createTask(db, { ...base, topicId: t1.id, name: 'one' }, 1, newId);
    const k2 = createTask(db, { ...base, topicId: t1.id, name: 'two' }, 1, newId);
    const k3 = createTask(db, { ...base, topicId: t2.id, name: 'three' }, 1, newId);

    softDeleteTopic(db, t1.id, 500);
    expect(listUserTopics(db).map((t) => t.id)).toEqual([t2.id]);
    expect(getTopic(db, t1.id)?.deletedAt).toBe(500);
    expect(listTasks(db).map((t) => t.id)).toEqual([k3.id]);
    expect(getTask(db, k1.id)?.deletedAt).toBe(500);
    expect(getTask(db, k2.id)?.deletedAt).toBe(500);
    expect(getTask(db, k3.id)?.deletedAt).toBeNull();

    // deleting again keeps the original timestamp
    softDeleteTopic(db, t1.id, 900);
    expect(getTopic(db, t1.id)?.deletedAt).toBe(500);
  });
});
