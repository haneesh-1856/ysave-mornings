import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import { bestGlowAt } from '../moments/bestScene';
import { DEFAULT_LAB_FLAGS, setLabFlags } from '../moments/lab';
import { monthGlowAt } from '../moments/monthScene';
import { Glow3D } from '../moments/Scene3D';
import { streakGlowAt } from '../moments/streakScene';
import { NO_GLOW, safeGlow, type Glow } from '../moments/three';
import { weekGlowAt } from '../moments/weekScene';
import { renderThemed } from '../testing';

// The glow around the gold pieces (user request 2026-11-05). Dark until the piece turns gold, lit after, always finite
// (Android's SVG drawing rejects NaN), centred on screen-sized coordinates.

const MIN = 60_000;
const size = { w: 411, h: 820 };
const BEST = [...[60, 90, 0, 120, 150, 40, 80, 100, 0, 30, 110, 70, 60].map((m) => m * MIN), 185 * MIN, 150 * MIN];
const WEEK = [120, 150, 95, 185, 60, 80, 70].map((m) => m * MIN);
const MONTH_MET = [8 * 3_600_000, ...[150, 0, 200, 185].map((m) => m * MIN)];
const MONTH_REVIEW = [-1, ...[150, 0, 200, 185].map((m) => m * MIN)];
const FRAMES = Array.from({ length: 101 }, (_, i) => i * 0.05);

const CASES: [string, (lt: number) => Glow][] = [
  ['best', (lt) => bestGlowAt(lt, BEST, size)],
  ['streak', (lt) => streakGlowAt(lt, 14, size)],
  ['week', (lt) => weekGlowAt(lt, WEEK, size)],
  ['month', (lt) => monthGlowAt(lt, MONTH_MET, size)],
];

afterEach(() => setLabFlags(DEFAULT_LAB_FLAGS));

describe('glow positions', () => {
  it.each(CASES)('%s: off at the start, lit once gold, finite and on screen every frame', (_n, at) => {
    expect(at(0)[4]).toBe(0);
    expect(at(5)[4]).toBe(1);
    for (const lt of FRAMES) {
      const g = at(lt);
      for (const v of g) expect(Number.isFinite(v)).toBe(true);
      if (g[4] > 0) {
        expect(g[0]).toBeGreaterThan(0);
        expect(g[0]).toBeLessThan(size.w);
        expect(g[1]).toBeGreaterThan(0);
        expect(g[1]).toBeLessThan(size.h * 0.72); // above the headline
        expect(g[2]).toBeGreaterThan(0);
        expect(g[3]).toBeGreaterThan(0);
      }
    }
  });

  it('best: no glow when today does not break the glass', () => {
    const notBest = [...BEST.slice(0, 13), 100 * MIN, 150 * MIN];
    for (const lt of FRAMES) expect(bestGlowAt(lt, notBest, size)).toEqual(NO_GLOW);
  });

  it('month: no glow in a review month (the ring stays open and white) or before the goal is met', () => {
    for (const lt of FRAMES) expect(monthGlowAt(lt, MONTH_REVIEW, size)).toEqual(NO_GLOW);
    const notMet = [100 * 3_600_000, ...MONTH_MET.slice(1)];
    for (const lt of FRAMES) expect(monthGlowAt(lt, notMet, size)).toEqual(NO_GLOW);
  });

  it('safeGlow turns any non-finite value or zero opacity into no glow', () => {
    expect(safeGlow([1, 2, 3, 4, Number.NaN])).toEqual(NO_GLOW);
    expect(safeGlow([Infinity, 2, 3, 4, 1])).toEqual(NO_GLOW);
    expect(safeGlow([1, 2, 3, 4, 0])).toEqual(NO_GLOW);
    expect(safeGlow([1, 2, 3, 4, 0.5])).toEqual([1, 2, 3, 4, 0.5]);
  });
});

describe('Glow3D', () => {
  it('draws one gradient ellipse, hidden from screen readers and touches', async () => {
    await renderThemed(<Glow3D lt={makeMutable(5)} at={(lt) => streakGlowAt(lt, 7, size)} size={size} />);
    const svg = screen.getByTestId('glow3d', { hidden: true });
    expect(svg.props.pointerEvents).toBe('none');
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('the lab switch turns it off', async () => {
    setLabFlags({ glow: false });
    await renderThemed(<Glow3D lt={makeMutable(5)} at={(lt) => streakGlowAt(lt, 7, size)} size={size} />);
    expect(screen.queryByTestId('glow3d', { hidden: true })).toBeNull();
  });
});
