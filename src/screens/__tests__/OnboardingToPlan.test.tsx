import { fireEvent, screen } from '@testing-library/react-native';

import { loadDayBundle } from '@/data/repos/days';
import { dayStartOf } from '@/domain/dayKey';
import { finishOnboarding } from '@/state/actions/onboarding';
import { getDb } from '@/state/dbRef';
import { needsOnboarding } from '@/state/hooks/useOnboarding';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { PlanScreen } from '../PlanScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockReplace = jest.fn();
let mockParam = '';
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn() },
  useLocalSearchParams: () => ({ dayKey: mockParam }),
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { setupState(NOW); mockReplace.mockClear(); });
afterEach(teardownState);

describe('fresh install: finishOnboarding then Plan today', () => {
  it.each<number | null>([null, 45])('opens plan mode for today with the new task pre-ticked (minutes %s)', async (minutes) => {
    const { todayKey } = finishOnboarding({ dayStartHour: 4, topic: { name: 'Study', colorKey: 'study' }, task: { name: 'Read', minutes } });
    expect(loadDayBundle(getDb(), todayKey)).toBeNull(); // no days row yet
    mockParam = todayKey;
    await renderThemed(<PlanScreen />);
    expect(screen.getByText('Plan today')).toBeTruthy();
    expect(screen.queryByText(/You can plan today until it closes/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Include Read' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /looks like this/ }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/planned/[dayKey]', params: { dayKey: todayKey } });
    expect(loadDayBundle(getDb(), todayKey)?.day.planConfirmedAt).not.toBeNull();
    expect(loadDayBundle(getDb(), todayKey)?.dayTasks.length).toBe(1);
    expect(needsOnboarding()).toBe(false);
  });
});
