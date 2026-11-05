import {
  MONTH_SLOTS, MONTH_STILL_AT, camFor, monthDraw, monthHeadAt, monthHeights, monthLabelSizes, monthRingAt, monthRingText, monthSceneDraw,
  monthTotalAt, monthTotalText,
} from '../moments/monthScene';
import { MOMENT_DUR } from '../moments/timeline';
import { project, type Prim } from '../moments/three';

const H = 3_600_000;
const HU = 4.4; // the curtain's height at top
const SIZES = [{ w: 390, h: 844 }, { w: 320, h: 568 }, { w: 1024, h: 768 }];
const times = Array.from({ length: 73 }, (_, i) => Math.round(i * 0.05 * 100) / 100).filter((t) => t <= MOMENT_DUR);
type Rect = { l: number; r: number; t: number; b: number };

// A realistic 25-day month: a rest day every sixth day, otherwise 1.3 to 2.6 hours; the goal is the whole hours reached.
const DAYS25 = Array.from({ length: 25 }, (_, i) => (i % 6 === 5 ? 0 : (40 + ((i * 37) % 51)) * 60_000 * 1.9));
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const GOAL = Math.floor(sum(DAYS25) / H);
const FULL31 = Array.from({ length: 31 }, (_, i) => (30 + ((i * 13) % 40)) * 60_000);
const goalData = (daily = DAYS25, goalH = GOAL) => [goalH * H, ...daily];
const reviewData = (daily = FULL31.map((v, i) => (i % 3 === 0 ? 0 : v / 3))) => [-1, ...daily];

const xs = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 0));
const ys = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 1));
const finite = (ps: Prim[]) => ps.every((p) => Number.isFinite(p.depth) && p.pts.every(Number.isFinite) && !p.fill.includes('NaN'));
const segs = (ps: Prim[]) => ps.filter((p) => p.segs);
const faces = (ps: Prim[]) => ps.filter((p) => !p.segs);
const hit = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const topLine = (ps: Prim[]) => ps.find((p) => p.segs && p.strokeWidth === 2)!;
const closedRing = (ps: Prim[]) => ps.filter((p) => p.segs && p.strokeWidth === 3);
const pulses = (ps: Prim[]) => ps.filter((p) => p.segs && p.stroke === '#f7d45e' && p.strokeWidth !== 1 && p.strokeWidth !== 3);

describe('monthHeights', () => {
  it('the curtain is the real cumulative sum, the top is max(goal, total) * 1.08 and the end is the total', () => {
    const total = sum(DAYS25);
    const { curtain, ring, closed } = monthHeights(goalData());
    const top = Math.max(GOAL * H, total) * 1.08;
    expect(curtain).toHaveLength(26);
    expect(curtain[0]).toBe(0);
    let c = 0;
    DAYS25.forEach((v, i) => {
      c += v;
      expect(curtain[i + 1]).toBeCloseTo((c / top) * HU, 10);
    });
    expect(curtain[25]).toBeCloseTo((total / top) * HU, 10);
    expect(ring).toBeCloseTo(((GOAL * H) / top) * HU, 10);
    expect(closed).toBe(true);
  });

  it('a rest day is flat: the curtain does not rise over it', () => {
    const { curtain } = monthHeights(goalData());
    expect(curtain[6]).toBe(curtain[5]);
    expect(curtain[5]).toBeGreaterThan(curtain[4]);
  });

  it('the ring is at the goal and closed only when the total reaches it', () => {
    const exact = monthHeights([10 * H, 4 * H, 6 * H]);
    expect(exact.closed).toBe(true);
    expect(exact.ring).toBeCloseTo(exact.curtain[2], 10);
    const short = monthHeights([10 * H, 4 * H, 6 * H - 1]);
    expect(short.closed).toBe(false);
    expect(short.ring).toBeGreaterThan(short.curtain[2]);
  });

  it('review: the ring is at the total, open, with no goal', () => {
    const r = monthHeights(reviewData());
    expect(r.review).toBe(true);
    expect(r.closed).toBe(false);
    expect(r.ring).toBeCloseTo(r.curtain[31], 10);
    expect(r.curtain[31]).toBeCloseTo(HU / 1.08, 10);
  });

  it('a zero goal is a review (no goal), with the ring at the total', () => {
    const r = monthHeights([0, H]);
    expect(r.review).toBe(true);
    expect(r.closed).toBe(false);
    expect(r.ring).toBeCloseTo(r.curtain[1], 10);
  });

  it('no focus at all stays flat (nothing is NaN)', () => {
    const z = monthHeights([-1, 0, 0, 0]);
    expect(z.curtain).toEqual([0, 0, 0, 0]);
    expect(z.ring).toBe(0);
    expect(monthHeights([])).toEqual({ curtain: [0], ring: 0, closed: false, review: true });
    expect(monthHeights([5 * H, NaN, -3, Infinity, 2 * H]).curtain.every(Number.isFinite)).toBe(true);
  });
});

describe('monthDraw', () => {
  it('draws the same scene for the same input (a fresh array each call)', () => {
    const a = monthDraw(2, SIZES[0], goalData());
    const b = monthDraw(2, SIZES[0], goalData());
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('is finite for a goal with no focus ([5 h, 0, 0]) and for a zero goal ([0, 1 h])', () => {
    for (const d of [[5 * H, 0, 0], [0, H]]) {
      for (const size of SIZES) for (const t of times) expect(finite(monthDraw(t, size, d))).toBe(true);
    }
  });

  it('draws no curtain for no days, and nothing is NaN', () => {
    const ps = monthDraw(2, SIZES[0], [-1]);
    expect(faces(ps)).toEqual([]);
    expect(finite(ps)).toBe(true);
    expect(finite(monthDraw(2, SIZES[0], []))).toBe(true);
  });

  it('a flat month (no focus on any day) draws no curtain face and no rise', () => {
    const ps = monthDraw(MONTH_STILL_AT, SIZES[0], [-1, 0, 0, 0, 0, 0]);
    expect(faces(ps)).toEqual([]);
    expect(finite(ps)).toBe(true);
  });

  it('the curtain top projects at the scene height of the cumulative total, and a zero day adds no rise', () => {
    const data = goalData();
    const { curtain } = monthHeights(data);
    const size = SIZES[0];
    const cam = camFor(MONTH_STILL_AT, size, 25);
    const line = topLine(monthDraw(MONTH_STILL_AT, size, data));
    const at = (i: number, y: number) => {
      const a = (i / 31) * 2 * Math.PI + Math.PI / 2;
      return project(cam, [2.5 * Math.cos(a), y, 2.5 * Math.sin(a)]);
    };
    const n = line.pts.length;
    const end = at(25, curtain[25]);
    expect(line.pts[n - 2]).toBeCloseTo(end[0], 1);
    expect(line.pts[n - 1]).toBeCloseTo(end[1], 1);
    // day 6 (index 5) is a rest day: the segment over it starts and ends at the same scene height
    const s = at(5, curtain[5]);
    const e = at(6, curtain[6]);
    expect(line.pts[5 * 4]).toBeCloseTo(s[0], 1);
    expect(line.pts[5 * 4 + 1]).toBeCloseTo(s[1], 1);
    expect(line.pts[5 * 4 + 2]).toBeCloseTo(e[0], 1);
    expect(line.pts[5 * 4 + 3]).toBeCloseTo(e[1], 1);
    expect(curtain[6]).toBe(curtain[5]);
  });

  it('one prim each for the floor ring, the ticks, the top line, the day marks and the goal ring; faces in groups of 4 days', () => {
    const ps = monthDraw(MONTH_STILL_AT, SIZES[0], goalData());
    expect(segs(ps).filter((p) => p.strokeWidth === 1 && p.stroke === '#f2f3f5')).toHaveLength(2);
    expect(segs(ps).filter((p) => p.strokeWidth === 2)).toHaveLength(1);
    expect(segs(ps).filter((p) => p.stroke === '#f7d45e' && p.strokeWidth === 1)).toHaveLength(1);
    expect(closedRing(ps)).toHaveLength(1);
    expect(faces(ps)).toHaveLength(7);
    expect(ps).toHaveLength(12);
    expect(faces(monthDraw(MONTH_STILL_AT, SIZES[0], goalData(FULL31, 20)))).toHaveLength(8);
  });

  it('the ring closes (solid, yellow) only when the total reaches the goal; before the curtain gets there it is dashed and open', () => {
    expect(closedRing(monthDraw(MONTH_STILL_AT, SIZES[0], goalData()))).toHaveLength(1);
    expect(closedRing(monthDraw(0.5, SIZES[0], goalData()))).toEqual([]);
    expect(monthDraw(0.8, SIZES[0], goalData()).filter((p) => p.dashed)).toHaveLength(1);
    const never = goalData(DAYS25, GOAL + 1);
    for (const t of times) expect(closedRing(monthDraw(t, SIZES[0], never))).toEqual([]);
    expect(monthDraw(MONTH_STILL_AT, SIZES[0], never).filter((p) => p.dashed)).toHaveLength(1);
  });

  it('the opening closes: the closed ring is a full turn, the open one is shorter', () => {
    const open = monthDraw(0.8, SIZES[0], goalData()).find((p) => p.dashed)!;
    const closed = closedRing(monthDraw(MONTH_STILL_AT, SIZES[0], goalData()))[0];
    expect(closed.pts.length).toBe(72 * 4);
    expect(open.pts.length).toBeLessThan(closed.pts.length);
    expect(open.pts.length).toBeGreaterThan(closed.pts.length * 0.7);
  });

  it('review: the ring is solid, white and open to the end', () => {
    const ps = monthDraw(MONTH_STILL_AT, SIZES[0], reviewData());
    const r = ps.filter((p) => p.segs && p.strokeWidth === 1.5);
    expect(r).toHaveLength(1);
    expect(r[0].dashed).toBe(false);
    expect(r[0].stroke).toBe('#f2f3f5');
    expect(r[0].pts.length).toBeLessThan(72 * 4);
    for (const t of times) expect(closedRing(monthDraw(t, SIZES[0], reviewData()))).toEqual([]);
  });

  it('the ring height follows the goal: a higher goal (still met) over the same days lifts it', () => {
    const y = (g: number) => Math.min(...ys(closedRing(monthDraw(MONTH_STILL_AT, SIZES[0], goalData(DAYS25, g)))));
    expect(y(GOAL - 5)).toBeLessThan(y(GOAL - 10));
    expect(y(GOAL)).toBeLessThan(y(GOAL - 5));
  });

  it('a pulse goes out once the ring has closed, and is gone before the camera stops', () => {
    expect(times.some((t) => pulses(monthDraw(t, SIZES[0], goalData())).length === 1)).toBe(true);
    for (let t = 2.8; t <= MONTH_STILL_AT + 1e-9; t += 0.05) expect(pulses(monthDraw(t, SIZES[0], goalData()))).toEqual([]);
    const never = goalData(DAYS25, GOAL + 1);
    for (const t of times) expect(pulses(monthDraw(t, SIZES[0], never))).toEqual([]);
  });

  it('the ring and the pulse have finished before the still time even when the goal is met on the last day', () => {
    const daily = Array.from({ length: 24 }, () => H);
    const d = [24 * H + 1, ...daily, H];
    expect(closedRing(monthDraw(MONTH_STILL_AT, SIZES[0], d))).toHaveLength(1);
    for (let t = 2.8; t <= MONTH_STILL_AT + 1e-9; t += 0.05) expect(pulses(monthDraw(t, SIZES[0], d))).toEqual([]);
    expect(times.some((t) => pulses(monthDraw(t, SIZES[0], d)).length === 1)).toBe(true);
  });

  it('31 ticks per turn whatever the month length', () => {
    for (const n of [28, 30, 31]) {
      const ps = monthDraw(MONTH_STILL_AT, SIZES[0], [-1, ...FULL31.slice(0, n)]);
      const ticks = segs(ps).filter((p) => p.strokeWidth === 1 && p.stroke === '#f2f3f5')[1];
      expect(ticks.pts.length).toBe(31 * 4);
    }
  });

  it('never exceeds the slot budget, never NaN, and MONTH_SLOTS is exactly the worst case (31 non-zero days)', () => {
    let worst = 0;
    for (const size of SIZES) {
      for (const t of times) {
        for (const d of [[-1, ...FULL31], [sum(FULL31) / 2, ...FULL31], [sum(FULL31) + 1, ...FULL31], goalData()]) {
          const ps = monthDraw(t, size, d);
          worst = Math.max(worst, ps.length);
          expect(ps.length).toBeLessThanOrEqual(MONTH_SLOTS);
          if (!finite(ps)) throw new Error(`non-finite prim: ${size.w} t=${t}`);
        }
      }
    }
    expect(worst).toBe(MONTH_SLOTS);
  });

  it('stays on screen at every frame, in the 0.16 h to 0.68 h band, and fills the middle of the screen at rest', () => {
    for (const size of SIZES) {
      for (const t of times) {
        for (const d of [goalData(), reviewData(), [sum(FULL31) / 3, ...FULL31]]) {
          const ps = monthDraw(t, size, d);
          expect(Math.min(...xs(ps))).toBeGreaterThan(0);
          expect(Math.max(...xs(ps))).toBeLessThan(size.w);
          expect(Math.min(...ys(ps))).toBeGreaterThan(size.h * 0.16);
          expect(Math.max(...ys(ps))).toBeLessThan(size.h * 0.68);
        }
      }
      const rest = monthDraw(MONTH_STILL_AT, size, goalData());
      const portrait = size.w < size.h;
      expect((Math.max(...ys(rest)) - Math.min(...ys(rest))) / size.h).toBeGreaterThanOrEqual(portrait ? 0.2 : 0.3);
      expect((Math.max(...xs(rest)) - Math.min(...xs(rest))) / size.w).toBeGreaterThan(portrait ? 0.7 : 0.2);
    }
  });

  it('is frozen from the point the camera stops: later frames equal the still frame', () => {
    const d = goalData();
    expect(monthSceneDraw(3.6, d, SIZES[0])).toEqual(monthSceneDraw(MONTH_STILL_AT, d, SIZES[0]));
    expect(monthSceneDraw(MONTH_STILL_AT, d, SIZES[0])).toEqual(monthDraw(MONTH_STILL_AT, SIZES[0], d));
    expect(monthDraw(2.0, SIZES[0], d)).not.toEqual(monthDraw(2.4, SIZES[0], d));
    expect(monthDraw(2.85, SIZES[0], d)).not.toEqual(monthDraw(MONTH_STILL_AT, SIZES[0], d));
  });
});

describe('month labels', () => {
  const rects = (size: { w: number; h: number }, t: number, d: number[]): { head: Rect; ring: Rect } => {
    const f = monthLabelSizes(size);
    const [hx, hy] = monthHeadAt(t, d, size);
    const [rx, ry] = monthRingAt(t, d, size);
    const hw = monthTotalText(sum(d.slice(1))).length * f.total * 0.62;
    const rw = monthRingText(d).length * f.ring * 0.62;
    return {
      head: { l: hx - hw, r: hx, t: hy - f.total * 0.7, b: hy + f.total * 0.7 },
      ring: { l: rx, r: rx + rw, t: ry - f.ring * 0.7, b: ry + f.ring * 0.7 },
    };
  };

  it('exact texts: X.X H running total (the end equals the month total to one decimal), GOAL N H, X.X H THIS MONTH', () => {
    const d = goalData();
    const rv = reviewData();
    expect(monthRingText(d)).toBe(`GOAL ${GOAL} H`);
    expect(monthRingText(goalData(DAYS25, 40))).toBe('GOAL 40 H');
    expect(monthRingText(rv)).toBe(`${(sum(rv.slice(1)) / H).toFixed(1)} H THIS MONTH`);
    expect(monthTotalText(0)).toBe('0.0 H');
    expect(monthTotalText(90 * 60_000)).toBe('1.5 H');
    expect(monthTotalText(NaN)).toBe('0.0 H');
    for (const size of SIZES) {
      expect(monthTotalAt(MONTH_STILL_AT, d, size)).toBe(`${(sum(DAYS25) / H).toFixed(1)} H`);
      expect(monthTotalAt(3.6, rv, size)).toBe(`${(sum(rv.slice(1)) / H).toFixed(1)} H`);
      expect(monthTotalAt(0, d, size)).toBe('0.0 H');
    }
  });

  it('the running total grows with the climb and never goes down', () => {
    const d = goalData();
    let prev = -1;
    for (const t of times) {
      const v = parseFloat(monthTotalAt(t, d, SIZES[0]));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    const mid = parseFloat(monthTotalAt(1.1, d, SIZES[0]));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(sum(DAYS25) / H);
  });

  it('is finite, hidden at the start, fully visible at rest; the ring label turns yellow only once closed', () => {
    for (const size of SIZES) {
      expect(monthHeadAt(0, goalData(), size)[2]).toBe(0);
      expect(monthRingAt(0, goalData(), size)[2]).toBe(0);
      const h = monthHeadAt(MONTH_STILL_AT, goalData(), size);
      const r = monthRingAt(MONTH_STILL_AT, goalData(), size);
      expect(h[2]).toBe(1);
      expect(r[2]).toBe(1);
      expect([h[0], h[1], r[0], r[1]].every(Number.isFinite)).toBe(true);
      expect(r[3]).toBe('#f7d45e');
    }
    expect(monthRingAt(MONTH_STILL_AT, reviewData(), SIZES[0])[3]).toBe('#8b9099');
    expect(monthRingAt(MONTH_STILL_AT, goalData(DAYS25, GOAL + 1), SIZES[0])[3]).toBe('#8b9099');
    expect(monthRingAt(0.8, goalData(), SIZES[0])[3]).toBe('#8b9099');
  });

  it('stay inside the screen margins and above the headline at every frame and size', () => {
    for (const size of SIZES) {
      for (const t of times) {
        for (const d of [goalData(), reviewData(), [sum(FULL31) / 3, ...FULL31]]) {
          const { head, ring } = rects(size, t, d);
          for (const r of [head, ring]) {
            expect(r.l).toBeGreaterThanOrEqual(size.w * 0.07 - 1e-6);
            expect(r.r).toBeLessThanOrEqual(size.w * 0.93 + 1e-6);
            expect(r.t).toBeGreaterThanOrEqual(size.h * 0.15);
            expect(r.b).toBeLessThanOrEqual(size.h * 0.69);
          }
        }
      }
    }
  });

  it('do not overlap each other at any frame and size', () => {
    for (const size of SIZES) {
      for (const t of times) {
        for (const d of [goalData(), reviewData(), [sum(FULL31) / 3, ...FULL31]]) {
          const { head, ring } = rects(size, t, d);
          if (hit(head, ring)) throw new Error(`labels overlap: ${size.w}x${size.h} t=${t}`);
        }
      }
    }
  });

  it('the running total sits at the head of the curtain: just above the top line end', () => {
    const size = SIZES[0];
    const d = goalData();
    const line = topLine(monthDraw(MONTH_STILL_AT, size, d));
    const [x, y] = monthHeadAt(MONTH_STILL_AT, d, size);
    const ex = line.pts[line.pts.length - 2];
    const ey = line.pts[line.pts.length - 1];
    expect(y).toBeLessThan(ey);
    expect(ey - y).toBeLessThan(size.h * 0.1);
    expect(Math.abs(x - ex)).toBeLessThan(size.w * 0.35);
  });

  it('at rest the head (the last day) faces the viewer: in the middle 60% of the width and on the near half, for any month length', () => {
    for (const size of SIZES) {
      for (const n of [1, 12, 24, 28, 31]) {
        const cam = camFor(MONTH_STILL_AT, size, n);
        const a = Math.PI / 2 + (n / 31) * 2 * Math.PI;
        const q = project(cam, [2.5 * Math.cos(a), 0, 2.5 * Math.sin(a)]);
        const c = project(cam, [0, 0, 0]);
        expect(q[0]).toBeGreaterThan(size.w * 0.2);
        expect(q[0]).toBeLessThan(size.w * 0.8);
        expect(q[2]).toBeLessThan(c[2]); // nearer than the cylinder's axis
        expect(q[0]).toBeGreaterThan(c[0]); // a little to the right of dead ahead, away from the ring label
      }
    }
  });

  it('the running total never sits inside the ring at rest (above its top), for goal and review months', () => {
    for (const size of SIZES) {
      for (const d of [goalData(), reviewData(), [2 * H, ...[20, 0, 0, 0, 0, 0, 50, 0, 0, 0, 60, 0].map((m) => m * 60_000 + 30 * 60_000)], [sum(FULL31) / 3, ...FULL31]]) {
        const ring = monthDraw(MONTH_STILL_AT, size, d).filter((p) => p.segs && (p.strokeWidth === 3 || p.strokeWidth === 1.5));
        const box = { l: Math.min(...xs(ring)), r: Math.max(...xs(ring)), t: Math.min(...ys(ring)), b: Math.max(...ys(ring)) };
        const f = monthLabelSizes(size);
        const [hx, hy] = monthHeadAt(MONTH_STILL_AT, d, size);
        const hw = monthTotalText(sum(d.slice(1))).length * f.total * 0.62;
        expect(hit({ l: hx - hw, r: hx, t: hy - f.total * 0.7, b: hy + f.total * 0.7 }, box)).toBe(false);
      }
    }
  });

  it('the ring label sits just above the ring (not on it), at its left-most point', () => {
    const size = SIZES[0];
    const d = goalData();
    const ring = closedRing(monthDraw(MONTH_STILL_AT, size, d))[0];
    const [x, y] = monthRingAt(MONTH_STILL_AT, d, size);
    expect(Math.abs(x - Math.min(...xs([ring])))).toBeLessThan(size.w * 0.12);
    expect(y).toBeLessThan(Math.min(...ys([ring])));
    expect(Math.min(...ys([ring])) - y).toBeLessThan(size.h * 0.06);
  });

  it('is identical from the still time on', () => {
    for (const size of SIZES) {
      for (const d of [goalData(), reviewData()]) {
        expect(monthHeadAt(3.6, d, size)).toEqual(monthHeadAt(MONTH_STILL_AT, d, size));
        expect(monthRingAt(3.6, d, size)).toEqual(monthRingAt(MONTH_STILL_AT, d, size));
        expect(monthTotalAt(3.6, d, size)).toEqual(monthTotalAt(MONTH_STILL_AT, d, size));
      }
    }
  });
});
