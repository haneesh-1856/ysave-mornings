import { fireEvent, renderHook, screen } from '@testing-library/react-native';

import { loadDayBundle } from '@/data/repos/days';
import { dayStartOf } from '@/domain/dayKey';
import { createTask, createTopic } from '@/state/actions/library';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { useDayCard } from '@/state/hooks/useDayCard';
import { setupState, teardownState } from '@/state/testSupport';
import { dayCardLine } from '@/ui/dayCardLine';
import { renderThemed } from '@/ui/testing';

import TodayScreen from '../../app/(tabs)/today';
import CloseScreen from '../CloseScreen';
import { PlannedScreen } from '../PlannedScreen';
import { PlanScreen } from '../PlanScreen';

/**
 * Bug 02 (phone): a one-off checklist task added to TODAY's plan, tomorrow planned and confirmed, today closed with the
 * one-off moved. Tomorrow must show it ticked "from <today>" everywhere tomorrow is shown.
 */

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockReplace = jest.fn();
let mockParam = '';
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...a: unknown[]) => mockReplace(...a),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ dayKey: mockParam }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const TODAY = '2026-10-30'; // Friday
const TOMORROW = '2026-10-31'; // Saturday
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;

beforeEach(() => {
  setupState(NOW);
  setClockOverride(() => NOW);
  mockReplace.mockClear();
});
afterEach(() => teardownState());

/** The user's path, through the real screens. */
async function walkThePath() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  reconcile();

  // 1. Plan today: add a one-off checklist "A" and confirm.
  mockParam = TODAY;
  let r = await renderThemed(<PlanScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
  await fireEvent.changeText(screen.getByLabelText('Task name'), 'A');
  await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Checklist' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Friday looks like this ✓' }));
  await r.unmount();
  expect(loadDayBundle(getDb(), TODAY)!.dayTasks.find((d) => d.name === 'A')).toMatchObject({ taskId: null, kind: 'check' });

  // 2. Plan tomorrow and confirm.
  mockParam = TOMORROW;
  r = await renderThemed(<PlanScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
  await r.unmount();

  // 3. Close today, moving A.
  r = await renderThemed(<CloseScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: 'A: Move to Saturday' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Read: Let it go' }));
  await fireEvent.press(screen.getByTestId('close-confirm'));
  expect(screen.getByText('Jar closed')).toBeTruthy();
  await r.unmount();
}

describe('bug 02: a moved one-off checklist task arrives in tomorrow', () => {
  it('is stored for tomorrow, ticked "from Friday"', async () => {
    await walkThePath();
    const a = loadDayBundle(getDb(), TOMORROW)!.dayTasks.filter((d) => d.name === 'A');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ taskId: null, kind: 'check', forwardedFromDayKey: TODAY, completedAt: null });
  });

  it('Plan(tomorrow), as opened by the Close screen, shows it ticked "from Friday"', async () => {
    await walkThePath();
    mockParam = TOMORROW;
    await renderThemed(<PlanScreen />);
    expect(screen.getByRole('checkbox', { name: 'Include A' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('from Friday')).toBeTruthy();
  });

  it('the Planned screen lists it "from Friday"', async () => {
    await walkThePath();
    await renderThemed(<PlannedScreen dayKey={TOMORROW} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('Study · from Friday')).toBeTruthy();
  });

  it('the Calendar card for tomorrow counts it', async () => {
    await walkThePath();
    const { result } = await renderHook(() => useDayCard(TOMORROW));
    expect(dayCardLine(result.current)).toBe('Planned: 2 tasks. One marble waiting.');
  });

  it('the Today tab after the close shows tomorrow\'s tasks, with A "from Friday"', async () => {
    await walkThePath();
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Today is closed')).toBeTruthy();
    expect(screen.getByText('Tomorrow is planned · 2 tasks')).toBeTruthy();
    expect(screen.getByLabelText('Tomorrow: A, from Friday')).toBeTruthy();
    expect(screen.getByText('Study · from Friday')).toBeTruthy();
    expect(screen.getByLabelText('Tomorrow: Read')).toBeTruthy();
    // today's own (closed) row says where it went
    expect(screen.getByText('moved to Saturday')).toBeTruthy();
  });

  it('the Today tab lists tomorrow only once today is closed', async () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    mockParam = TOMORROW;
    const r = await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
    await r.unmount();
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Tomorrow is planned · 1 task')).toBeTruthy();
    expect(screen.queryByLabelText('Tomorrow: Read')).toBeNull();
  });

  it('when that day starts, Today shows A ticked-in "from Friday"', async () => {
    await walkThePath();
    setClockOverride(() => dayStartOf(TOMORROW, 4) + 6 * 3_600_000);
    reconcile();
    await renderThemed(<TodayScreen />);
    expect(screen.getByRole('button', { name: 'A, checklist, open' })).toBeTruthy();
    expect(screen.getByText('from Friday')).toBeTruthy();
  });
});
