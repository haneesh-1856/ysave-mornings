import { endOf, INTRO, MOMENT_DUR, markAt, OUTRO, phaseAt, rayAt, seg, totalOf } from '../moments/timeline';

describe('moments timeline', () => {
  it('lasts intro + moments + outro', () => {
    expect(endOf(2)).toBeCloseTo(INTRO + 2 * MOMENT_DUR);
    expect(totalOf(2)).toBeCloseTo(INTRO + 2 * MOMENT_DUR + OUTRO);
  });

  it('seg clamps', () => {
    expect([seg(-1, 0, 2), seg(1, 0, 2), seg(5, 0, 2)]).toEqual([0, 0.5, 1]);
  });

  it('finds the moment and the time into it, clamped to the last one', () => {
    expect(phaseAt(0, 2)).toEqual({ index: 0, local: 0 });
    expect(phaseAt(INTRO + 1, 2)).toEqual({ index: 0, local: 1 });
    const second = phaseAt(INTRO + MOMENT_DUR + 0.5, 2);
    expect(second.index).toBe(1);
    expect(second.local).toBeCloseTo(0.5);
    expect(phaseAt(1000, 2)).toEqual({ index: 1, local: MOMENT_DUR });
  });

  it('draws the ring, then flies through, then pulls back and closes it when the day is finished', () => {
    expect(markAt(0, 1, false, 10)).toMatchObject({ ring: 0, zoom: 1, alpha: 1, windowOpen: false });
    expect(markAt(INTRO, 1, false, 10)).toMatchObject({ zoom: 10, alpha: 0, windowOpen: true });
    const end = endOf(1);
    expect(markAt(end + 1, 1, false, 10)).toMatchObject({ zoom: 1, windowOpen: false });
    expect(markAt(end + 2, 1, false, 10)).toMatchObject({ close: 1, alpha: 1 });
  });

  it('the quiet ending dims the mark and never closes the ring', () => {
    const m = markAt(endOf(1) + 2, 1, true, 10);
    expect(m.close).toBe(0);
    expect(m.alpha).toBe(0.5);
  });

  it('rays extend one after another', () => {
    expect(rayAt(0.3, 0)).toBe(0);
    expect(rayAt(0.5, 0)).toBeGreaterThan(rayAt(0.5, 5));
    expect(rayAt(2, 5)).toBe(1);
  });
});
