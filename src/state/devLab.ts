// Moments lab, storage side (dev only, 2026-11-05). Each player step is written to the settings table at once
// (a synchronous SQLite write), so it survives the app being killed by a native crash a moment later; reopening the
// app shows the last step reached. Also keeps the last close's moments (to replay them without closing another day)
// and the lab switches. Every function does nothing in a release build.
import { getSetting, setSetting } from '../data/repos/settings';
import type { Moment } from '../domain/moments';
import { now } from './clock';
import { getDb } from './dbRef';

const TRAIL_KEY = 'dev.momentsTrail';
const LAST_CLOSE_KEY = 'dev.lastClose';
const FLAGS_KEY = 'dev.labFlags';
const TRAIL_MAX = 60;

export type TrailStep = { at: number; step: string };
export type LastClose = { at: number; moments: Moment[]; bars: { name: string; focusedMs: number }[] };

function trailOf(v: unknown): TrailStep[] {
  return Array.isArray(v) ? v.filter((x): x is TrailStep => !!x && typeof x.at === 'number' && typeof x.step === 'string') : [];
}

/** Appends one step (keeps the last TRAIL_MAX). */
export function recordStep(step: string): void {
  if (!__DEV__) return;
  const db = getDb();
  const at = now();
  const trail = [...trailOf(getSetting(db, TRAIL_KEY)), { at, step }].slice(-TRAIL_MAX);
  setSetting(db, TRAIL_KEY, trail, at);
}

export function readTrail(): TrailStep[] {
  if (!__DEV__) return [];
  return trailOf(getSetting(getDb(), TRAIL_KEY));
}

export function clearTrail(): void {
  if (!__DEV__) return;
  setSetting(getDb(), TRAIL_KEY, [], now());
}

/** Called by the Close screen right after a close by hand returned moments. */
export function saveLastClose(moments: Moment[], bars: { name: string; focusedMs: number }[]): void {
  if (!__DEV__ || moments.length === 0) return;
  const at = now();
  setSetting(getDb(), LAST_CLOSE_KEY, { at, moments, bars }, at);
}

export function readLastClose(): LastClose | null {
  if (!__DEV__) return null;
  const v = getSetting(getDb(), LAST_CLOSE_KEY) as Partial<LastClose> | undefined;
  return v && Array.isArray(v.moments) && v.moments.length > 0 && typeof v.at === 'number'
    ? { at: v.at, moments: v.moments as Moment[], bars: Array.isArray(v.bars) ? v.bars : [] }
    : null;
}

/** The lab switches as stored (validated by the UI's setLabFlags). */
export function readLabFlags(): unknown {
  if (!__DEV__) return undefined;
  return getSetting(getDb(), FLAGS_KEY);
}

export function saveLabFlags(flags: unknown): void {
  if (!__DEV__) return;
  setSetting(getDb(), FLAGS_KEY, flags, now());
}
