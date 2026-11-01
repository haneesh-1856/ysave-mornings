import { eq } from 'drizzle-orm';
import { isDayKey } from '../../domain/dayKey';
import { DEFAULT_MARKERS, type MomentMarkers } from '../../domain/moments';
import { DEFAULT_DAY_START_HOUR, type Epoch } from '../../domain/types';
import { ValidationError } from '../errors';
import { settings } from '../schema';
import type { DB } from '../types';

const DAY_START_KEY = 'dayStartHour';

/**
 * JSON value stored under `key`, or undefined when absent / unparsable. Returns `unknown`: callers
 * validate (e.g. theme normalizeLook). Known keys: look, sounds, onboardedAt.
 */
export function getSetting(db: DB, key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row || row.value === null) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

/** Upserts a JSON-encoded value. */
export function setSetting(db: DB, key: string, value: unknown, now: Epoch): void {
  const json = JSON.stringify(value === undefined ? null : value);
  db.insert(settings)
    .values({ key, value: json, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: now } })
    .run();
}

/** Default (4) when absent or corrupt. */
export function getDayStartHour(db: DB): number {
  const v = getSetting(db, DAY_START_KEY);
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : DEFAULT_DAY_START_HOUR;
}

export function setDayStartHour(db: DB, hour: number, now: Epoch): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ValidationError('dayStartHour', 'dayStartHour must be an integer 0-23');
  }
  setSetting(db, DAY_START_KEY, hour, now);
}

const GOAL_KEY = 'monthlyGoalHours';
const ENABLED_KEY = 'momentsEnabled';
const MARKERS_KEY = 'momentMarkers';

/** Monthly focus goal in hours (integer 1..744), or null (none, also when absent or corrupt). */
export function getMonthlyGoalHours(db: DB): number | null {
  const v = getSetting(db, GOAL_KEY);
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 744 ? v : null;
}

export function setMonthlyGoalHours(db: DB, hours: number | null, now: Epoch): void {
  if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 744)) {
    throw new ValidationError('monthlyGoalHours', 'monthlyGoalHours must be an integer 1-744, or null');
  }
  setSetting(db, GOAL_KEY, hours, now);
}

/** Moments at close are on unless the user turned them off (default true; anything but false reads as on). */
export function getMomentsEnabled(db: DB): boolean {
  return getSetting(db, ENABLED_KEY) !== false;
}

export function setMomentsEnabled(db: DB, enabled: boolean, now: Epoch): void {
  if (typeof enabled !== 'boolean') throw new ValidationError('momentsEnabled', 'momentsEnabled must be true or false');
  setSetting(db, ENABLED_KEY, enabled, now);
}

const isKey = (v: unknown): v is string => typeof v === 'string' && isDayKey(v);

/** The celebrated-so-far markers; each field falls back to its default when absent or invalid. */
export function getMomentMarkers(db: DB): MomentMarkers {
  const v = getSetting(db, MARKERS_KEY);
  if (typeof v !== 'object' || v === null) return { ...DEFAULT_MARKERS };
  const o = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  return {
    bestMs: num(o.bestMs),
    streakCelebrated: Math.floor(num(o.streakCelebrated)),
    streakEndDayKey: isKey(o.streakEndDayKey) ? o.streakEndDayKey : null,
    weekCelebrated: isKey(o.weekCelebrated) ? o.weekCelebrated : null,
    monthCelebrated:
      typeof o.monthCelebrated === 'string' && /^\d{4}-\d{2}$/.test(o.monthCelebrated) ? o.monthCelebrated : null,
  };
}

export function setMomentMarkers(db: DB, markers: MomentMarkers, now: Epoch): void {
  setSetting(db, MARKERS_KEY, markers, now);
}
