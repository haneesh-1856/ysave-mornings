import { renderHook } from '@testing-library/react-native';
import { ValidationError } from '../../data/errors';
import { getTask } from '../../data/repos/tasks';
import { NO_TOPIC_ID } from '../../domain/types';
import { createTask, createTopic, moveTopic, removeTask, removeTopic, updateTask, updateTopic } from '../actions/library';
import { getDb } from '../dbRef';
import { needsOnboarding } from '../hooks/useOnboarding';
import { usePlanTopics } from '../hooks/usePlanTopics';
import { useTopic, useTopicsLibrary } from '../hooks/useTopicsLibrary';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

beforeEach(() => {
  setupState(Date.UTC(2026, 9, 29, 12));
});
afterEach(teardownState);

describe('No topic in the library state (ADR-012)', () => {
  it('(e) an empty library has no topics and still needs onboarding', async () => {
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current.topics).toEqual([]);
    expect(result.current.taskCount).toBe(0);
    expect(needsOnboarding()).toBe(true);
  });

  it('(e) it is listed (last) only while it holds a live task, and then counts its tasks', async () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const first = await renderHook(() => useTopicsLibrary());
    expect(first.result.current.topics.map(e => e.topic.id)).toEqual([study.id]);
    const t = createTask(null, { name: 'Loose' });
    const again = await renderHook(() => useTopicsLibrary());
    expect(again.result.current.topics.map(e => e.topic.id)).toEqual([study.id, NO_TOPIC_ID]);
    expect(again.result.current.topics[1].tasks.map(x => x.id)).toEqual([t.id]);
    expect(again.result.current.taskCount).toBe(1);
    removeTask(t.id);
    const gone = await renderHook(() => useTopicsLibrary());
    expect(gone.result.current.topics.map(e => e.topic.id)).toEqual([study.id]);
  });

  it('(e) the Plan topic list includes it so its group has a name and colour', async () => {
    const { result } = await renderHook(() => usePlanTopics());
    expect(result.current.map(x => x.id)).toEqual([NO_TOPIC_ID]);
  });

  it('(f) createTask without a topic (undefined or null) lands in No topic', () => {
    expect(createTask(null, { name: 'A' }).topicId).toBe(NO_TOPIC_ID);
    expect(createTask(undefined, { name: 'B' }).topicId).toBe(NO_TOPIC_ID);
  });

  it('(f) updateTask moves a task between topics, to the end of the target', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'First' });
    const t = createTask(null, { name: 'Loose' });
    expect(updateTask(t.id, { topicId: study.id })).toMatchObject({ topicId: study.id, sortOrder: 1 });
    expect(updateTask(t.id, { topicId: NO_TOPIC_ID }).topicId).toBe(NO_TOPIC_ID);
    expect(() => updateTask(t.id, { topicId: 'missing' })).toThrow(ValidationError);
    expect(getTask(getDb(), t.id)!.topicId).toBe(NO_TOPIC_ID);
  });

  it('(d) No topic cannot be renamed or deleted; its screen finds nothing to edit', async () => {
    expect(() => updateTopic(NO_TOPIC_ID, { name: 'X' })).toThrow(ValidationError);
    expect(() => removeTopic(NO_TOPIC_ID)).toThrow(ValidationError);
    const { result } = await renderHook(() => useTopic(NO_TOPIC_ID));
    expect(result.current).toBeNull();
  });

  it('moving topics ignores No topic', async () => {
    const a = createTopic({ name: 'A', colorKey: 'study' });
    const b = createTopic({ name: 'B', colorKey: 'home' });
    moveTopic(b.id, 1); // b is last of the user topics: no-op, not a swap with No topic
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current.topics.map(e => e.topic.id)).toEqual([a.id, b.id]);
  });
});
