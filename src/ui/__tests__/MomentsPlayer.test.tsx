import { act, configure, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';


import { MOMENT_ORDER, type Moment } from '@/domain/moments';

import { MomentsPlayer, REDUCED_STEP_MS } from '../moments/MomentsPlayer';
import { renderThemed } from '../testing';

// The player's drawn text is hidden from screen readers on purpose (announcements carry it), so queries must include hidden elements.
configure({ defaultIncludeHiddenElements: true });

// Reanimated's JS build drives timings with requestAnimationFrame, which loops forever under jest fake timers: land on the target at once.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return new Proxy(actual, { get: (target, key) => (key === 'withTiming' ? (to: number) => to : target[key]) });
});
let mockReduce = true;
jest.mock('../useMotion', () => ({ useMotion: () => ({ reduce: mockReduce, animate: (to: number) => to }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The player renders a large tree; under a full parallel run these tests are slower than jest's 5 s default.
jest.setTimeout(30_000);

const MIN = 60_000;
const RECENT = [96, 110, 104, 128, 0, 95, 119, 134, 101, 122, 88, 131, 113].map((m) => m * MIN); // 13 days, oldest first, none above the previous best (140 min)
const TODAY_MS = 150 * MIN; // Sunday 2026-11-01: the same number in the day, the best, the week's Sunday and the month
const WEEK_DAILY = [90, 0, 120, 60, 150, 100].map((m) => m * MIN).concat(TODAY_MS);
const MONTH_DAILY = [TODAY_MS];
const MONTH_FOCUS = MONTH_DAILY.reduce((a, v) => a + v, 0);
const FIRST: Moment[] = [
  { kind: 'longest', name: 'Study', colorKey: 'study', focusedMs: 65 * MIN, budgetSec: 3600 },
  { kind: 'day', done: 2, total: 2, focusedMs: TODAY_MS, closedAt: 0 },
];
const OTHERS: Moment[] = [
  { kind: 'best', todayMs: TODAY_MS, previousBestMs: 140 * MIN, recentMs: RECENT },
  { kind: 'streak', days: 7, endDayKey: '2026-11-01' },
  { kind: 'week', weekStart: '2026-10-26', tasksDone: 31, focusedMs: WEEK_DAILY.reduce((a, v) => a + v, 0), goldRings: 9, daysShowedUp: 7, dailyMs: WEEK_DAILY },
  { kind: 'month', monthKey: '2026-11', monthFocusMs: MONTH_FOCUS, goalHours: 2, daysShowedUp: 1, dailyMs: MONTH_DAILY },
];
const SIX: Moment[] = [...FIRST, ...OTHERS];
const HEADLINES = ['LONGEST TASK.', 'DAY COMPLETE.', 'PERSONAL BEST.', '7-DAY STREAK.', 'WEEK COMPLETE.', 'MONTHLY GOAL.'];

beforeEach(() => {
  mockReduce = true;
  jest.useFakeTimers({ doNotFake: ["requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask", "nextTick", "setImmediate", "clearImmediate"] });
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('MomentsPlayer all six moments', () => {
  it('draws each moment in MOMENT_ORDER with n / 6, mounting one at a time, then the ending', async () => {
    const onDone = jest.fn();
    await renderThemed(<MomentsPlayer moments={SIX} bars={[]} onDone={onDone} />);
    for (let i = 0; i < SIX.length; i++) {
      expect(screen.getByText(HEADLINES[i])).toBeTruthy();
      expect(screen.getByText(`${i + 1} / 6`)).toBeTruthy();
      expect(screen.getByTestId(`moment-${MOMENT_ORDER[i]}`)).toBeTruthy();
      expect(screen.getAllByTestId(/^moment-/)).toHaveLength(1); // exactly the one on screen
      await act(() => jest.advanceTimersByTime(REDUCED_STEP_MS));
    }
    expect(screen.getByTestId('moments-ending-6')).toBeTruthy();
    expect(screen.queryAllByTestId(/^moment-/).length).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Skip ends the run mid-sequence', async () => {
    const onDone = jest.fn();
    await renderThemed(<MomentsPlayer moments={SIX} bars={[]} onDone={onDone} />);
    await act(() => jest.advanceTimersByTime(REDUCED_STEP_MS * 2));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('the animated path mounts one moment body only, and Skip works', async () => {
    mockReduce = false;
    const onDone = jest.fn();
    await renderThemed(<MomentsPlayer moments={SIX} bars={[]} onDone={onDone} />);
    expect(screen.getAllByTestId(/^moment-/).length).toBeLessThanOrEqual(2);
    expect(screen.getAllByText('1 / 6').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('MomentsPlayer', () => {
  it('the Longest moment works without the other bars (the winner alone)', async () => {
    const longest: Moment = { kind: 'longest', name: 'Study', colorKey: 'study', focusedMs: 65 * MIN, budgetSec: 3600 };
    await renderThemed(<MomentsPlayer moments={[longest]} bars={[]} onDone={() => {}} />);
    expect(screen.getByText('LONGEST TASK.')).toBeTruthy();
    expect(screen.getAllByText('1:05').length).toBeGreaterThan(0);
  });

  it('shows the other timed tasks as bars, most focus first, at most three', async () => {
    const longest: Moment = { kind: 'longest', name: 'Study', colorKey: 'study', focusedMs: 65 * MIN, budgetSec: 3600 };
    const bars = [
      { name: 'Study', focusedMs: 65 * MIN }, { name: 'Run', focusedMs: 30 * MIN },
      { name: 'Read', focusedMs: 25 * MIN }, { name: 'Draw', focusedMs: 5 * MIN },
    ];
    await renderThemed(<MomentsPlayer moments={[longest]} bars={bars} onDone={() => {}} />);
    expect(screen.getByText('RUN')).toBeTruthy();
    expect(screen.getByText('READ')).toBeTruthy();
    expect(screen.queryByText('DRAW')).toBeNull();
  });
});

describe('MomentsPlayer animated path', () => {
  it('mounts with the clock running; Skip works mid-sequence and Continue is not offered yet', async () => {
    mockReduce = false;
    const onDone = jest.fn();
    const day: Moment = { kind: 'day', done: 2, total: 2, focusedMs: 30 * MIN, closedAt: 0 };
    await renderThemed(<MomentsPlayer moments={[day]} bars={[]} onDone={onDone} />);
    expect(screen.getByTestId('moments-mark', { hidden: true })).toBeTruthy();
    expect(screen.getByText('DAY COMPLETE.')).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Day complete: 2 of 2 tasks, 30 minutes focused.');
    // Mid-sequence a stray tap does nothing: Continue only appears once the sequence has ended. Skip always works.
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
