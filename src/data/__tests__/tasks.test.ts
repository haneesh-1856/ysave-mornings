/** @jest-environment node */
import { ValidationError } from '../errors';
import { createTask, getTask, listTasks, setTaskNote, softDeleteTask, updateTask, type TaskInput } from '../repos/tasks';
import { createTopic } from '../repos/topics';
import { createTestDb } from './testDb';

function setup() {
  const { db } = createTestDb();
  let n = 0;
  const newId = () => `id-${++n}`;
  const topic = createTopic(db, { name: 'Study', colorKey: 'study' }, 1, newId);
  const topic2 = createTopic(db, { name: 'Home', colorKey: 'home' }, 1, newId);
  const input: TaskInput = {
    topicId: topic.id,
    name: ' DSA practice ',
    kind: 'timed',
    minutes: 60,
    repeatMask: 0b0011111,
    isDefault: true,
    cue: ' desk ',
    treat: null,
  };
  return { db, newId, topic, topic2, input };
}

describe('tasks repo', () => {
  it('round-trips a domain Task (trimmed, booleans, nullables, empty note)', () => {
    const { db, newId, input, topic } = setup();
    const t = createTask(db, input, 100, newId);
    expect(t).toMatchObject({
      topicId: topic.id,
      name: 'DSA practice',
      kind: 'timed',
      minutes: 60,
      repeatMask: 31,
      isDefault: true,
      cue: 'desk',
      treat: null,
      note: '',
      sortOrder: 0,
      deletedAt: null,
    });
    expect(getTask(db, t.id)).toEqual(t);
    expect(getTask(db, 'missing')).toBeNull();
    const second = createTask(db, { ...input, name: 'Second', isDefault: false, cue: '  ' }, 101, newId);
    expect(second.sortOrder).toBe(1);
    expect(second.isDefault).toBe(false);
    expect(second.cue).toBeNull();
  });

  it('listTasks hides deleted and filters by topic', () => {
    const { db, newId, input, topic, topic2 } = setup();
    const a = createTask(db, input, 1, newId);
    const b = createTask(db, { ...input, topicId: topic2.id, name: 'Dishes' }, 1, newId);
    expect(listTasks(db).map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
    expect(listTasks(db, topic.id).map((t) => t.id)).toEqual([a.id]);
    softDeleteTask(db, a.id, 50);
    expect(listTasks(db).map((t) => t.id)).toEqual([b.id]);
    expect(getTask(db, a.id)?.deletedAt).toBe(50);
  });

  it('validates every field with ValidationError', () => {
    const { db, newId, input } = setup();
    const bad = (patch: Partial<TaskInput>) => () => createTask(db, { ...input, ...patch }, 1, newId);
    expect(bad({ name: '   ' })).toThrow(ValidationError);
    expect(bad({ name: 'x'.repeat(41) })).toThrow(ValidationError);
    expect(bad({ minutes: 4 })).toThrow(ValidationError);
    expect(bad({ minutes: 185 })).toThrow(ValidationError);
    expect(bad({ minutes: 17 })).toThrow(ValidationError);
    expect(bad({ minutes: 7.5 })).toThrow(ValidationError);
    expect(bad({ repeatMask: -1 })).toThrow(ValidationError);
    expect(bad({ repeatMask: 128 })).toThrow(ValidationError);
    expect(bad({ cue: 'x'.repeat(81) })).toThrow(ValidationError);
    // @ts-expect-error invalid kind on purpose
    expect(bad({ kind: 'weird' })).toThrow(ValidationError);
    expect(bad({ name: 'x'.repeat(40), minutes: 5, repeatMask: 0 })).not.toThrow();
    expect(bad({ minutes: 180, repeatMask: 127 })).not.toThrow();
  });

  it('updateTask is partial and validated; unknown id throws', () => {
    const { db, newId, input } = setup();
    const t = createTask(db, input, 1, newId);
    const u = updateTask(db, t.id, { minutes: 90, isDefault: false, treat: 'tea' }, 2);
    expect(u).toMatchObject({ name: 'DSA practice', minutes: 90, isDefault: false, treat: 'tea', cue: 'desk' });
    expect(updateTask(db, t.id, { cue: null }, 3).cue).toBeNull();
    expect(() => updateTask(db, t.id, { minutes: 12 }, 3)).toThrow(ValidationError);
    expect(getTask(db, t.id)?.minutes).toBe(90);
    expect(() => updateTask(db, 'missing', { minutes: 10 }, 3)).toThrow('not found');
  });

  it('setTaskNote stores the note on the library task, with a length limit', () => {
    const { db, newId, input } = setup();
    const t = createTask(db, input, 1, newId);
    setTaskNote(db, t.id, 'remember to stretch', 5);
    expect(getTask(db, t.id)?.note).toBe('remember to stretch');
    expect(() => setTaskNote(db, t.id, 'x'.repeat(1001), 6)).toThrow(ValidationError);
    expect(() => setTaskNote(db, 'missing', 'n', 6)).toThrow('not found');
  });

  it('defaultChangedAt: set on create as default, null otherwise, moved only by a real isDefault change', () => {
    const { db, newId, input } = setup();
    const def = createTask(db, input, 100, newId);
    const plain = createTask(db, { ...input, isDefault: false }, 100, newId);
    expect(def.defaultChangedAt).toBe(100);
    expect(plain.defaultChangedAt).toBeNull();
    expect(updateTask(db, def.id, { isDefault: true, name: 'Other' }, 200).defaultChangedAt).toBe(100); // unchanged value
    expect(updateTask(db, def.id, { minutes: 45, cue: 'x' }, 250).defaultChangedAt).toBe(100); // other fields
    expect(updateTask(db, def.id, { isDefault: false }, 300).defaultChangedAt).toBe(300);
    expect(updateTask(db, plain.id, { isDefault: true }, 400).defaultChangedAt).toBe(400);
    expect(getTask(db, plain.id)!.defaultChangedAt).toBe(400);
  });
  it('updateTask with isDefault on a missing id still throws NotFound', () => {
    const { db } = setup();
    expect(() => updateTask(db, 'nope', { isDefault: true }, 1)).toThrow();
  });
});
