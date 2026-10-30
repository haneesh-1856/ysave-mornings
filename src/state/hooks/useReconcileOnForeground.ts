import { useEffect } from 'react';
import { AppState } from 'react-native';
import { reconcile } from '../actions/reconcile';

/** Runs reconcile() on mount and each time the app returns to 'active'. Call once from the root layout. */
export function useReconcileOnForeground(): void {
  useEffect(() => {
    reconcile();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reconcile();
    });
    return () => sub.remove();
  }, []);
}
