import { act, renderHook } from '@testing-library/react-native';
import { dayStartOf } from '../../domain/dayKey';
import { createTask, createTopic, removeTopic, setTaskNote } from '../actions/library';
import { usePlanTopics } from '../hooks/usePlanTopics';
import { useTaskNote } from '../hooks/useTaskNote';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;

beforeEach(() => {
  setupState(NOW);
});
afterEach(teardownState);

describe('usePlanTopics', () => {
  it('re-reads after createTopic and drops removed topics', async () => {
    const { result } = await renderHook(() => usePlanTopics());
    expect(result.current.map(x => x.name)).toEqual(['No topic']); // the built-in topic is always there (ADR-012)
    let id = '';
    await act(async () => {
      id = createTopic({ name: 'Study', colorKey: 'study' }).id;
      createTopic({ name: 'Body', colorKey: 'health' });
    });
    expect(result.current.map(x => x.name)).toEqual(['Study', 'Body', 'No topic']);
    await act(async () => {
      removeTopic(id);
    });
    expect(result.current.map(x => x.name)).toEqual(['Body', 'No topic']);
  });
});

describe('useTaskNote', () => {
  it("is '' for null and unknown ids", async () => {
    const a = await renderHook(() => useTaskNote(null));
    expect(a.result.current).toBe('');
    const b = await renderHook(() => useTaskNote('nope'));
    expect(b.result.current).toBe('');
  });

  it('re-reads after setTaskNote', async () => {
    let taskId = '';
    await act(async () => {
      const topic = createTopic({ name: 'Study', colorKey: 'study' });
      taskId = createTask(topic.id, { name: 'DSA' }).id;
    });
    const { result } = await renderHook(() => useTaskNote(taskId));
    expect(result.current).toBe('');
    await act(async () => {
      setTaskNote(taskId, 'chapter 3');
    });
    expect(result.current).toBe('chapter 3');
  });
});
