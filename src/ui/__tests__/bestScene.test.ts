import { formatHM } from '../momentText';
import { BEST_SLOTS, BEST_STILL_AT, bestDraw, camFor, bestHeights, bestLabelAt, bestLabelSizes, bestSceneDraw } from '../moments/bestScene';
import { MOMENT_DUR } from '../moments/timeline';
import { project, type Prim } from '../moments/three';

const MIN = 60_000;
const SIZES = [{ w: 390, h: 844 }, { w: 320, h: 568 }, { w: 1024, h: 768 }];
const times = Array.from({ length: 73 }, (_, i) => Math.round(i * 0.05 * 100) / 100).filter((t) => t <= MOMENT_DUR);

// 13 non-zero days, none above the best (140 min); today 150 min.
const RECENT = [96, 110, 104, 128, 90, 95, 119, 134, 101, 122, 88, 131, 113].map((m) => m * MIN);
const TODAY = 150 * MIN;
const BEST = 140 * MIN;
const dataOf = (recent: number[] = RECENT, today = TODAY, best = BEST) => [...recent, today, best];
const DATA = dataOf();
type Rect = { l: number; r: number; t: number; b: number };

const rgb = (fill: string) => fill.match(/\d+/g)!.map(Number);
const isGoldFill = (p: Prim) => {
  const [r, , b] = rgb(p.fill);
  return r - b > 40;
};
const solids = (ps: Prim[]) => ps.filter((p) => p.fill.startsWith('rgb('));
const ys = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 1));
const xs = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 0));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const finite = (ps: Prim[]) => ps.every((p) => Number.isFinite(p.depth) && p.pts.every(Number.isFinite) && !p.fill.includes('NaN'));
const segs = (ps: Prim[]) => ps.filter((p) => p.segs);
const dashed = (ps: Prim[]) => ps.filter((p) => p.dashed);
const ring = (ps: Prim[]) => ps.filter((p) => p.segs && p.stroke === '#f7d45e');
const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe('bestHeights', () => {
  it('heights are v / top * 4.4 with top = max(today, best) * 1.1, today last, the glass at the previous best', () => {
    const { bars, glass } = bestHeights(RECENT, TODAY, BEST);
    const top = TODAY * 1.1;
    expect(bars).toHaveLength(14);
    RECENT.forEach((v, i) => expect(bars[i]).toBeCloseTo((v / top) * 4.4, 10));
    expect(bars[13]).toBeCloseTo(4, 10);
    expect(glass).toBeCloseTo((BEST / top) * 4.4, 10);
  });

  it('is proportional: a day twice as long is twice as high, and the glass keeps best / today', () => {
    const a = bestHeights([60 * MIN, 120 * MIN], 150 * MIN, 130 * MIN);
    expect(a.bars[1] / a.bars[0]).toBeCloseTo(2, 10);
    expect(a.glass / a.bars[2]).toBeCloseTo(130 / 150, 10);
  });

  it('today is the only column above the glass; the past days are at or under it', () => {
    const { bars, glass } = bestHeights(RECENT, TODAY, BEST);
    expect(bars.filter((h) => h > glass)).toEqual([bars[13]]);
    expect(Math.max(...bars.slice(0, 13))).toBeLessThanOrEqual(glass);
  });

  it('a zero (or bad) day is 0 high, never a stub; nothing is NaN', () => {
    const { bars } = bestHeights([0, -5, NaN, Infinity, 60 * MIN], TODAY, BEST);
    expect(bars.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(bars[4]).toBeGreaterThan(0);
    expect(bestHeights([], 0, 0)).toEqual({ bars: [0], glass: 0 });
  });
});

describe('bestDraw', () => {
  it('draws the same scene for the same input (a fresh array each call)', () => {
    const a = bestDraw(2, SIZES[0], DATA);
    const b = bestDraw(2, SIZES[0], DATA);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('draws no column for no data, and nothing is NaN', () => {
    expect(solids(bestDraw(2, SIZES[0], []))).toEqual([]);
    expect(finite(bestDraw(2, SIZES[0], []))).toBe(true);
  });

  it('only today is gold, and it is the rightmost and nearest column', () => {
    const s = solids(bestDraw(BEST_STILL_AT, SIZES[0], DATA));
    const gold = s.filter(isGoldFill);
    const rest = s.filter((p) => !isGoldFill(p));
    expect(gold.length).toBeGreaterThanOrEqual(3);
    expect(gold.length).toBeLessThanOrEqual(6); // under and above the glass
    expect(rest.length).toBeGreaterThanOrEqual(13 * 2);
    expect(rest.length).toBeLessThanOrEqual(13 * 3);
    // identified by position: the gold faces are the rightmost and the lowest on screen (the nearest column)
    expect(Math.max(...ys(gold))).toBeGreaterThan(Math.max(...ys(rest)));
    expect(mean(xs(gold))).toBeGreaterThan(mean(xs(rest)));
    expect(Math.max(...xs(gold))).toBeGreaterThanOrEqual(Math.max(...xs(rest)) - 1e-9);
    // before today's column starts rising it is not drawn at all
    expect(solids(bestDraw(0.85, SIZES[0], DATA)).some(isGoldFill)).toBe(false);
  });

  it('a zero day has no column (no stub: the faces of a whole column are missing)', () => {
    const full = solids(bestDraw(BEST_STILL_AT, SIZES[0], DATA)).filter((p) => !isGoldFill(p)).length;
    const gap = RECENT.map((v, i) => (i === 4 ? 0 : v));
    const withGap = solids(bestDraw(BEST_STILL_AT, SIZES[0], dataOf(gap))).filter((p) => !isGoldFill(p)).length;
    expect(full - withGap).toBeGreaterThanOrEqual(2);
    expect(full - withGap).toBeLessThanOrEqual(3);
    const allZero = solids(bestDraw(BEST_STILL_AT, SIZES[0], dataOf(RECENT.map(() => 0)))).filter((p) => !isGoldFill(p));
    expect(allZero).toEqual([]);
  });

  it('the glass sits at the previous best: a higher best lifts it', () => {
    const glassY = (best: number) => {
      const edge = dashed(bestDraw(BEST_STILL_AT, SIZES[0], dataOf(RECENT.map((v) => Math.min(v, best)), TODAY, best)));
      expect(edge).toHaveLength(1);
      expect(edge[0].segs).toBe(true);
      return mean(ys(edge));
    };
    const [a, b, c] = [70 * MIN, 105 * MIN, 140 * MIN].map(glassY);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('the glass edge is drawn at the glass height: its corner projects where the scene camera puts [x, glass, z]', () => {
    for (const best of [20 * MIN, 140 * MIN]) {
      const d = dataOf(RECENT.map((v) => Math.min(v, best)), TODAY, best);
      const { glass } = bestHeights(d.slice(0, 13), TODAY, best);
      const cam = camFor(BEST_STILL_AT, SIZES[0]);
      const edge = dashed(bestDraw(BEST_STILL_AT, SIZES[0], d))[0];
      const back = project(cam, [-7.6, glass, -2.2]);
      const front = project(cam, [-7.6, glass, 2.2]);
      expect(edge.pts[0]).toBeCloseTo(back[0], 1);
      expect(edge.pts[1]).toBeCloseTo(back[1], 1);
      expect(edge.pts[4]).toBeCloseTo(front[0], 1);
      expect(edge.pts[5]).toBeCloseTo(front[1], 1);
    }
  });

  it('a small best (20 min against 150) leaves the glass behind the part of the gold column above it', () => {
    const d = dataOf(RECENT.map((v) => Math.min(v, 20 * MIN)), TODAY, 20 * MIN);
    for (const t of [1.5, 2, BEST_STILL_AT]) {
      const ps = bestDraw(t, SIZES[0], d);
      const edge = dashed(ps)[0];
      const glass = ps.find((p) => p.fill === '#f2f3f5' && p.fillOpacity === 0.05)!;
      const above = solids(ps).filter(isGoldFill).filter((p) => mean(ys([p])) < mean(ys([edge])));
      expect(above.length).toBeGreaterThan(0);
      for (const g of above) {
        expect(glass.depth).toBeGreaterThan(g.depth);
        expect(edge.depth).toBeGreaterThan(g.depth);
      }
    }
  });

  it('a past day equal to the best does not break through the glass (and does not throw)', () => {
    const eq = RECENT.map((v, i) => (i === 7 ? BEST : v));
    const near = RECENT.map((v, i) => (i === 7 ? BEST - 1 : v));
    const a = solids(bestDraw(BEST_STILL_AT, SIZES[0], dataOf(eq)));
    const b = solids(bestDraw(BEST_STILL_AT, SIZES[0], dataOf(near)));
    expect(a.length).toBe(b.length);
    expect(finite(bestDraw(2, SIZES[0], dataOf(eq)))).toBe(true);
  });

  it('the floor grid, the glass edges and the ring are one segment prim each', () => {
    expect(segs(bestDraw(BEST_STILL_AT, SIZES[0], DATA))).toHaveLength(2); // grid + glass edges: the ring has faded
    expect(ring(bestDraw(BEST_STILL_AT, SIZES[0], DATA))).toHaveLength(0);
    expect(segs(bestDraw(0.2, SIZES[0], DATA))).toHaveLength(1); // only the grid so far
    const mid = bestDraw(2.2, SIZES[0], DATA);
    expect(ring(mid)).toHaveLength(1);
    expect(segs(mid)).toHaveLength(3);
    expect(ring(mid)[0].pts.length).toBeGreaterThan(100);
  });

  it('the ring has finished before BEST_STILL_AT, even when today barely beats the best', () => {
    for (const best of [140 * MIN, 149 * MIN, 100 * MIN]) {
      const d = dataOf(RECENT.map((v) => Math.min(v, best)), TODAY, best);
      for (let t = 2.65; t <= BEST_STILL_AT + 1e-9; t += 0.05) expect(ring(bestDraw(t, SIZES[0], d))).toEqual([]);
    }
    expect(times.some((t) => ring(bestDraw(t, SIZES[0], DATA)).length > 0)).toBe(true);
  });

  it('never exceeds the slot budget, and never produces NaN, at any frame with 13 non-zero days', () => {
    let worst = 0;
    const close = dataOf(RECENT.map((v) => Math.min(v, 149 * MIN)), TODAY, 149 * MIN);
    for (const size of SIZES) {
      for (const t of times) {
        for (const d of [DATA, close]) {
          const ps = bestDraw(t, size, d);
          worst = Math.max(worst, ps.length);
          expect(ps.length).toBeLessThanOrEqual(BEST_SLOTS);
          if (!finite(ps)) throw new Error(`non-finite prim: ${size.w} t=${t}`);
        }
      }
    }
    expect(worst).toBeGreaterThan(40);
    expect(BEST_SLOTS - worst).toBeLessThanOrEqual(1);
  });

  it('stays on screen at every frame, above the headline, and fills the middle of the screen at rest', () => {
    for (const size of SIZES) {
      for (const t of times) {
        const ps = bestDraw(t, size, DATA);
        expect(Math.min(...xs(ps))).toBeGreaterThan(0);
        expect(Math.max(...xs(ps))).toBeLessThan(size.w);
        expect(Math.min(...ys(ps))).toBeGreaterThan(size.h * 0.16);
        expect(Math.max(...ys(ps))).toBeLessThan(size.h * 0.68);
        expect(Math.max(...ys(solids(ps)))).toBeLessThan(size.h * 0.66);
      }
      const rest = bestDraw(BEST_STILL_AT, size, DATA);
      const portrait = size.w < size.h;
      expect((Math.max(...ys(rest)) - Math.min(...ys(rest))) / size.h).toBeGreaterThanOrEqual(portrait ? 0.22 : 0.3);
      expect((Math.max(...xs(rest)) - Math.min(...xs(rest))) / size.w).toBeGreaterThan(portrait ? 0.8 : 0.3);
    }
  });

  it('is frozen from the point the camera stops: later frames equal the still frame', () => {
    expect(bestSceneDraw(3.6, DATA, SIZES[0])).toEqual(bestSceneDraw(BEST_STILL_AT, DATA, SIZES[0]));
    expect(bestSceneDraw(BEST_STILL_AT, DATA, SIZES[0])).toEqual(bestDraw(BEST_STILL_AT, SIZES[0], DATA));
    expect(bestDraw(2.0, SIZES[0], DATA)).not.toEqual(bestDraw(2.4, SIZES[0], DATA)); // it does move before that
    expect(bestDraw(2.7, SIZES[0], DATA)).not.toEqual(bestDraw(BEST_STILL_AT, SIZES[0], DATA)); // and is still easing a moment before
  });
});

describe('best labels', () => {
  const labelsAt = (lt: number, size: { w: number; h: number }) => [0, 1, 2].map((w) => bestLabelAt(lt, [w, TODAY, BEST], size));
  const texts = [`BEST ${formatHM(BEST)}`, formatHM(TODAY), `+${formatHM(TODAY - BEST)}`];
  const rectsAt = (size: { w: number; h: number }, lt: number): Rect[] => {
    const f = bestLabelSizes(size);
    const fs = [f.best, f.today, f.delta];
    return labelsAt(lt, size).map(([x, y], i) => {
      const w = texts[i].length * fs[i] * 0.62;
      return { l: i === 0 ? x : x - w / 2, r: i === 0 ? x + w : x + w / 2, t: y - fs[i] * 0.7, b: y + fs[i] * 0.7 };
    });
  };

  it('the texts are the moment values (BEST on the glass, today white, the gain yellow)', () => {
    expect(texts).toEqual(['BEST 2:20', '2:30', '+0:10']);
    expect(labelsAt(BEST_STILL_AT, SIZES[0]).map((l) => l[3])).toEqual(['#8b9099', '#f2f3f5', '#f7d45e']);
  });

  it('is finite, hidden at the start, fully visible at rest', () => {
    for (const size of SIZES) {
      for (const l of labelsAt(0, size)) expect(l[2]).toBe(0);
      for (const l of labelsAt(BEST_STILL_AT, size)) {
        expect(l[2]).toBe(1);
        expect(Number.isFinite(l[0]) && Number.isFinite(l[1])).toBe(true);
      }
    }
  });

  it('stays inside the screen margins and above the headline at every frame and size', () => {
    for (const size of SIZES) {
      for (const t of times) {
        for (const r of rectsAt(size, t)) {
          expect(r.l).toBeGreaterThanOrEqual(size.w * 0.07 - 1e-6);
          expect(r.r).toBeLessThanOrEqual(size.w * 0.93 + 1e-6);
          expect(r.t).toBeGreaterThanOrEqual(0);
          expect(r.b).toBeLessThanOrEqual(size.h * 0.69);
        }
      }
    }
  });

  it('do not overlap each other or any column, at rest and while the camera settles', () => {
    for (const size of SIZES) {
      for (const t of [2.3, 2.5, BEST_STILL_AT]) {
        const rs = rectsAt(size, t);
        expect(hit(rs[0], rs[1])).toBe(false);
        expect(hit(rs[0], rs[2])).toBe(false);
        expect(hit(rs[1], rs[2])).toBe(false);
        for (const p of solids(bestDraw(t, size, DATA))) {
          const box = { l: Math.min(...xs([p])), r: Math.max(...xs([p])), t: Math.min(...ys([p])), b: Math.max(...ys([p])) };
          for (const r of rs) expect(hit(r, box)).toBe(false);
        }
      }
    }
  });

  it("today's labels stack above its column: the yellow over the gold top, the white over the yellow, both near it", () => {
    for (const size of SIZES) {
      const gold = solids(bestDraw(BEST_STILL_AT, size, DATA)).filter(isGoldFill);
      const [, white, yellow] = labelsAt(BEST_STILL_AT, size);
      expect(yellow[1]).toBeLessThan(Math.min(...ys(gold)));
      expect(white[1]).toBeLessThan(yellow[1]);
      expect(Math.abs(yellow[0] - mean(xs(gold)))).toBeLessThan(size.w * 0.1);
    }
  });

  it('the BEST label sits at the glass: just above its far-left corner', () => {
    const size = SIZES[0];
    const edge = dashed(bestDraw(BEST_STILL_AT, size, DATA))[0];
    const [x, y] = labelsAt(BEST_STILL_AT, size)[0];
    expect(y).toBeLessThan(Math.min(...ys([edge])) + size.h * 0.06);
    expect(y).toBeGreaterThan(Math.min(...ys([edge])) - size.h * 0.06);
    expect(Math.abs(x - Math.min(...xs([edge])))).toBeLessThan(size.w * 0.1);
  });

  it('is identical from the still time on', () => {
    for (const size of SIZES) expect(labelsAt(3.6, size)).toEqual(labelsAt(BEST_STILL_AT, size));
  });
});
