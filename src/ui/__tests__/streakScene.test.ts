import { streakWeekdays, type Moment } from '@/domain/moments';

import { MOMENT_DUR } from '../moments/timeline';
import type { Prim } from '../moments/three';
import { STREAK_LABELLED, STREAK_SLOTS, STREAK_STILL_AT, streakDraw, streakLabelAt, streakLabelOf, streakLabelSize, streakSceneDraw } from '../moments/streakScene';
import { WEEK_LETTERS } from '../moments/weekScene';

const SIZES = [{ w: 390, h: 844 }, { w: 320, h: 568 }, { w: 1024, h: 768 }];
const NS = [1, 7, 14, 21];
const times = Array.from({ length: 73 }, (_, i) => Math.round(i * 0.05 * 100) / 100).filter((t) => t <= MOMENT_DUR);

const rgb = (fill: string) => fill.match(/\d+/g)!.map(Number);
const isGoldFill = (p: Prim) => {
  const [r, , b] = rgb(p.fill);
  return r - b > 40;
};
const solids = (ps: Prim[]) => ps.filter((p) => p.fill.startsWith('rgb('));
const ys = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 1));
const xs = (ps: Prim[]) => ps.flatMap((p) => p.pts.filter((_, i) => i % 2 === 0));
const finite = (ps: Prim[]) => ps.every((p) => Number.isFinite(p.depth) && p.pts.every(Number.isFinite) && !p.fill.includes('NaN'));

type StreakMoment = Extract<Moment, { kind: 'streak' }>;
const letters = (m: StreakMoment) => streakWeekdays(m).map((wd) => WEEK_LETTERS[wd]);

describe('streakDraw', () => {
  it('draws the same stair for the same input (a fresh array each call)', () => {
    const a = streakDraw(2, SIZES[0], 7);
    const b = streakDraw(2, SIZES[0], 7);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('nothing is drawn for no steps', () => {
    expect(streakDraw(2, SIZES[0], 0)).toEqual([]);
  });

  it('draws n steps, each with 1 to 3 visible faces (settled)', () => {
    for (const n of NS) {
      const s = solids(streakDraw(STREAK_STILL_AT, SIZES[0], n));
      expect(s.length).toBeGreaterThanOrEqual(n);
      expect(s.length).toBeLessThanOrEqual(3 * n);
    }
  });

  it('only the top step is gold, and only once it has landed', () => {
    for (const n of [2, ...NS.slice(1)]) {
      expect(solids(streakDraw(0.5, SIZES[0], n)).some(isGoldFill)).toBe(false);
      const landed = solids(streakDraw(STREAK_STILL_AT, SIZES[0], n));
      const gold = landed.filter(isGoldFill);
      const rest = landed.filter((p) => !isGoldFill(p));
      expect(gold.length).toBeGreaterThan(0);
      expect(gold.length).toBeLessThanOrEqual(3);
      expect(rest.length).toBeGreaterThanOrEqual(n - 1);
      // The gold faces are the highest on screen: the top step (n - 1) is gold, so gold on step n - 2 would be lower than step n - 1's faces.
      expect(Math.min(...ys(gold))).toBeLessThan(Math.min(...ys(rest)));
      expect(Math.max(...ys(gold))).toBeLessThan(Math.max(...ys(rest)));
    }
    // before the top step has landed (1.75 s) it is graphite
    expect(solids(streakDraw(1.6, SIZES[0], 7)).some(isGoldFill)).toBe(false);
  });

  it('the floor ring, the axis and the thread are one open segment prim each', () => {
    const lines = (ps: Prim[]) => ps.filter((p) => p.segs);
    expect(lines(streakDraw(STREAK_STILL_AT, SIZES[0], 7))).toHaveLength(3);
    expect(lines(streakDraw(STREAK_STILL_AT, SIZES[0], 1))).toHaveLength(2); // one step: no thread
    expect(lines(streakDraw(1.0, SIZES[0], 7))).toHaveLength(2); // the thread has not started
  });

  it('never exceeds the slot budget, and never produces NaN, at any frame for 1, 7 and 21 steps', () => {
    const worst: Record<number, number> = {};
    for (const size of SIZES) {
      for (const n of NS) {
        for (const t of times) {
          const ps = streakDraw(t, size, n);
          worst[n] = Math.max(worst[n] ?? 0, ps.length);
          expect(ps.length).toBeLessThanOrEqual(STREAK_SLOTS);
          if (!finite(ps)) throw new Error(`non-finite prim: n=${n} t=${t}`);
        }
      }
    }
    // measured 5 / 24 / 45 / 65 of 66
    expect(worst[21]).toBeGreaterThan(40);
    expect(STREAK_SLOTS - worst[21]).toBeLessThanOrEqual(3);
  });

  it('stays on screen at every frame (390x844, 320x568), and a 7+ step stair fills at least 40% of the height at rest', () => {
    for (const size of SIZES.slice(0, 2)) {
      for (const n of NS) {
        for (const t of times) {
          const y = ys(streakDraw(t, size, n));
          expect(Math.min(...y)).toBeGreaterThan(0);
          expect(Math.max(...y)).toBeLessThan(size.h * 0.66);
          const x = xs(streakDraw(t, size, n));
          expect(Math.min(...x)).toBeGreaterThan(0);
          expect(Math.max(...x)).toBeLessThan(size.w);
        }
        const y = ys(streakDraw(STREAK_STILL_AT, size, n));
        if (n >= 7) expect((Math.max(...y) - Math.min(...y)) / size.h).toBeGreaterThanOrEqual(size === SIZES[0] ? 0.4 : 0.35);
      }
    }
  });

  it('is frozen from the point the camera stops: later frames equal the still frame', () => {
    for (const n of NS) {
      expect(streakSceneDraw(3.6, n, SIZES[0])).toEqual(streakSceneDraw(STREAK_STILL_AT, n, SIZES[0]));
      expect(streakSceneDraw(STREAK_STILL_AT, n, SIZES[0])).toEqual(streakDraw(STREAK_STILL_AT, SIZES[0], n));
    }
    expect(streakDraw(2.0, SIZES[0], 7)).not.toEqual(streakDraw(2.4, SIZES[0], 7)); // it does move before that
  });
});

describe('streak labels', () => {
  it('letters are the real weekdays: a run ending on a Wednesday ends W, a 7-day run ending Sunday reads M T W T F S S', () => {
    const wed: StreakMoment = { kind: 'streak', days: 7, endDayKey: '2026-11-04' }; // a Wednesday
    expect(letters(wed)).toEqual(['T', 'F', 'S', 'S', 'M', 'T', 'W']);
    expect(letters(wed).at(-1)).toBe('W');
    const sun: StreakMoment = { kind: 'streak', days: 7, endDayKey: '2026-11-08' }; // a Sunday
    expect(letters(sun).join(' ')).toBe('M T W T F S S');
  });

  it('is finite, hidden before its step lands, visible after (the top 7 only), today yellow and the rest steel', () => {
    const size = SIZES[0];
    for (const n of NS) {
      for (let i = 0; i < n; i++) {
        const [x, y, o, c] = streakLabelAt(MOMENT_DUR, i, n, size);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        if (i < n - STREAK_LABELLED) expect(o).toBe(0);
        else if (i === n - 1) expect(o).toBe(1);
        else expect([0.35, 1]).toContain(o);
        expect(c).toBe(i === n - 1 ? '#f7d45e' : '#8b9099');
        expect(streakLabelAt(0, i, n, size)[2]).toBe(0);
        expect(streakLabelAt(0, i, n, size)[3]).toBe(i === n - 1 ? '#f7d45e' : '#8b9099');
      }
    }
  });

  it('stays inside the screen margins and above the headline, for 21 steps at every frame and size', () => {
    for (const size of SIZES) {
      const fs = streakLabelSize(size, 21);
      for (const t of times) {
        for (let i = 14; i < 21; i++) {
          const [x, y] = streakLabelAt(t, i, 21, size);
          const half = ((i === 20 ? 9 : 1) * fs * 0.62) / 2;
          expect(x).toBeGreaterThanOrEqual(size.w * 0.07 + half - 1e-9);
          expect(x).toBeLessThanOrEqual(size.w * 0.93 - half + 1e-9);
          expect(y).toBeGreaterThanOrEqual(size.h * 0.1);
          expect(y).toBeLessThanOrEqual(size.h * 0.66);
        }
      }
    }
  });

  it('labels only the top 7 steps (the latest week); older steps are bare', () => {
    for (const n of [7, 14, 21]) {
      for (let i = 0; i < n; i++) {
        const o = streakLabelAt(STREAK_STILL_AT, i, n, SIZES[0])[2];
        if (i < n - STREAK_LABELLED) expect(o).toBe(0);
        else expect(o).toBeGreaterThan(0);
      }
    }
  });

  it('dims labels behind the axis (about 0.35); today and the near side stay at full opacity', () => {
    const o = Array.from({ length: 7 }, (_, i) => streakLabelAt(STREAK_STILL_AT, i, 7, SIZES[0])[2]);
    expect(o.some((v) => Math.abs(v - 0.35) < 1e-9)).toBe(true);
    expect(o.some((v) => v === 1)).toBe(true);
    expect(o[6]).toBe(1);
  });

  it("today's label sits clear of the gold step (no overlap with its faces)", () => {
    for (const size of SIZES) {
      for (const n of NS) {
        const gold = solids(streakDraw(STREAK_STILL_AT, size, n)).filter(isGoldFill);
        const [x, y] = streakLabelAt(STREAK_STILL_AT, n - 1, n, size);
        const fs = streakLabelSize(size, n);
        const hw = (9 * fs * 0.62) / 2;
        const top = y - fs * 0.7;
        const bottom = y + fs * 0.7;
        const gx = xs(gold);
        const gy = ys(gold);
        const overlap = Math.min(x + hw, Math.max(...gx)) > Math.max(x - hw, Math.min(...gx)) && Math.min(bottom, Math.max(...gy)) > Math.max(top, Math.min(...gy));
        expect(overlap).toBe(false);
      }
    }
  });

  it('is identical from the still time on, and clamps n like streakDraw', () => {
    for (const n of NS) for (let i = 0; i < n; i++) expect(streakLabelAt(3.6, i, n, SIZES[0])).toEqual(streakLabelAt(STREAK_STILL_AT, i, n, SIZES[0]));
    expect(streakLabelAt(2, 20, 99, SIZES[0])).toEqual(streakLabelAt(2, 20, 21, SIZES[0]));
    expect(streakLabelOf(2, [20, 99], SIZES[0])).toEqual(streakLabelAt(2, 20, 21, SIZES[0]));
    expect(streakLabelAt(2, 0, 0, SIZES[0]).every((v) => typeof v === 'string' || Number.isFinite(v))).toBe(true);
  });

  it('the Label3D adapter takes [i, n]', () => {
    expect(streakLabelOf(2, [3, 7], SIZES[0])).toEqual(streakLabelAt(2, 3, 7, SIZES[0]));
  });
});
