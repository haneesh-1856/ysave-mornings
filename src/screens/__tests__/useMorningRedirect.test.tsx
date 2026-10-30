import { act, renderHook } from '@testing-library/react-native';
import { dayStartOf } from '@/domain/dayKey';
import { createTask, createTopic } from '@/state/actions/library';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { markMorningSeen } from '@/state/hooks/useMorning';
import { bump } from '@/state/store';
import { setupState, teardownState } from '@/state/testSupport';

import { useMorningRedirect } from '../useMorningRedirect';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
let mockPath = '/today';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
  usePathname: () => mockPath,
}));

const D1 = '2026-10-29';
const D2 = '2026-10-30';
const HOUR = 3_600_000;
const T0 = dayStartOf(D1, 4) + 6 * HOUR;

let t: number;
beforeEach(() => {
  setupState(T0);
  t = T0;
  setClockOverride(() => t);
  mockPush.mockClear();
  mockPath = '/today';
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile(); // first-ever day: Morning not due
});
afterEach(() => teardownState());

/** What the day boundary / foreground hooks do on a new day. */
async function newDay(at: number) {
  await act(async () => {
    t = at;
    reconcile();
    bump('days');
  });
}

describe('useMorningRedirect', () => {
  it('pushes /morning once when a new day starts while the app is open', async () => {
    const view = await renderHook(() => useMorningRedirect());
    expect(mockPush).not.toHaveBeenCalled();

    await newDay(dayStartOf(D2, 4) + HOUR);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/morning');

    mockPath = '/morning';
    await act(async () => markMorningSeen());
    await view.rerender(undefined);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('does not push on a same-day re-render or reconcile', async () => {
    const view = await renderHook(() => useMorningRedirect());
    await view.rerender(undefined);
    await newDay(T0 + HOUR);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not push at mount when Morning is already due (launch redirect handles it)', async () => {
    t = dayStartOf(D2, 4) + HOUR;
    reconcile();
    const view = await renderHook(() => useMorningRedirect());
    await view.rerender(undefined);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not push when already on /morning', async () => {
    mockPath = '/morning';
    await renderHook(() => useMorningRedirect());
    await newDay(dayStartOf(D2, 4) + HOUR);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
