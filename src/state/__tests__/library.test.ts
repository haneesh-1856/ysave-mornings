/** @jest-environment node */
import { ValidationError } from '../../data/errors';
import { getTask, listTasks } from '../../data/repos/tasks';
import { listUserTopics } from '../../data/repos/topics';
import {
  DEFAULT_TASK, createTask, createTopic, moveTopic, removeTask, removeTopic, setTaskNote, updateTask, updateTopic,
} from '../actions/library';
import { clearDb, getDb } from '../dbRef';
import { useStore } from '../store';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

let db: ReturnType<typeof setupState>;
beforeEach(() => {
  db = setupState(5000);
});
afterEach(teardownState);

const v = () => ({ ...useStore.getState() });

describe('dbRef', () => {
  it('getDb throws a clear error when unset', () => {
    clearDb();
    expect(() => getDb()).toThrow('setDb() has not been called');
  });
});

describe('topic actions', () => {
  it('createTopic writes and bumps topics only', () => {
    const t = createTopic({ name: ' Study ', colorKey: 'study' });
    expect(t.name).toBe('Study');
    expect(listUserTopics(db)).toHaveLength(1);
    expect(v()).toMatchObject({ topics: 1, tasks: 0, days: 0 });
  });

  it('validation errors propagate and do not bump', () => {
    expect(() => createTopic({ name: '  ', colorKey: 'study' })).toThrow(ValidationError);
    expect(() => createTopic({ name: 'x'.repeat(25), colorKey: 'study' })).toThrow(ValidationError);
    expect(v().topics).toBe(0);
    const t = createTopic({ name: 'A', colorKey: 'home' });
    expect(() => updateTopic(t.id, { name: '' })).toThrow(ValidationError);
    expect(v().topics).toBe(1);
  });

  it('updateTopic changes fields and bumps topics', () => {
    const t = createTopic({ name: 'A', colorKey: 'home' });
    const u = updateTopic(t.id, { name: 'B', colorKey: 'sun', isOpen: false });
    expect(u).toMatchObject({ name: 'B', colorKey: 'sun', isOpen: false });
    expect(v().topics).toBe(2);
  });

  it('moveTopic swaps with the neighbour and is a no-op at the ends', () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    const b = createTopic({ name: 'B', colorKey: 'sun' });
    const c = createTopic({ name: 'C', colorKey: 'study' });
    const names = () => listUserTopics(db).map((t) => t.name).join('');
    const before = v().topics;
    moveTopic(a.id, -1);
    moveTopic(c.id, 1);
    moveTopic('missing', 1);
    expect(names()).toBe('ABC');
    expect(v().topics).toBe(before);
    moveTopic(b.id, -1);
    expect(names()).toBe('BAC');
    expect(v().topics).toBe(before + 1);
    moveTopic(b.id, 1);
    moveTopic(b.id, 1);
    expect(names()).toBe('ACB');
  });

  it('removeTopic cascades to tasks and bumps topics and tasks', () => {
    const t = createTopic({ name: 'A', colorKey: 'home' });
    const k = createTask(t.id, { name: 'Do' });
    const before = v();
    removeTopic(t.id);
    expect(listUserTopics(db)).toEqual([]);
    expect(listTasks(db)).toEqual([]);
    expect(getTask(db, k.id)?.deletedAt).toBe(5000);
    expect(v().topics).toBe(before.topics + 1);
    expect(v().tasks).toBe(before.tasks + 1);
  });
});

describe('task actions', () => {
  it('createTask applies DEFAULT_TASK and bumps tasks', () => {
    const t = createTopic({ name: 'A', colorKey: 'home' });
    const k = createTask(t.id, { name: 'Read', minutes: 45 });
    expect(k).toMatchObject({ ...DEFAULT_TASK, minutes: 45, name: 'Read', topicId: t.id });
    expect(v().tasks).toBe(1);
  });

  it('a blank task name is rejected and writes nothing', () => {
    const t = createTopic({ name: 'A', colorKey: 'home' });
    expect(() => createTask(t.id, { name: '   ' })).toThrow(ValidationError);
    expect(listTasks(db)).toEqual([]);
    expect(v().tasks).toBe(0);
  });

  it('updateTask, setTaskNote, removeTask', () => {
    const t = createTopic({ name: 'A', colorKey: 'home' });
    const k = createTask(t.id, { name: 'Read' });
    expect(updateTask(k.id, { kind: 'check', repeatMask: 5 })).toMatchObject({ kind: 'check', repeatMask: 5 });
    expect(() => updateTask(k.id, { minutes: 7 })).toThrow(ValidationError);
    expect(setTaskNote(k.id, 'hello').note).toBe('hello');
    expect(() => setTaskNote('missing', 'x')).toThrow('not found');
    expect(v().tasks).toBe(3);
    removeTask(k.id);
    expect(listTasks(db)).toEqual([]);
    expect(v().tasks).toBe(4);
    expect(v().topics).toBe(1);
  });
});
