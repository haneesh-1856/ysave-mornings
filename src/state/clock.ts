import type { Epoch } from '@/domain/types';

// The only place in the app that reads the real time. Everything else calls now().
let override: (() => Epoch) | null = null;

export function now(): Epoch {
  return override ? override() : Date.now();
}

/** Tests and the dev fast-forward menu swap the clock here. Pass null to restore real time. */
export function setClockOverride(fn: (() => Epoch) | null): void {
  override = fn;
}
