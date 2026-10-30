import { act, fireEvent, screen } from '@testing-library/react-native';

import { dayStartOf } from '@/domain/dayKey';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { getDayStartHour } from '@/data/repos/settings';
import { getDb } from '@/state/dbRef';
import { DayStartScreen, explanation } from '../DayStartScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { setupState(NOW); mockPush.mockClear(); mockBack.mockClear(); });
afterEach(teardownState);

describe('explanation', () => {
  it('stays true for every hour', () => {
    expect(explanation(4)).toBe('A session at 1 AM still counts as yesterday.');
    expect(explanation(1)).toBe('A session at 12:30 AM still counts as yesterday.');
    expect(explanation(0)).toMatch(/midnight/);
  });
});

describe('DayStartScreen', () => {
  it('shows the current hour selected and no "Today still ends" line yet', async () => {
    await renderThemed(<DayStartScreen />);
    expect(screen.getByText('My day starts')).toBeTruthy();
    expect(screen.getByText('A session at 1 AM still counts as yesterday.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '4:00 AM' }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText(/Today still ends/)).toBeNull();
  });

  it('tapping an hour only drafts it: nothing is saved, a preview shows', async () => {
    await renderThemed(<DayStartScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '6:00 AM' }));
    expect(getDayStartHour(getDb())).toBe(4);
    expect(screen.getByRole('radio', { name: '6:00 AM' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Today still ends at 4:00 AM. From tomorrow, each day ends at 6:00 AM.')).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('the confirm button is disabled while the draft equals the saved hour', async () => {
    await renderThemed(<DayStartScreen />);
    expect(screen.getByRole('button', { name: 'Start my days at 4:00 AM' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('radio', { name: '6:00 AM' }));
    expect(screen.getByRole('button', { name: 'Start my days at 6:00 AM' }).props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(screen.getByRole('radio', { name: '4:00 AM' }));
    expect(screen.getByRole('button', { name: 'Start my days at 4:00 AM' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText(/Today still ends/)).toBeNull();
  });

  it('confirming saves, shows Saved and the post-save line', async () => {
    await renderThemed(<DayStartScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '6:00 AM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start my days at 6:00 AM' }));
    expect(getDayStartHour(getDb())).toBe(6);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Today still ends at 4:00 AM. From tomorrow, each day ends at 6:00 AM.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start my days at 6:00 AM' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('radio', { name: '7:00 AM' }));
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('leaving without confirming changes nothing', async () => {
    await renderThemed(<DayStartScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '9:00 AM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Profile' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(getDayStartHour(getDb())).toBe(4);
  });

  it('back goes back (button and Android back)', async () => {
    const { BackHandler } = jest.requireActual('react-native');
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    await renderThemed(<DayStartScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Profile' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    const handler = spy.mock.calls.find(c => c[0] === 'hardwareBackPress')![1] as () => boolean;
    let handled = false;
    act(() => { handled = handler(); });
    expect(handled).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
