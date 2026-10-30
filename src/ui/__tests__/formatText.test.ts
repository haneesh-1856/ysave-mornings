import { formatMinutes } from '../formatMinutes';
import { repeatText } from '../repeatText';

describe('repeatText', () => {
  it('names the common patterns', () => {
    expect(repeatText(0b1111111)).toBe('Every day');
    expect(repeatText(0b0011111)).toBe('Weekdays');
    expect(repeatText(0b1100000)).toBe('Weekends');
    expect(repeatText(0)).toBe('No repeat days');
  });
  it('lists other days Monday first', () => {
    expect(repeatText(0b0010101)).toBe('Mon Wed Fri');
    expect(repeatText(0b1000001)).toBe('Mon Sun');
    expect(repeatText(0b0000010)).toBe('Tue');
  });
});

describe('formatMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(270)).toBe('4h 30m');
  });
  it('clamps negatives and rounds', () => {
    expect(formatMinutes(-5)).toBe('0m');
    expect(formatMinutes(44.6)).toBe('45m');
  });
});
