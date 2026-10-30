import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { create } from 'zustand';

import { buildTheme, type Theme } from './buildTheme';
import { DEFAULT_LOOK, normalizeLook, type LookMix } from './look';

// The look mix lives in a small store so Profile › Look can change it from anywhere.
// Persisting it to SQLite settings arrives with the data layer (milestone M1).
type LookStore = { look: LookMix; setLook: (patch: Partial<LookMix>) => void };

export const useLookStore = create<LookStore>(set => ({
  look: DEFAULT_LOOK,
  setLook: patch => set(s => ({ look: normalizeLook({ ...s.look, ...patch }) })),
}));

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const look = useLookStore(s => s.look);
  const theme = useMemo(() => buildTheme(look), [look]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
