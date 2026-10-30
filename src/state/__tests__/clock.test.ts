import { now, setClockOverride } from '../clock';

afterEach(() => setClockOverride(null));

describe('clock', () => {
  it('returns real time by default', () => {
    const before = Date.now();
    const t = now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it('uses the override, re-evaluating it each call', () => {
    let t = 1000;
    setClockOverride(() => t);
    expect(now()).toBe(1000);
    t = 2500;
    expect(now()).toBe(2500);
  });

  it('restores real time when the override is cleared', () => {
    setClockOverride(() => 42);
    setClockOverride(null);
    expect(now()).not.toBe(42);
  });
});
