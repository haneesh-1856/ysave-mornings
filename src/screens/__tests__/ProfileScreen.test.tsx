import { fireEvent, screen } from '@testing-library/react-native';

import { dayStartOf } from '@/domain/dayKey';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { ProfileScreen, hoursText } from '../ProfileScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { setupState(NOW); mockPush.mockClear(); mockBack.mockClear(); });
afterEach(teardownState);

describe('hoursText', () => {
  it('rounds sensibly', () => {
    expect(hoursText(0)).toBe('0h');
    expect(hoursText(3.54)).toBe('3.5h');
    expect(hoursText(9.99)).toBe('10h');
    expect(hoursText(14.4)).toBe('14h');
  });
});

describe('ProfileScreen', () => {
  it('shows the avatar, stats and settings rows', async () => {
    await renderThemed(<ProfileScreen />);
    expect(screen.getByText('Y', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText(/^Day \d+ with YSave Mornings$/)).toBeTruthy();
    expect(screen.getByText('days you showed up')).toBeTruthy();
    expect(screen.getByText('0h')).toBeTruthy();
    expect(screen.getByText('marbles')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'My day starts, 4:00 AM' })).toBeTruthy();
    expect(screen.getByText('Full settings in M7')).toBeTruthy();
    expect(screen.getByText('Coming in M7')).toBeTruthy();
    expect(screen.getByText('Not decided')).toBeTruthy();
    expect(screen.getAllByText('Coming later')).toHaveLength(2);
  });

  it('opens Day start', async () => {
    await renderThemed(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'My day starts, 4:00 AM' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/day-start');
  });

  it('Try a look still switches the look', async () => {
    await renderThemed(<ProfileScreen />);
    expect(screen.getByText('Look')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use the Ink notebook look' }));
    expect(screen.getByRole('button', { name: 'Use the Ink notebook look' })).toBeTruthy();
    expect(screen.getAllByText('Ink notebook').length).toBe(2); // the Look row now names it
  });
});
