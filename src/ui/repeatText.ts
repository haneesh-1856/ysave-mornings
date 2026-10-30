const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ALL = 0b1111111;
const WEEKDAYS = 0b0011111;
const WEEKENDS = 0b1100000;

/** Plain-words summary of a repeat mask (bit 0 = Monday ... bit 6 = Sunday). */
export function repeatText(mask: number): string {
  const m = mask & ALL;
  if (m === 0) return 'No repeat days';
  if (m === ALL) return 'Every day';
  if (m === WEEKDAYS) return 'Weekdays';
  if (m === WEEKENDS) return 'Weekends';
  return DAYS.filter((_, i) => (m & (1 << i)) !== 0).join(' ');
}
