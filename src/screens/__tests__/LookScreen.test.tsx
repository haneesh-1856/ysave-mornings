import { act, fireEvent, screen } from '@testing-library/react-native';

import { getSetting } from '@/data/repos/settings';
import { saveLook } from '@/state/actions/look';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { SEED_FAVOURITES } from '@/theme/favourites';
import { DEFAULT_LOOK } from '@/theme/look';
import { useLookStore } from '@/theme/ThemeProvider';
import { renderThemed } from '@/ui/testing';

import { LookScreen } from '../LookScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/state/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

beforeEach(() => { useLookStore.setState({ look: DEFAULT_LOOK }); setupState(1_000); mockPush.mockClear(); mockBack.mockClear(); });
afterEach(() => { teardownState(); useLookStore.setState({ look: DEFAULT_LOOK }); });

const saved = () => getSetting(getDb(), 'look');
const favs = () => getSetting(getDb(), 'lookFavourites') as { name: string; mix: unknown; pinned: boolean }[] | undefined;
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title},`) });
const expanded = (title: string) => row(title).props.accessibilityState.expanded;
const selected = (name: string) => screen.getByRole('radio', { name }).props.accessibilityState.selected;
const favOn = (name: string) => screen.getByRole('button', { name: `Use the ${name} look` }).props.accessibilityState.selected;
const confirmBtn = () => screen.getByRole('button', { name: 'Confirm' });
const confirmDisabled = () => !!confirmBtn().props.accessibilityState?.disabled;

describe('LookScreen', () => {
  it('lists the 11 rows collapsed, in the style-lab order, with their current values', async () => {
    await renderThemed(<LookScreen />);
    const labels = [
      'Colors, Night owl', 'Typeface, Friendly', 'Corners, Soft', 'Surfaces, Frosted glass', 'Glass, Match the palette',
      'Collection, Glass jar', 'Motion, Springy', 'Screen transition, Slide sideways', 'Home structure, Jar in a bottom dock',
      'Countdown bar, Thin line, big number', 'Bottom tabs, Floating pill',
    ];
    const buttons = screen.getAllByRole('button').map(b => b.props.accessibilityLabel as string);
    const positions = labels.map(l => buttons.indexOf(l));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('Your saved mix')).toBeNull();
    expect(screen.queryByText('PRESETS')).toBeNull();
  });

  it('opens one row at a time and shows its hint, options, Confirm and Cancel', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Typeface'));
    expect(expanded('Typeface')).toBe(true);
    expect(screen.getByText('personality of the words')).toBeTruthy();
    expect(selected('Friendly')).toBe(true);
    expect(confirmDisabled()).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await fireEvent.press(row('Corners'));
    expect(expanded('Corners')).toBe(true);
    expect(expanded('Typeface')).toBe(false);
    expect(screen.queryByText('personality of the words')).toBeNull();
    await fireEvent.press(row('Corners'));
    expect(expanded('Corners')).toBe(false);
  });

  it('the layout hint names the collection of the current look', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Home structure'));
    expect(screen.getByText('where the jar lives on Today')).toBeTruthy();
    await act(async () => saveLook({ art: 'garden' }));
    expect(screen.getByText('where the garden lives on Today')).toBeTruthy();
  });

  it('options do not announce "double tap to clear"', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Typeface'));
    expect(screen.getByRole('radio', { name: 'Friendly' }).props.accessibilityHint).toBeUndefined();
  });

  it('a pick changes only the preview; the app theme and the saved look stay put', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Bottom tabs'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Icons only' }));
    expect(selected('Icons only')).toBe(true);
    expect(screen.getByLabelText('Tab bar: Icons only', { includeHiddenElements: true })).toBeTruthy();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
    expect(saved()).toBeUndefined();
    expect(confirmDisabled()).toBe(false);
  });

  it('Confirm saves the one change, adds a favourite and closes the row', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Collection'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Garden' }));
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, art: 'garden' });
    expect(useLookStore.getState().look.art).toBe('garden');
    expect(favs()![0]).toMatchObject({ name: 'Night owl · Garden', pinned: false });
    expect(screen.getByRole('button', { name: 'Use the Night owl · Garden look' })).toBeTruthy();
    expect(row('Collection').props.accessibilityLabel).toBe('Collection, Garden');
    expect(expanded('Collection')).toBe(false);
  });

  it.each([
    ['Colors', 'Mist', { pal: 'mist' }],
    ['Typeface', 'Rounded', { font: 'nunito' }],
    ['Corners', 'Crisp', { shape: 'crisp' }],
    ['Surfaces', 'Bold outline', { surf: 'outline' }],
    ['Motion', 'Snappy', { motion: 'crisp' }],
    ['Screen transition', 'Fade through', { trans: 'fade' }],
    ['Home structure', 'Big jar on top', { layout: 'hero' }],
    ['Countdown bar', 'One smooth bar', { bar: 'smooth' }],
  ])('%s: picking %s then Confirm saves only that key', async (title, option, patch) => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row(title));
    await fireEvent.press(screen.getByRole('radio', { name: option }));
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, ...patch });
  });

  it('Confirm is disabled again when the pick goes back to the current value', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Typeface'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Rounded' }));
    expect(confirmDisabled()).toBe(false);
    await fireEvent.press(screen.getByRole('radio', { name: 'Friendly' }));
    expect(confirmDisabled()).toBe(true);
    await fireEvent.press(confirmBtn());
    expect(saved()).toBeUndefined();
  });

  it('Cancel, closing, and opening another row discard the pick', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(row('Typeface'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Rounded' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(expanded('Typeface')).toBe(false);
    await fireEvent.press(row('Typeface'));
    expect(selected('Friendly')).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Rounded' }));
    await fireEvent.press(row('Corners')); // opening another row
    await fireEvent.press(row('Typeface'));
    expect(selected('Friendly')).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Rounded' }));
    await fireEvent.press(row('Typeface')); // closing
    await fireEvent.press(row('Typeface'));
    expect(selected('Friendly')).toBe(true);
    expect(saved()).toBeUndefined();
    expect(favs()).toBeUndefined();
  });

  it('leaving the screen discards the pick', async () => {
    const view = await renderThemed(<LookScreen />);
    await fireEvent.press(row('Typeface'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Rounded' }));
    await view.unmount();
    expect(saved()).toBeUndefined();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('lists the 5 seeded favourites, marks the current one, and tapping one applies it', async () => {
    await renderThemed(<LookScreen />);
    for (const f of SEED_FAVOURITES) expect(screen.getByRole('button', { name: `Use the ${f.name} look` })).toBeTruthy();
    expect(favOn('Night owl glass')).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Use the Sunrise jam look' }));
    expect(saved()).toEqual(SEED_FAVOURITES[2].mix);
    expect(favOn('Sunrise jam')).toBe(true);
    expect(favOn('Night owl glass')).toBe(false);
    expect(favs()![0].name).toBe('Sunrise jam');
    const used = screen.getAllByRole('button').map(b => b.props.accessibilityLabel as string).filter(l => l?.startsWith('Use the '));
    expect(used[0]).toBe('Use the Sunrise jam look'); // moved to the top
  });

  it('the pin button toggles and is saved', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pin Morning mist' }));
    expect(screen.getByRole('button', { name: 'Unpin Morning mist' }).props.accessibilityState.selected).toBe(true);
    expect(favs()!.find(f => f.name === 'Morning mist')!.pinned).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Unpin Morning mist' }));
    expect(screen.getByRole('button', { name: 'Pin Morning mist' }).props.accessibilityState.selected).toBe(false);
  });

  it('the Glass row shows the tint, or Off, and opens the Glass screen', async () => {
    await renderThemed(<LookScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Glass, Match the palette' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/glass');
    await act(async () => saveLook({ surf: 'flat' }));
    expect(screen.getByRole('button', { name: 'Glass, Off' })).toBeTruthy();
  });

  it('back goes back (button and Android back)', async () => {
    const { BackHandler } = jest.requireActual('react-native');
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    await renderThemed(<LookScreen />);
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
