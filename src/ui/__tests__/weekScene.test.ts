import { MOMENT_DUR } from '../moments/timeline';
import type { Prim } from '../moments/three';
import { WEEK_SLOTS, WEEK_STILL_AT, weekDraw, weekSceneDraw, weekLetterAt, wedgeHeights } from '../moments/weekScene';

const SIZES = [{ w: 390, h: 844 }, { w: 320, h: 568 }, { w: 1024, h: 768 }];
const MIN = 60_000;
const WEEKS: Record<string, number[]> = {
  zeros: [0, 0, 0, 0, 0, 0, 0],
  oneHuge: [0, 0, 0, 0, 0, 0, 1e12],
  typical: [90 * MIN, 0, 45 * MIN, 120 * MIN, 30 * MIN, 0, 60 * MIN],
  bad: [NaN, -5, Infinity, 1, 2, 3, 4],
};
const times = Array.from({ length: 73 }, (_, i) => Math.round(i * 0.05 * 100) / 100).filter((t) => t <= MOMENT_DUR);

const rgb = (fill: string) => fill.match(/\d+/g)!.map(Number);
/** Gold shading has red above blue by a wide margin; graphite has blue above red. */
const isGoldFill = (p: Prim) => {
  const [r, , b] = rgb(p.fill);
  return r - b > 40;
};
const solids = (ps: Prim[]) => ps.filter((p) => p.fill.startsWith('rgb('));
const lines = (ps: Prim[]) => ps.filter((p) => p.segs);
const finite = (ps: Prim[]) => ps.every((p) => Number.isFinite(p.depth) && p.pts.every(Number.isFinite) && !p.fill.includes('NaN'));

describe('wedgeHeights', () => {
  it('is 0.2 + 1.5 * day / max, proportional to the real focus', () => {
    const h = wedgeHeights([0, 30 * MIN, 60 * MIN, 0, 15 * MIN, 0, 60 * MIN]);
    expect(h[2]).toBeCloseTo(1.7);
    expect(h[6]).toBeCloseTo(1.7);
    expect(h[1]).toBeCloseTo(0.2 + 0.75);
    expect(h[4]).toBeCloseTo(0.2 + 0.375);
  });

  it('a day with no focus is the minimum 0.2, never invented', () => {
    const h = wedgeHeights([0, 0, 60 * MIN, 0, 0, 0, 0]);
    expect([h[0], h[1], h[3], h[4], h[5], h[6]]).toEqual([0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  });

  it('an all-zero week is all minimum with no NaN', () => {
    expect(wedgeHeights([0, 0, 0, 0, 0, 0, 0])).toEqual([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  });

  it('treats NaN, negative and infinite values as no focus', () => {
    const h = wedgeHeights([NaN, -5, Infinity, 100, 0, 0, 0]);
    expect(h.every(Number.isFinite)).toBe(true);
    expect(h.slice(0, 3)).toEqual([0.2, 0.2, 0.2]);
    expect(h[3]).toBeCloseTo(1.7);
  });
});

describe('weekDraw', () => {
  it('draws the same dial for the same input (a fresh array each call)', () => {
    const a = weekDraw(2, SIZES[0], WEEKS.typical);
    const b = weekDraw(2, SIZES[0], WEEKS.typical);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('Sunday is graphite before the lock at 1.5 s and gold from it', () => {
    for (const t of [0.5, 1.0, 1.45]) expect(solids(weekDraw(t, SIZES[0], WEEKS.typical)).some(isGoldFill)).toBe(false);
    for (const t of [1.5, 2.0, MOMENT_DUR]) expect(solids(weekDraw(t, SIZES[0], WEEKS.typical)).some(isGoldFill)).toBe(true);
  });

  it("the gold prims after the lock are Sunday's wedge, at the front centre, and other wedges are graphite", () => {
    const size = SIZES[0];
    const s = solids(weekDraw(MOMENT_DUR, size, WEEKS.typical));
    const gold = s.filter(isGoldFill);
    expect(gold.length).toBeGreaterThan(0);
    const cx = (p: Prim) => p.pts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (p.pts.length / 2);
    // Sunday locks at the front (screen centre), about +-1.3 scene units wide; the other wedges stand further out.
    for (const p of gold) expect(Math.abs(cx(p) - size.w / 2)).toBeLessThan(size.w * 0.2);
    expect(s.filter((p) => !isGoldFill(p)).some((p) => Math.abs(cx(p) - size.w / 2) > size.w * 0.2)).toBe(true);
  });

  it("a wedge is drawn as tall as its day: Saturday's top rises with its focus, a zero day stays a stub", () => {
    const size = SIZES[0];
    const topOf = (sat: number) => {
      const week = [0, 0, 0, 0, 0, sat * MIN, 120 * MIN];
      // front left of the dial (nearer than its centre, camera distance 10.5): Saturday; Friday is behind it
      const left = solids(weekDraw(MOMENT_DUR, size, week)).filter((p) => {
        const x = p.pts.filter((_, i) => i % 2 === 0);
        return p.depth < 10.5 && x.reduce((a, b) => a + b, 0) / x.length < size.w / 2 - size.w * 0.1;
      });
      return Math.min(...left.flatMap((p) => p.pts.filter((_, i) => i % 2 === 1)));
    };
    const [stub, half, full] = [topOf(0), topOf(60), topOf(120)];
    expect(half).toBeLessThan(stub - 5);
    expect(full).toBeLessThan(half - 5);
  });

  it('the index lights at the lock', () => {
    const idx = (t: number) => weekDraw(t, SIZES[0], WEEKS.typical).find((p) => p.pts.length === 6);
    expect(idx(1.0)?.fill).toBe('#8b9099');
    expect(idx(2.0)?.fill).toBe('#f7d45e');
  });

  it('never exceeds the slot budget, and never produces NaN, for any time, size and week', () => {
    let worst = 0;
    for (const size of SIZES) {
      for (const [name, week] of Object.entries(WEEKS)) {
        for (const t of times) {
          const ps = weekDraw(t, size, week);
          worst = Math.max(worst, ps.length);
          expect(ps.length).toBeLessThanOrEqual(WEEK_SLOTS);
          if (!finite(ps)) throw new Error(`non-finite prim: ${name} t=${t}`);
        }
      }
    }
    expect(worst).toBeGreaterThan(20); // measured 49 of 56
  });

  it('copes with a short or empty daily list', () => {
    expect(finite(weekDraw(MOMENT_DUR, SIZES[0], []))).toBe(true);
    expect(finite(weekDraw(MOMENT_DUR, SIZES[0], [MIN, MIN]))).toBe(true);
  });
});

describe('weekDraw lines', () => {
  it('draws the ring as 2 prims and the 70 ticks as 4, all open segment prims', () => {
    const ps = weekDraw(MOMENT_DUR, SIZES[0], WEEKS.typical);
    expect(lines(ps)).toHaveLength(6);
    expect(lines(ps).every((p) => p.fill === 'none')).toBe(true);
    // 2 rings x 32 pairs + 70 ticks, 4 numbers per pair
    expect(lines(ps).reduce((a, p) => a + p.pts.length / 4, 0)).toBe(64 + 70);
  });

  it('is frozen from the point the dial stops: later frames equal the still frame', () => {
    expect(weekSceneDraw(3.6, WEEKS.typical, SIZES[0])).toEqual(weekSceneDraw(WEEK_STILL_AT, WEEKS.typical, SIZES[0]));
    expect(weekSceneDraw(WEEK_STILL_AT, WEEKS.typical, SIZES[0])).toEqual(weekDraw(WEEK_STILL_AT, SIZES[0], WEEKS.typical));
  });
});

describe('weekLetterAt', () => {
  it('is finite, hidden at the start, visible later, and Sunday turns yellow at the lock', () => {
    const size = SIZES[0];
    for (let i = 0; i < 7; i++) {
      const [x, y] = weekLetterAt(MOMENT_DUR, i, size);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(weekLetterAt(0, i, size)[2]).toBe(0);
      expect(weekLetterAt(1, i, size)[2]).toBe(1);
    }
    expect(weekLetterAt(1.4, 6, size)[3]).toBe('#8b9099');
    expect(weekLetterAt(1.5, 6, size)[3]).toBe('#f7d45e');
    expect(weekLetterAt(2, 0, size)[3]).toBe('#8b9099');
  });
});
