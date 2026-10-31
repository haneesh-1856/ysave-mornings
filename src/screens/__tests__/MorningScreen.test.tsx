import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';

import Index from '@/app/index';
import { getSetting } from '@/data/repos/settings';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft } from '@/domain/plan';
import { createTopic } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { markMorningSeen, MORNING_SETTING, useMorning } from '@/state/hooks/useMorning';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { MorningScreen } from '../MorningScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    dismissTo: (...a: unknown[]) => mockDismissTo(...a),
  },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const YESTERDAY = '2026-10-28';
const TODAY = '2026-10-29'; // Thursday
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;

function draft(dayKey: string, topicId: string): PlanDraft {
  return {
    dayKey,
    groups: [
      {
        topicId,
        rows: [
          {
            key: 'k', taskId: null, topicId, name: 'Read', colorKey: 'study', kind: 'timed', minutes: 30, cue: null,
            treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null,
          },
        ],
      },
    ],
    notOn: [],
  };
}

let topicId: string;
beforeEach(() => {
  setupState(dayStartOf(YESTERDAY, 4) + 6 * 3_600_000);
  mockReplace.mockClear();
  mockDismissTo.mockClear();
  // History: yesterday's days row (made by reconcile), so Morning is due and Day N counts from it.
  topicId = createTopic({ name: 'Study', colorKey: 'study' }).id;
  reconcile();
  setClockOverride(() => NOW);
});
afterEach(teardownState);

describe('MorningScreen', () => {
  it('shows the weekday, Day N, the chain and the sunrise text', async () => {
    await renderThemed(<MorningScreen />);
    expect(screen.getByText('Thursday')).toBeTruthy();
    expect(screen.getByText('Day 2')).toBeTruthy();
    expect(screen.getByText('A fresh page')).toBeTruthy();
    expect(screen.getByText('Thursday · Day 2')).toBeTruthy();
    expect(screen.getByLabelText(/^Last 8 days/)).toBeTruthy();
  });

  it("planned today: shows the jar with the planning marble and See today's plan", async () => {
    confirmDayPlan(TODAY, draft(TODAY, topicId));
    await renderThemed(<MorningScreen />);
    expect(screen.getByRole('image', { name: 'Jar with 1 marble' })).toBeTruthy();
    expect(screen.queryByText("Today isn't planned yet")).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "See today's plan" }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('unplanned today: offers Plan today (replace) and Go to Today', async () => {
    await renderThemed(<MorningScreen />);
    expect(screen.getByText("Today isn't planned yet")).toBeTruthy();
    expect(screen.queryByRole('image', { name: /^Jar/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan today' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TODAY } });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('marks the morning seen on mount, so useMorning().due is false afterwards', async () => {
    const hook = await renderHook(() => useMorning());
    expect(hook.result.current.due).toBe(true);
    await renderThemed(<MorningScreen />);
    expect(getSetting(getDb(), MORNING_SETTING)).toBe(TODAY);
    expect(hook.result.current.due).toBe(false);
  });

  it('Android back goes to Today', async () => {
    const { BackHandler } = jest.requireActual('react-native');
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    await renderThemed(<MorningScreen />);
    const call = spy.mock.calls.find(c => c[0] === 'hardwareBackPress')!;
    let handled: unknown;
    await act(async () => {
      handled = (call[1] as () => unknown)();
    });
    expect(handled).toBe(true);
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
    spy.mockRestore();
  });
});

describe('Index redirect', () => {
  it('goes to /morning when due', async () => {
    await renderThemed(<Index />);
    expect(screen.getByText('redirect:/morning')).toBeTruthy();
  });

  it('goes to /today when not due', async () => {
    markMorningSeen();
    await renderThemed(<Index />);
    expect(screen.getByText('redirect:/today')).toBeTruthy();
  });
});
