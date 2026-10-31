import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { getSetting } from '@/data/repos/settings';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { buildTheme } from '@/theme/buildTheme';
import { DEFAULT_LOOK } from '@/theme/look';
import { useLookStore } from '@/theme/ThemeProvider';
import { glassTints, palettes } from '@/theme/tokens';
import { renderThemed } from '@/ui/testing';

import { GlassScreen } from '../GlassScreen';

const mockBack = jest.fn();
// These render large trees (month grid / 28 tints); motion is already mocked, but under full parallel load a test
// can pass 5 s though it takes well under that alone. A modest per-file timeout avoids the flake.
jest.setTimeout(15000);

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/state/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
const mockBlur = () => <View testID="blur" />;
jest.mock('expo-blur', () => ({ ...jest.requireActual('expo-blur'), BlurView: () => mockBlur() }));
let mockLowEnd = false;
jest.mock('@/state/device', () => ({ isLowEndDevice: () => mockLowEnd }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

beforeEach(() => { mockLowEnd = false; useLookStore.setState({ look: DEFAULT_LOOK, blurChosen: false }); setupState(1_000); mockBack.mockClear(); });
afterEach(() => { teardownState(); useLookStore.setState({ look: DEFAULT_LOOK, blurChosen: false }); });

const saved = () => getSetting(getDb(), 'look');
const favs = () => getSetting(getDb(), 'lookFavourites') as { name: string }[] | undefined;
const isOn = (name: string) => screen.getByRole('radio', { name }).props.accessibilityState.selected;
const switchOn = () => screen.getByRole('switch', { name: 'Frosted glass' }).props.accessibilityState.checked;
const confirmBtn = () => screen.getByRole('button', { name: 'Confirm' });
const confirmDisabled = () => !!confirmBtn().props.accessibilityState?.disabled;
const blurs = () => screen.queryAllByTestId('blur', { includeHiddenElements: true }).length; // the preview card + the switch card
const OFF_COPY = 'Off, to save battery on this phone. Pick a level to turn it on.';

const cardBg = () => {
  // The preview is decorative (hidden); walk up from its sample text to the card surface.
  let n = screen.getByText('DSA practice', { includeHiddenElements: true }).parent;
  while (n) {
    const bg = StyleSheet.flatten(n.props.style)?.backgroundColor;
    if (typeof bg === 'string') return bg;
    n = n.parent;
  }
  return undefined;
};

describe('GlassScreen', () => {
  it('shows the switch, the 6 palettes, the 27 tints and 5 blurs, with the current ones selected and Confirm disabled', async () => {
    await renderThemed(<GlassScreen />);
    expect(screen.getByText('Pick the color used across the whole app.')).toBeTruthy();
    expect(switchOn()).toBe(true);
    expect(Object.keys(glassTints)).toHaveLength(28);
    for (const p of Object.values(palettes)) expect(screen.getByRole('radio', { name: p.name })).toBeTruthy();
    for (const [k, g] of Object.entries(glassTints)) {
      if (k === 'match') expect(screen.queryByRole('radio', { name: g.name })).toBeNull(); // the palette entries replace it
      else expect(screen.getByRole('radio', { name: g.name })).toBeTruthy();
    }
    expect(screen.getByText('COLOR · NIGHT OWL')).toBeTruthy();
    expect(isOn('Night owl')).toBe(true);
    expect(isOn('Mist')).toBe(false);
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
    expect(isOn('Night owl')).toBe(true); // the color stays chosen while glass is off
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

  it('picking a color leaves glass alone; Confirm saves only the tint', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'flat' } });
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Aurora' }));
    expect(isOn('Aurora')).toBe(true);
    expect(switchOn()).toBe(false);
    expect(screen.getByText('COLOR · AURORA')).toBeTruthy();
    expect(screen.getByText('GLASS')).toBeTruthy();
    expect(saved()).toBeUndefined();
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, glass: 'aurora', surf: 'flat' });
    expect(favs()![0].name).toBe('Night owl · Glass jar');
  });

  it('turning glass off keeps the color and restores the surface the user had', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'outline', glass: 'aurora' } });
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    expect(confirmDisabled()).toBe(true);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Deep frost' }));
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'outline', glass: 'aurora', gblur: 'deep' });
  });

  it('turning glass off from glass goes to flat and keeps the color', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, glass: 'aurora' } });
    await renderThemed(<GlassScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Frosted glass' }));
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, glass: 'aurora', surf: 'flat' });
    expect(isOn('Aurora')).toBe(true);
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
    await act(async () => { handled = handler(); });
    expect(handled).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('picking a palette sets pal and the match tint; the preview follows the draft and Confirm saves both', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'flat', glass: 'aurora' } });
    await renderThemed(<GlassScreen />);
    expect(isOn('Aurora')).toBe(true);
    expect(isOn('Night owl')).toBe(false); // a tint is picked, so the palette is only its base
    await fireEvent.press(screen.getByRole('radio', { name: 'Mist' }));
    expect(isOn('Mist')).toBe(true);
    expect(isOn('Aurora')).toBe(false);
    expect(screen.getByText('COLOR · MIST')).toBeTruthy();
    expect(cardBg()).toBe(palettes.mist.surface); // exactly the palette
    expect(saved()).toBeUndefined();
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'flat', pal: 'mist', glass: 'match' });
    expect(useLookStore.getState().look.pal).toBe('mist');
  });

  it('picking a tint keeps the palette as its base; the preview shows the derived colours', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, surf: 'flat', pal: 'mist' } });
    await renderThemed(<GlassScreen />);
    expect(isOn('Mist')).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Sea glass' }));
    expect(isOn('Sea glass')).toBe(true);
    expect(isOn('Mist')).toBe(false);
    expect(cardBg()).toBe(buildTheme({ ...DEFAULT_LOOK, surf: 'flat', pal: 'mist', glass: 'sea' }).c.surface);
    expect(cardBg()).not.toBe(palettes.mist.surface);
    await fireEvent.press(confirmBtn());
    expect(saved()).toEqual({ ...DEFAULT_LOOK, surf: 'flat', pal: 'mist', glass: 'sea' });
  });

  it('a saved "match the palette" look still selects its palette; cancelling the palette pick changes nothing', async () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, pal: 'lagoon' } });
    await renderThemed(<GlassScreen />);
    expect(isOn('Lagoon')).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Sunrise' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Lagoon' }));
    expect(confirmDisabled()).toBe(true);
  });

  it('confirming a tint changes the Confirm button background (the whole app follows the color)', async () => {
    await renderThemed(<GlassScreen />);
    const bg = () => StyleSheet.flatten(confirmBtn().props.style)?.backgroundColor;
    const before = bg();
    expect(before).toBe(palettes.night.accent);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ember' }));
    expect(bg()).toBe(before); // still the saved look
    await fireEvent.press(confirmBtn());
    expect(bg()).toBe(buildTheme({ ...DEFAULT_LOOK, glass: 'ember' }).c.accent);
    expect(bg()).not.toBe(before);
  });

  describe('low-end phone', () => {
    beforeEach(() => { mockLowEnd = true; });

    it('with no blur choice shows the blur as off (no level selected) and draws no blur', async () => {
      await renderThemed(<GlassScreen />);
      expect(screen.getByText(OFF_COPY)).toBeTruthy();
      expect(isOn('Medium')).toBe(false);
      expect(blurs()).toBe(0);
      expect(confirmDisabled()).toBe(true);
    });

    it('picking the same level previews blur, and Confirm counts as a choice that turns blur on', async () => {
      await renderThemed(<GlassScreen />);
      await fireEvent.press(screen.getByRole('radio', { name: 'Medium' }));
      expect(isOn('Medium')).toBe(true);
      expect(screen.queryByText(OFF_COPY)).toBeNull();
      expect(blurs()).toBe(1); // the preview follows the draft; the real screen is still off
      expect(useLookStore.getState().blurChosen).toBe(false);
      expect(confirmDisabled()).toBe(false);
      await fireEvent.press(confirmBtn());
      expect(useLookStore.getState().blurChosen).toBe(true);
      expect(getSetting(getDb(), 'gblurChosen')).toBe(true);
      expect(saved()).toEqual(DEFAULT_LOOK); // the level itself did not change
      expect(blurs()).toBe(2);
      expect(confirmDisabled()).toBe(true);
    });

    it('once a level was chosen, the screen behaves as on any phone', async () => {
      useLookStore.setState({ blurChosen: true });
      await renderThemed(<GlassScreen />);
      expect(screen.queryByText(OFF_COPY)).toBeNull();
      expect(isOn('Medium')).toBe(true);
      expect(blurs()).toBe(2);
    });
  });

  it('on a normal phone, re-picking the saved level changes nothing and is not a choice', async () => {
    await renderThemed(<GlassScreen />);
    expect(screen.queryByText(OFF_COPY)).toBeNull();
    expect(blurs()).toBe(2);
    await fireEvent.press(screen.getByRole('radio', { name: 'Medium' }));
    expect(confirmDisabled()).toBe(true);
    expect(useLookStore.getState().blurChosen).toBe(false);
  });
});
