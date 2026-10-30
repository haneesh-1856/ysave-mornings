import { addMonths, monthGrid, monthKeyOf } from '../calendar';

describe('monthKeyOf / addMonths', () => {
  it('monthKeyOf takes the YYYY-MM prefix', () => {
    expect(monthKeyOf('2026-10-29')).toBe('2026-10');
    expect(monthKeyOf('2024-02-29')).toBe('2024-02');
  });

  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', 0, '2026-10'],
    ['2026-10', 14, '2027-12'],
    ['2026-10', -10, '2025-12'],
    ['2026-03', -12, '2025-03'],
    ['2026-01', -13, '2024-12'],
  ])('addMonths(%s, %i) = %s', (m, n, want) => {
    expect(addMonths(m, n)).toBe(want);
  });
});

describe('monthGrid', () => {
  it.each([
    ['2026-06', 5, 30], // starts Monday
    ['2027-02', 4, 28], // non-leap Feb starting Monday: exactly 4 rows
    ['2026-02', 5, 28], // non-leap Feb starting Sunday
    ['2024-02', 5, 29], // leap Feb starting Thursday
    ['2026-03', 6, 31], // starts Sunday, 31 days: 6 rows
    ['2026-10', 5, 31], // starts Thursday
  ])('%s has %i rows and %i days', (m, rows, days) => {
    const weeks = monthGrid(m);
    const flat = weeks.flat().filter((d): d is string => d !== null);
    expect(weeks).toHaveLength(rows);
    expect(flat).toHaveLength(days);
    expect(flat[0]).toBe(`${m}-01`);
    expect(flat[flat.length - 1]).toBe(`${m}-${days}`);
    for (const w of weeks) expect(w).toHaveLength(7);
  });

  it('a month starting Monday has no leading blanks; trailing blanks pad the last week', () => {
    const w = monthGrid('2026-06');
    expect(w[0][0]).toBe('2026-06-01');
    expect(w[4]).toEqual(['2026-06-29', '2026-06-30', null, null, null, null, null]);
  });

  it('a month starting Sunday has six leading blanks', () => {
    const w = monthGrid('2026-03');
    expect(w[0]).toEqual([null, null, null, null, null, null, '2026-03-01']);
    expect(w[5]).toEqual(['2026-03-30', '2026-03-31', null, null, null, null, null]);
  });

  it('Feb has a 29th only in leap years', () => {
    expect(monthGrid('2024-02').flat()).toContain('2024-02-29');
    expect(monthGrid('2026-02').flat()).not.toContain('2026-02-29');
    expect(monthGrid('2026-02')[0][6]).toBe('2026-02-01');
  });

  it('every real day appears once, in order', () => {
    const flat = monthGrid('2026-10').flat().filter((d) => d !== null);
    expect(flat).toEqual(Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`));
  });
});
