import { addDays, compareDayKeys, dayEndOf, dayKeyOf, dayStartOf, isDayKey, repeatsOn, weekdayIndex, weekStartOf } from '../dayKey';

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms).getTime();
const HOUR = 3600_000;

describe('test environment', () => {
  it('runs in a DST timezone', () => {
    expect(process.env.TZ).toBe('America/New_York');
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(240);
  });
});

describe('isDayKey', () => {
  it('accepts real dates, including leap days', () => {
    expect(isDayKey('2026-10-29')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
  });
  it('rejects impossible and malformed dates', () => {
    const bad = [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-1-05',
      '26-01-01',
      '2026-01-01T00',
      '',
      ' 2026-01-01',
    ];
    for (const s of bad) expect(isDayKey(s)).toBe(false);
  });
});

describe('dayKeyOf', () => {
  it('H=4: Tue 02:30 is Monday, Tue 04:00 is Tuesday', () => {
    expect(dayKeyOf(at(2026, 10, 27, 2, 30), 4)).toBe('2026-10-26'); // Tue Oct 27
    expect(dayKeyOf(at(2026, 10, 27, 4, 0), 4)).toBe('2026-10-27');
  });
  it('flips exactly at H:00 and 1 ms before', () => {
    for (const h of [0, 4, 23]) {
      expect(dayKeyOf(at(2026, 10, 27, h) - 1, h)).toBe('2026-10-26');
      expect(dayKeyOf(at(2026, 10, 27, h), h)).toBe('2026-10-27');
    }
  });
  it('H=0 is plain midnight', () => {
    expect(dayKeyOf(at(2026, 10, 27, 0, 0, 0, 1), 0)).toBe('2026-10-27');
    expect(dayKeyOf(at(2026, 10, 27, 23, 59, 59, 999), 0)).toBe('2026-10-27');
  });
  it('H=23: nearly the whole calendar day belongs to the previous key', () => {
    expect(dayKeyOf(at(2026, 10, 27, 12), 23)).toBe('2026-10-26');
    expect(dayKeyOf(at(2026, 10, 27, 23, 30), 23)).toBe('2026-10-27');
    expect(dayKeyOf(at(2026, 10, 28, 22, 59), 23)).toBe('2026-10-27');
  });
  it('rolls over month and year', () => {
    expect(dayKeyOf(at(2026, 1, 1, 3), 4)).toBe('2025-12-31');
    expect(dayKeyOf(at(2026, 3, 1, 1), 4)).toBe('2026-02-28');
  });
  it('rejects an invalid hour or instant', () => {
    for (const h of [-1, 24, 4.5, NaN]) expect(() => dayKeyOf(0, h)).toThrow();
    expect(() => dayKeyOf(NaN, 4)).toThrow();
  });
});

describe('dayStartOf / dayEndOf', () => {
  it('starts at local H:00', () => {
    expect(dayStartOf('2026-10-27', 4)).toBe(at(2026, 10, 27, 4));
    expect(dayStartOf('2026-10-27', 0)).toBe(at(2026, 10, 27));
    expect(dayStartOf('2026-10-27', 23)).toBe(at(2026, 10, 27, 23));
  });
  it('ends at the next day start, across month and year', () => {
    expect(dayEndOf('2026-10-27', 4)).toBe(at(2026, 10, 28, 4));
    expect(dayEndOf('2026-12-31', 4)).toBe(at(2027, 1, 1, 4));
  });
  it('round-trips with dayKeyOf at the boundaries', () => {
    for (const h of [0, 4, 23]) {
      const k = '2026-10-27';
      expect(dayKeyOf(dayStartOf(k, h), h)).toBe(k);
      expect(dayKeyOf(dayEndOf(k, h) - 1, h)).toBe(k);
      expect(dayKeyOf(dayEndOf(k, h), h)).toBe('2026-10-28');
    }
  });
  it('validates input', () => {
    expect(() => dayStartOf('2026-02-30', 4)).toThrow();
    expect(() => dayStartOf('2026-10-27', 24)).toThrow();
    expect(() => dayEndOf('nope', 4)).toThrow();
  });
});

describe('DST (America/New_York 2026: spring forward Mar 8, fall back Nov 1)', () => {
  it('spring-forward calendar day is 23 hours long at H=0', () => {
    expect(dayEndOf('2026-03-08', 0) - dayStartOf('2026-03-08', 0)).toBe(23 * HOUR);
  });
  it('fall-back calendar day is 25 hours long at H=0', () => {
    expect(dayEndOf('2026-11-01', 0) - dayStartOf('2026-11-01', 0)).toBe(25 * HOUR);
  });
  it('H=4 days that contain the shift are 23 / 25 hours', () => {
    expect(dayEndOf('2026-03-07', 4) - dayStartOf('2026-03-07', 4)).toBe(23 * HOUR);
    expect(dayEndOf('2026-10-31', 4) - dayStartOf('2026-10-31', 4)).toBe(25 * HOUR);
  });
  it('H=4 boundary holds on the spring-forward day', () => {
    expect(dayKeyOf(at(2026, 3, 8, 4) - 1, 4)).toBe('2026-03-07');
    expect(dayKeyOf(at(2026, 3, 8, 4), 4)).toBe('2026-03-08');
    expect(dayKeyOf(at(2026, 3, 8, 3, 30), 4)).toBe('2026-03-07'); // 03:30 EDT, just after the gap
  });
  it('H=4 boundary holds on the fall-back day, including the repeated hour', () => {
    const firstOneAm = Date.UTC(2026, 10, 1, 5, 30); // 01:30 EDT
    const secondOneAm = Date.UTC(2026, 10, 1, 6, 30); // 01:30 EST
    expect(dayKeyOf(firstOneAm, 4)).toBe('2026-10-31');
    expect(dayKeyOf(secondOneAm, 4)).toBe('2026-10-31');
    expect(dayKeyOf(at(2026, 11, 1, 4) - 1, 4)).toBe('2026-10-31');
    expect(dayKeyOf(at(2026, 11, 1, 4), 4)).toBe('2026-11-01');
  });
  it('H=2 on spring-forward: the missing 02:00 start still agrees with dayKeyOf', () => {
    const start = dayStartOf('2026-03-08', 2);
    expect(dayKeyOf(start, 2)).toBe('2026-03-08');
    expect(dayKeyOf(start - 1, 2)).toBe('2026-03-07');
  });
  it('addDays steps calendar days across DST', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });
});

describe('addDays', () => {
  it('rolls over months and years in both directions', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-10-29', 0)).toBe('2026-10-29');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
  it('throws on invalid input', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
    expect(() => addDays('2026-01-01', 1.5)).toThrow();
  });
});

describe('weekdayIndex / weekStartOf', () => {
  it('numbers Monday 0 through Sunday 6', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    expect(days.map(weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('weekStartOf: Monday maps to itself, Sunday to the Monday six days earlier', () => {
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
    expect(weekStartOf('2026-10-29')).toBe('2026-10-26');
  });
  it('weekStartOf crosses month and year boundaries', () => {
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28'); // Friday
    expect(weekStartOf('2026-03-01')).toBe('2026-02-23'); // Sunday
  });
  it('throws on an invalid dayKey', () => {
    expect(() => weekdayIndex('2026-02-30')).toThrow();
    expect(() => weekStartOf('x')).toThrow();
  });
});

describe('repeatsOn', () => {
  it('bit 0 is Monday, bit 6 is Sunday', () => {
    expect(repeatsOn(0b0000001, '2026-10-26')).toBe(true); // Mon
    expect(repeatsOn(0b0000001, '2026-10-27')).toBe(false);
    expect(repeatsOn(0b1000000, '2026-11-01')).toBe(true); // Sun
    expect(repeatsOn(0b1000000, '2026-10-26')).toBe(false);
  });
  it('handles empty and full masks', () => {
    for (let i = 0; i < 7; i++) {
      const k = addDays('2026-10-26', i);
      expect(repeatsOn(0, k)).toBe(false);
      expect(repeatsOn(0b1111111, k)).toBe(true);
    }
  });
  it('weekdays mask (Mon-Fri)', () => {
    const mask = 0b0011111;
    expect(repeatsOn(mask, '2026-10-30')).toBe(true); // Fri
    expect(repeatsOn(mask, '2026-10-31')).toBe(false); // Sat
  });
});

describe('compareDayKeys', () => {
  it('orders chronologically', () => {
    expect(compareDayKeys('2026-10-29', '2026-10-30')).toBeLessThan(0);
    expect(compareDayKeys('2026-10-30', '2026-10-29')).toBeGreaterThan(0);
    expect(compareDayKeys('2026-10-29', '2026-10-29')).toBe(0);
    expect(compareDayKeys('2025-12-31', '2026-01-01')).toBeLessThan(0);
  });
  it('throws on invalid keys', () => {
    expect(() => compareDayKeys('2026-02-30', '2026-03-01')).toThrow();
  });
});
