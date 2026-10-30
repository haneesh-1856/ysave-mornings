import { extraText, minutesLeftText } from '../timeText';

describe('timeText', () => {
  it('rounds minutes left up at exact boundaries', () => {
    expect(minutesLeftText(12 * 60_000)).toBe('12 min left');
    expect(minutesLeftText(12 * 60_000 - 1)).toBe('12 min left');
    expect(minutesLeftText(11 * 60_000 + 1)).toBe('12 min left');
    expect(minutesLeftText(11 * 60_000)).toBe('11 min left');
    expect(minutesLeftText(1)).toBe('1 min left');
    expect(minutesLeftText(0)).toBe('0 min left');
    expect(minutesLeftText(-5000)).toBe('0 min left');
  });
  it('rounds extra minutes down at exact boundaries', () => {
    expect(extraText(0)).toBe('+0 min extra');
    expect(extraText(59_999)).toBe('+0 min extra');
    expect(extraText(60_000)).toBe('+1 min extra');
    expect(extraText(3 * 60_000 + 59_999)).toBe('+3 min extra');
    expect(extraText(-1)).toBe('+0 min extra');
  });
});
