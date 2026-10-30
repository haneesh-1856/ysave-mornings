import { act, fireEvent, screen } from '@testing-library/react-native';

import { dayStartOf } from '@/domain/dayKey';
import { createTask, createTopic } from '@/state/actions/library';
import { saveLook } from '@/state/actions/look';
import { reconcile } from '@/state/actions/reconcile';
import { toggleCheckTask } from '@/state/actions/run';
import { getDb } from '@/state/dbRef';
import { loadDayBundle } from '@/data/repos/days';
import { DEFAULT_LOOK } from '@/theme/look';
import { useLookStore } from '@/theme/ThemeProvider';
import { setupState, teardownState } from '@/state/testSupport';
import { SEED_FAVOURITES } from '@/theme/favourites';
import { renderThemed } from '@/ui/testing';

import { ProfileScreen, hoursText } from '../ProfileScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/state/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { useLookStore.setState({ look: DEFAULT_LOOK }); setupState(NOW); mockPush.mockClear(); mockBack.mockClear(); });
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
    expect(screen.queryByText('Full settings in M7')).toBeNull();
    expect(screen.queryByText('Try a look')).toBeNull();
    expect(screen.getByText('Not decided')).toBeTruthy();
    expect(screen.getAllByText('Coming later')).toHaveLength(2);
  });

  it('opens Day start', async () => {
    await renderThemed(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'My day starts, 4:00 AM' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/day-start');
  });

  it('shows non-zero stats', async () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Stretch', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
    reconcile();
    const dt = loadDayBundle(getDb(), '2026-10-29')!.dayTasks[0];
    toggleCheckTask(dt.id);
    await renderThemed(<ProfileScreen />);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2); // 1 day showed up, 1 marble
    expect(screen.getByText('0h')).toBeTruthy(); // a check task adds no focused time
  });

  it('Look and Glass rows show their values and open their screens', async () => {
    await renderThemed(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Look, Night owl glass' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/look');
    await fireEvent.press(screen.getByRole('button', { name: 'Glass, Match the palette' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/glass');
  });

  it('names the third stat after the look items', async () => {
    await renderThemed(<ProfileScreen />);
    await act(async () => saveLook({ art: 'garden' }));
    expect(screen.getByText('flowers')).toBeTruthy();
    await act(async () => saveLook({ art: 'plant' }));
    expect(screen.getByText('leaves')).toBeTruthy();
    await act(async () => saveLook({ art: 'glass' }));
  });

  it('names a favourite, "Custom" for an unmatched mix, and "Off" for Glass without frosted glass', async () => {
    await renderThemed(<ProfileScreen />);
    await act(async () => saveLook({ pal: 'sunrise' }));
    expect(screen.getByRole('button', { name: 'Look, Custom' })).toBeTruthy();
    await act(async () => saveLook({ surf: 'flat' }));
    expect(screen.getByRole('button', { name: 'Glass, Off' })).toBeTruthy();
    await act(async () => saveLook(SEED_FAVOURITES[1].mix));
    expect(screen.getByRole('button', { name: 'Look, Morning mist' })).toBeTruthy();
  });
});
