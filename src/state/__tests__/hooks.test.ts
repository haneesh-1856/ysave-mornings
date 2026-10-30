import { act, renderHook } from '@testing-library/react-native';
import { loadDayBundle, saveConfirmedPlan, setCheckCompleted } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan, confirmPlan } from '../../domain/plan';
import { createTask, createTopic, moveTopic, removeTask, removeTopic, updateTopic } from '../actions/library';
import { useTopic, useTopicsLibrary } from '../hooks/useTopicsLibrary';
import { bump } from '../store';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29'; // Thursday; its week is 2026-10-26 .. 2026-11-01
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;

let db: DB;
beforeEach(() => {
  db = setupState(NOW);
});
afterEach(teardownState);

function planDay(dayKey: string) {
  const bundle = loadDayBundle(db, dayKey);
  const draft = buildPlan({
    dayKey,
    topics: listTopics(db),
    tasks: listTasks(db),
    day: bundle?.day ?? null,
    dayTasks: bundle?.dayTasks ?? [],
  });
  let n = 0;
  saveConfirmedPlan(db, {
    dayKey,
    dayStartHour: 4,
    result: confirmPlan(draft, bundle?.dayTasks ?? [], []),
    now: NOW,
    newId: () => `dt-${dayKey}-${++n}`,
  });
}

function completeAll(dayKey: string, at: number) {
  for (const dt of loadDayBundle(db, dayKey)!.dayTasks) setCheckCompleted(db, dt.id, at, NOW);
}

describe('useTopicsLibrary', () => {
  it('is empty at first, then re-renders after actions', async () => {
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current).toEqual({ topics: [], taskCount: 0 });
    let id = '';
    await act(async () => {
      id = createTopic({ name: 'Study', colorKey: 'study' }).id;
    });
    expect(result.current.topics.map((e) => e.topic.name)).toEqual(['Study']);
    await act(async () => {
      createTask(id, { name: 'DSA' });
    });
    expect(result.current.taskCount).toBe(1);
    await act(async () => {
      updateTopic(id, { name: 'Learn' });
    });
    expect(result.current.topics[0].topic.name).toBe('Learn');
  });

  it('orders topics by sortOrder and groups tasks per topic in order', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    const b = createTopic({ name: 'B', colorKey: 'sun' });
    createTask(b.id, { name: 'b1' });
    createTask(a.id, { name: 'a1' });
    createTask(b.id, { name: 'b2' });
    createTask(a.id, { name: 'a2' });
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current.topics.map((e) => e.tasks.map((t) => t.name))).toEqual([['a1', 'a2'], ['b1', 'b2']]);
    expect(result.current.taskCount).toBe(4);
    await act(async () => moveTopic(b.id, -1));
    expect(result.current.topics.map((e) => e.topic.name)).toEqual(['B', 'A']);
  });

  it('computes weekly minutes from timed tasks and repeat days', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    createTask(a.id, { name: 'x', minutes: 30, repeatMask: 0b0000111 }); // 3 days
    createTask(a.id, { name: 'y', kind: 'check', repeatMask: 127, isDefault: true }); // not timed
    createTask(a.id, { name: 'z', minutes: 15, repeatMask: 0b1 });
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current.topics[0].weeklyMinutes).toBe(105);
  });

  it('does not list a deleted task or topic, and updates minutes', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    const b = createTopic({ name: 'B', colorKey: 'sun' });
    const k = createTask(a.id, { name: 'x', minutes: 30, repeatMask: 1 });
    const { result } = await renderHook(() => useTopicsLibrary());
    expect(result.current.topics[0].weeklyMinutes).toBe(30);
    await act(async () => removeTask(k.id));
    expect(result.current.topics[0].tasks).toEqual([]);
    expect(result.current.topics[0].weeklyMinutes).toBe(0);
    await act(async () => removeTopic(b.id));
    expect(result.current.topics).toHaveLength(1);
  });

  it('week dots come only from the current Mon-Sun week', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    createTask(a.id, { name: 'r', kind: 'check', repeatMask: 127, isDefault: true });
    for (const k of ['2026-10-25', '2026-10-26', '2026-10-28', '2026-11-01', '2026-11-02']) {
      planDay(k);
      completeAll(k, dayStartOf(k, 4) + 3_600_000);
    }
    const { result } = await renderHook(() => useTopicsLibrary());
    const dots = result.current.topics[0].weekDots;
    // 26 Oct, 28 Oct and 1 Nov are in the week; 25 Oct and 2 Nov are not.
    expect(dots.filter((d) => d.kind === 'task')).toHaveLength(3);
    const first = dayStartOf('2026-10-26', 4);
    const last = dayStartOf('2026-11-02', 4);
    for (const d of dots) {
      expect(d.at).toBeGreaterThanOrEqual(first);
      expect(d.at).toBeLessThan(last);
    }
  });

  it('refreshes when days is bumped but ignores unrelated tables', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    createTask(a.id, { name: 'r', kind: 'check', repeatMask: 127, isDefault: true });
    let renders = 0;
    const { result } = await renderHook(() => {
      renders++;
      return useTopicsLibrary();
    });
    expect(result.current.topics[0].weekDots).toEqual([]);
    planDay(TODAY);
    completeAll(TODAY, NOW);
    const before = renders;
    await act(async () => bump('settings', 'sessions'));
    expect(renders).toBe(before);
    await act(async () => bump('days'));
    expect(result.current.topics[0].weekDots.length).toBeGreaterThan(0);
  });
});

describe('useTopic', () => {
  it('returns the topic, null when unknown or removed, and follows updates', async () => {
    const a = createTopic({ name: 'A', colorKey: 'home' });
    const { result } = await renderHook(() => useTopic(a.id));
    expect(result.current?.name).toBe('A');
    await act(async () => {
      updateTopic(a.id, { name: 'B' });
    });
    expect(result.current?.name).toBe('B');
    await act(async () => removeTopic(a.id));
    expect(result.current).toBeNull();
    expect((await renderHook(() => useTopic('nope'))).result.current).toBeNull();
  });
});
