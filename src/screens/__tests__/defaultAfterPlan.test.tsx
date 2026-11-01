import { fireEvent, screen } from '@testing-library/react-native';

import { loadDayBundle } from '@/data/repos/days';
import { dayStartOf } from '@/domain/dayKey';
import { closeToday } from '@/state/actions/close';
import { createTask, createTopic, updateTask } from '@/state/actions/library';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { letGoAll, setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import TodayScreen from '../../app/(tabs)/today';
import { PlanScreen } from '../PlanScreen';

/**
 * Chunk 9 (phone): a one-off checklist task added to TODAY's plan, tomorrow planned and confirmed, today closed with the
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
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000;
let t = T0;

beforeEach(() => {
  t = T0;
  setupState(T0);
  setClockOverride(() => t);
  mockReplace.mockClear();
});
afterEach(() => teardownState());

const checked = (name: string): boolean | undefined =>
  screen.getByRole('checkbox', { name: `Include ${name}` }).props.accessibilityState.checked;
const storedNames = (): string[] => loadDayBundle(getDb(), TOMORROW)!.dayTasks.map((d) => d.name).sort();

/** Today closed; tomorrow planned and confirmed through the real screen. */
async function planTomorrow(extra?: () => void) {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  extra?.();
  reconcile();
  closeToday(letGoAll());
  mockParam = TOMORROW;
  const r = await renderThemed(<PlanScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
  await r.unmount();
  t += 3_600_000;
}

describe('chunk 9: a default changed after tomorrow was confirmed', () => {
  it("user's path: B (new topic, all 7 days, default) shows ticked, joins on Confirm, then shows on Today", async () => {
    await planTomorrow();
    const music = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(music.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });

    await renderThemed(<TodayScreen />);
    expect(screen.queryByLabelText('Tomorrow: B')).toBeNull(); // stored rows only, until Confirm
    expect(screen.getByLabelText('Tomorrow: Read')).toBeTruthy();

    mockParam = TOMORROW;
    const r = await renderThemed(<PlanScreen />);
    expect(checked('B')).toBe(true);
    expect(checked('Read')).toBe(true);
    expect(storedNames()).toEqual(['Read']);
    await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
    await r.unmount();
    expect(storedNames()).toEqual(['B', 'Read']);

    await renderThemed(<TodayScreen />);
    expect(screen.getByLabelText('Tomorrow: B')).toBeTruthy();
  });

  it('reverse: C (default, in the plan) turned non-default shows unticked and is gone after Confirm', async () => {
    let cId = '';
    await planTomorrow(() => {
      const topic = createTopic({ name: 'Home', colorKey: 'home' });
      cId = createTask(topic.id, { name: 'C', kind: 'timed', minutes: 10, repeatMask: 127, isDefault: true }).id;
    });
    expect(storedNames()).toEqual(['C', 'Read']);
    updateTask(cId, { isDefault: false });

    mockParam = TOMORROW;
    const r = await renderThemed(<PlanScreen />);
    expect(checked('C')).toBe(false);
    expect(checked('Read')).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
    await r.unmount();
    expect(storedNames()).toEqual(['Read']);
  });

  it('guards: unticked default stays unticked, ticked non-default stays ticked, edits do not move ticks', async () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    const dId = createTask(study.id, { name: 'D', kind: 'timed', minutes: 15, repeatMask: 127, isDefault: true }).id;
    const nId = createTask(study.id, { name: 'N', kind: 'timed', minutes: 15, repeatMask: 127, isDefault: false }).id;
    reconcile();
    closeToday(letGoAll());
    mockParam = TOMORROW;
    const r = await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include D' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include N' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));
    await r.unmount();
    t += 3_600_000;
    updateTask(dId, { name: 'D renamed', minutes: 45, isDefault: true });
    updateTask(nId, { minutes: 45 });
    await renderThemed(<PlanScreen />);
    expect(checked('D renamed')).toBe(false);
    expect(checked('N')).toBe(true);
  });

  it('turning default on for a task that does not repeat tomorrow does nothing', async () => {
    await planTomorrow();
    const music = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(music.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 1 << 0, isDefault: true });
    mockParam = TOMORROW;
    await renderThemed(<PlanScreen />);
    expect(checked('B')).toBe(false);
  });
});

describe('chunk 9 fix: re-confirm keeps the user choice', () => {
  const confirm = () => fireEvent.press(screen.getByRole('button', { name: 'Saturday looks like this ✓' }));

  it('B unticked and re-confirmed stays unticked; a later default change still moves it', async () => {
    await planTomorrow();
    const music = createTopic({ name: 'Music', colorKey: 'home' });
    const bId = createTask(music.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true }).id;
    t += 3_600_000;
    mockParam = TOMORROW;
    let r = await renderThemed(<PlanScreen />);
    expect(checked('B')).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include B' }));
    await confirm();
    await r.unmount();
    expect(storedNames()).toEqual(['Read']);
    t += 3_600_000;

    r = await renderThemed(<PlanScreen />);
    expect(checked('B')).toBe(false);
    await r.unmount();

    updateTask(bId, { isDefault: false });
    t += 3_600_000;
    updateTask(bId, { isDefault: true });
    await renderThemed(<PlanScreen />);
    expect(checked('B')).toBe(true);
  });

  it('C turned non-default, ticked back and re-confirmed stays ticked', async () => {
    let cId = '';
    await planTomorrow(() => {
      const topic = createTopic({ name: 'Home', colorKey: 'home' });
      cId = createTask(topic.id, { name: 'C', kind: 'timed', minutes: 10, repeatMask: 127, isDefault: true }).id;
    });
    updateTask(cId, { isDefault: false });
    t += 3_600_000;
    mockParam = TOMORROW;
    let r = await renderThemed(<PlanScreen />);
    expect(checked('C')).toBe(false);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include C' }));
    await confirm();
    await r.unmount();
    expect(storedNames()).toEqual(['C', 'Read']);
    t += 3_600_000;

    r = await renderThemed(<PlanScreen />);
    expect(checked('C')).toBe(true);
    await r.unmount();
  });
});
