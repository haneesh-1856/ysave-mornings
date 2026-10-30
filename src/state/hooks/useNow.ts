import { useEffect, useState } from 'react';
import type { Epoch } from '../../domain/types';
import { now } from '../clock';

/** Ticking clock for small UI pieces (a running row's time text). Re-renders every intervalMs; cleared on unmount. */
export function useNow(intervalMs = 1000): Epoch {
  const [t, setT] = useState<Epoch>(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}
