import { eq } from 'drizzle-orm';
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
