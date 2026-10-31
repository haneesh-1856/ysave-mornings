import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

import { isLowEndDevice } from '../state/device';
import { buildTheme, type Theme } from './buildTheme';
import { DEFAULT_LOOK, normalizeLook, type LookMix } from './look';

// The look mix lives in a small store so Profile › Look can change it from anywhere.
// It is saved to SQLite settings by saveLook and loaded before the first frame by loadLook (src/state/actions/look.ts).
// blurChosen: the user has picked a blur level themselves (a separate flag, so the saved look keeps its shape).
type LookStore = { look: LookMix; blurChosen: boolean; setLook: (patch: Partial<LookMix>) => void };

export const useLookStore = create<LookStore>(set => ({
  look: DEFAULT_LOOK,
  blurChosen: false,
  setLook: patch => set(s => ({ look: normalizeLook({ ...s.look, ...patch }) })),
}));

const ThemeContext = createContext<Theme | null>(null);

/** iOS "Reduce Transparency": cards drop the blur and keep the frost tint. Android reports false. */
function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(v => live && setOn(v), () => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

/** `look` overrides the saved look for its subtree (the Look screen's mini preview); `blurChosen` does the same for the chosen flag (a draft blur pick). */
export function ThemeProvider({ children, look: override, blurChosen: chosenOverride }: { children: ReactNode; look?: LookMix; blurChosen?: boolean }) {
  const saved = useLookStore(s => s.look);
  const look = override ?? saved;
  const savedChosen = useLookStore(s => s.blurChosen);
  const blurChosen = chosenOverride ?? savedChosen;
  const reduceTransparency = useReduceTransparency();
  const [lowEnd] = useState(isLowEndDevice); // read once: the device does not change while the app runs
  // A low-end phone starts with the blur off; picking a blur level (Profile > Color & glass) turns it back to the user's choice.
  const lowEndDevice = lowEnd && !blurChosen;
  const theme = useMemo(() => buildTheme(look, { reduceTransparency, lowEndDevice }), [look, reduceTransparency, lowEndDevice]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
