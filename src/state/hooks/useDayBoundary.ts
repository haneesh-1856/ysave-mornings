import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getDayStartHour } from '../../data/repos/settings';
import { dayEndOf, dayKeyOf } from '../../domain/dayKey';
import { reconcile } from '../actions/reconcile';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { bump } from '../store';

const MARGIN_MS = 250; // fire just after the boundary so dayKeyOf has really flipped
const MAX_WAIT_MS = 3_600_000; // JS timers drift and have a max delay: wait in slices of <= 1 h and re-check

/**
 * Keeps an open app correct across the day boundary (doc 04 section 3). Arms a timer for the next
 * dayEndOf(todayKey); when the day key has changed it runs reconcile() (auto-closes yesterday, prefills
 * today) and bumps 'days'. Re-armed after every fire and whenever the app returns to the foreground.
 * Cleared on unmount.
 */
export function useDayBoundary(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    let armedKey = '';

    const arm = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (!alive) return;
      const db = getDb();
      const at = now();
      const hour = getDayStartHour(db);
      armedKey = dayKeyOf(at, hour);
      const wait = Math.max(0, dayEndOf(armedKey, hour) - at + MARGIN_MS);
      timer = setTimeout(onFire, Math.min(wait, MAX_WAIT_MS));
    };

    const onFire = (): void => {
      timer = null;
      if (!alive) return;
      // A capped slice (or an early/drifting timer) fires before the boundary: just re-arm.
      if (dayKeyOf(now(), getDayStartHour(getDb())) !== armedKey) {
        reconcile();
        bump('days');
      }
      arm();
    };

    arm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') arm();
    });
    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
