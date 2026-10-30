/** @jest-environment node */
import { DEFAULT_DAY_START_HOUR } from '../../domain/types';
import { ValidationError } from '../errors';
import { getDayStartHour, getSetting, setDayStartHour, setSetting } from '../repos/settings';
import { settings } from '../schema';
import { createTestDb } from './testDb';

describe('settings repo', () => {
  it('dayStartHour defaults to 4 and round-trips 0-23', () => {
    const { db } = createTestDb();
    expect(getDayStartHour(db)).toBe(DEFAULT_DAY_START_HOUR);
    setDayStartHour(db, 0, 1);
    expect(getDayStartHour(db)).toBe(0);
    setDayStartHour(db, 23, 2);
    expect(getDayStartHour(db)).toBe(23);
  });

  it('rejects invalid hours', () => {
    const { db } = createTestDb();
    expect(() => setDayStartHour(db, 24, 1)).toThrow(ValidationError);
    expect(() => setDayStartHour(db, -1, 1)).toThrow(ValidationError);
    expect(() => setDayStartHour(db, 4.5, 1)).toThrow(ValidationError);
    expect(getDayStartHour(db)).toBe(DEFAULT_DAY_START_HOUR);
  });

  it('stores JSON values (object, bool, number, null) and upserts', () => {
    const { db } = createTestDb();
    expect(getSetting(db, 'look')).toBeUndefined();
    setSetting(db, 'look', { a: [1, 2], b: 'x' }, 1);
    expect(getSetting(db, 'look')).toEqual({ a: [1, 2], b: 'x' });
    setSetting(db, 'sounds', false, 2);
    expect(getSetting(db, 'sounds')).toBe(false);
    setSetting(db, 'onboardedAt', 1234, 3);
    setSetting(db, 'onboardedAt', 5678, 4);
    expect(getSetting(db, 'onboardedAt')).toBe(5678);
    setSetting(db, 'onboardedAt', null, 5);
    expect(getSetting(db, 'onboardedAt')).toBeNull();
  });

  it('keeps createdAt on upsert and bumps updatedAt; corrupt JSON reads as undefined', () => {
    const { db } = createTestDb();
    setSetting(db, 'sounds', true, 10);
    setSetting(db, 'sounds', false, 20);
    const row = db.select().from(settings).get();
    expect(row).toMatchObject({ createdAt: 10, updatedAt: 20, value: 'false' });
    db.insert(settings).values({ key: 'bad', value: '{oops', createdAt: 1, updatedAt: 1 }).run();
    expect(getSetting(db, 'bad')).toBeUndefined();
  });

  it('a corrupt dayStartHour falls back to the default', () => {
    const { db } = createTestDb();
    setSetting(db, 'dayStartHour', 'late', 1);
    expect(getDayStartHour(db)).toBe(DEFAULT_DAY_START_HOUR);
  });
});
