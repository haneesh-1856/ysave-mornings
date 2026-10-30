import { act, fireEvent, screen } from '@testing-library/react-native';

import { getSetting } from '@/data/repos/settings';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { DEFAULT_LOOK } from '@/theme/look';
import { useLookStore } from '@/theme/ThemeProvider';
import { glassTints } from '@/theme/tokens';
import { renderThemed } from '@/ui/testing';

import { GlassScreen } from '../GlassScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/state/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

beforeEach(() => { useLookStore.setState({ look: DEFAULT_LOOK }); setupState(1_000); mockBack.mockClear(); });
afterEach(() => { teardownState(); useLookStore.setState({ look: DEFAULT_LOOK }); });

const saved = () => getSetting(getDb(), 'look');
const favs = () => getSetting(getDb(), 'lookFavourites') as { name: string }[] | undefined;
const isOn = (name: string) => screen.getByRole('radio', { name }).props.accessibilityState.selected;
const switchOn = () => screen.getByRole('switch', { name: 'Frosted glass' }).props.accessibilityState.checked;
const confirmBtn = () => screen.getByRole('button', { name: 'Confirm' });
const confirmDisabled = () => !!confirmBtn().props.accessibilityState?.disabled;

describe('GlassScreen', () => {
  it('shows the switch, all 28 tints and 5 blurs, with the current ones selected and Confirm disabled', async () => {
    await renderThemed(<GlassScreen />);
    expect(screen.getByText('Pick the colors that glow behind your cards. Your chain follows along.')).toBeTruthy();
    expect(switchOn()).toBe(true);
    expect(Object.keys(glassTints)).toHaveLength(28);
    for (const g of Object.values(glassTints)) expect(screen.getByRole('radio', { name: g.name })).toBeTruthy();
    expect(screen.getByText('TINT · MATCH THE PALETTE')).toBeTruthy();
    expect(isOn('Match the palette')).toBe(true);
    expect(isOn('Medium')).toBe(true);
    expect(isOn('Barely there')).toBe(false);
    expect(confirmDisabled()).toBe(true);
  });

  it('blur chips do not announce "double tap to clear"', async () => {
    await renderThemed(<GlassScreen />);
    expect(screen.getByRole('radio', { name: 'Medium' }).props.accessibilityHint).toBeUndefined();
  });

  it('the switch is a draft: nothing is saved until Confirm, and the draft turns glass off then on', async () => {
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    expect(switchOn()).toBe(false);
    expect(isOn('Match the palette')).toBe(false); // no tint is marked while glass is off
    expect(saved()).toBeUndefined();
    expect(useLookStore.getState().look.surf).toBe('glass');
    expect(confirmDisabled()).toBe(false);
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'flat' });
    expect(confirmDisabled()).toBe(true);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'glass' });
  });

  it('toggling back to the saved state disables Confirm again', async () => {
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    expect(confirmDisabled()).toBe(true);
  });

  it('picking a tint turns glass on in the draft; Confirm saves tint + glass and adds a favourite', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'flat' } });
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Aurora' }));
    expect(isOn('Aurora')).toBe(true);
    expect(switchOn()).toBe(true);
    expect(screen.getByText('TINT · AURORA')).toBeTruthy();
    expect(saved()).toBeUndefined();
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, glass: 'aurora', surf: 'glass' });
    expect(favs()![0].name).toBe('Night owl · Glass jar');
  });

  it('Confirm sends only the changed fields (a blur pick leaves other surfaces alone)', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'outline' } });
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Deep frost' }));
    expect(isOn('Deep frost')).toBe(true);
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'outline', gblur: 'deep' });
  });

  it('leaving without Confirm changes nothing', async () => {
    const view = await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Aurora' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Deep frost' }));
    await view.unmount();
    expect(saved()).toBeUndefined();
    expect(favs()).toBeUndefined();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('back goes back (button, Cancel and Android back)', async () => {
    const { BackHandler } = jest.requireActual('react-native');
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Profile' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockBack).toHaveBeenCalledTimes(2);
    const handler = spy.mock.calls.find(c => c[0] === 'hardwareBackPress')![1] as () => boolean;
    let handled = false;
    act(() => { handled = handler(); });
    expect(handled).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
