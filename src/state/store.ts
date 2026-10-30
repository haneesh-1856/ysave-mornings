import { create } from 'zustand';

export type Table = 'topics' | 'tasks' | 'days' | 'sessions' | 'settings';
const TABLES: readonly Table[] = ['topics', 'tasks', 'days', 'sessions', 'settings'];

type Versions = Record<Table, number>;

const initial = (): Versions => ({ topics: 0, tasks: 0, days: 0, sessions: 0, settings: 0 });

export const useStore = create<Versions>(initial);

/** Tell hooks that these tables changed, so they re-read. */
export function bump(...tables: Table[]): void {
  useStore.setState((s) => {
    const next: Partial<Versions> = {};
    for (const t of tables) next[t] = s[t] + 1;
    return next;
  });
}

/** Tests only. */
export function resetStore(): void {
  useStore.setState(initial(), true);
}

/**
 * A number that changes whenever any listed table is bumped. Subscribes only to those tables
 * (the selector returns a primitive sum, so other tables never cause a re-render).
 */
export function useDataVersion(tables: Table[]): number {
  return useStore((s) => tables.reduce((sum, t) => sum + s[t], 0));
}

export { TABLES };
