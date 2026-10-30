import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

import { buildTheme, type Theme } from './buildTheme';
import { DEFAULT_LOOK, normalizeLook, type LookMix } from './look';

// The look mix lives in a small store so Profile › Look can change it from anywhere.
// It is saved to SQLite settings by saveLook and loaded before the first frame by loadLook (src/state/actions/look.ts).
type LookStore = { look: LookMix; setLook: (patch: Partial<LookMix>) => void };

export const useLookStore = create<LookStore>(set => ({
  look: DEFAULT_LOOK,
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

/** `look` overrides the saved look for its subtree (the Look screen's mini preview). */
export function ThemeProvider({ children, look: override }: { children: ReactNode; look?: LookMix }) {
  const saved = useLookStore(s => s.look);
  const look = override ?? saved;
  const reduceTransparency = useReduceTransparency();
  const theme = useMemo(() => buildTheme(look, { reduceTransparency }), [look, reduceTransparency]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
