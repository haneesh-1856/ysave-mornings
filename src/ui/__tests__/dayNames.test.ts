import { shortWeekday, weekdayName, weekdayPlural } from '../dayNames';

describe('dayNames (en-US)', () => {
  it('names a Friday', () => {
    expect(weekdayName('2026-10-30', 'en-US')).toBe('Friday');
    expect(weekdayPlural('2026-10-30', 'en-US')).toBe('Fridays');
    expect(shortWeekday('2026-10-30', 'en-US')).toBe('Fri');
  });

  it('does not shift across UTC boundaries or month/year edges', () => {
    expect(weekdayName('2026-01-01', 'en-US')).toBe('Thursday');
    expect(weekdayName('2026-12-31', 'en-US')).toBe('Thursday');
    expect(weekdayName('2026-03-01', 'en-US')).toBe('Sunday');
  });

  it('is right on DST transition days', () => {
    expect(weekdayName('2026-03-08', 'en-US')).toBe('Sunday'); // US spring forward
    expect(weekdayName('2026-11-01', 'en-US')).toBe('Sunday'); // US fall back
    expect(weekdayName('2026-03-29', 'en-US')).toBe('Sunday'); // EU spring forward
  });

  it('works with the default locale', () => {
    expect(weekdayName('2026-10-30')).toBeTruthy();
  });
});
