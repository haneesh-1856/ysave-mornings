import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { loadDayBundle } from '../../data/repos/days';
import { dayStartOf } from '../../domain/dayKey';
import { createTask, createTopic } from '../actions/library';
import { useReconcileOnForeground } from '../hooks/useReconcileOnForeground';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;

afterEach(() => {
  jest.restoreAllMocks();
  teardownState();
});

describe('useReconcileOnForeground', () => {
  it('reconciles on mount and on AppState active; removes the listener on unmount', async () => {
    const db = setupState(NOW);
    const remove = jest.fn();
    let handler: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);

    const topic = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(topic.id, { name: 'A', kind: 'timed', minutes: 5, repeatMask: 127, isDefault: true });
    const { unmount } = await renderHook(() => useReconcileOnForeground());
    expect(loadDayBundle(db, '2026-10-29')?.dayTasks).toHaveLength(1); // mount reconciled

    createTask(topic.id, { name: 'B', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
    handler!('background');
    expect(loadDayBundle(db, '2026-10-29')?.dayTasks).toHaveLength(1);
    handler!('active');
    expect(loadDayBundle(db, '2026-10-29')?.dayTasks).toHaveLength(2);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
