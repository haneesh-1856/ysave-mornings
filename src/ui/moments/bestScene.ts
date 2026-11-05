// The Personal best moment: the last 13 days stand as columns under a glass plane at your previous best, and today's
// gold column rises through it; the sun's ring spreads on the glass where it broke. Pure worklets (the UI thread builds
// the polygons each frame) and plain functions (tests call them directly).
// Ported from the `best` scene of drafts/celebrations/close-moments-3d-v1.html. Changes: the camera eases to a stop at
// BEST_STILL_AT (the bench kept turning) and is fitted to the screen, the ring is smaller and finishes before then, and
// today's labels stack above its column (the bench put them left of it, over its neighbours).

import { MOMENT_COLORS as C } from './colors';
import type { Size } from './parts';
import { inOut, lerp, outExpo, seg } from './timeline';
import { camera, GOLD, GRAPH, boxFaces, NO_GLOW, project, pushFace, pushSegments, pushSolid, safeGlow, type Cam, type Glow, type Prim, type Vec3 } from './three';

/**
 * Prim slots the scene needs: the floor grid, the glass, its edges and the ring (one prim each) + up to 3 visible faces
 * for each of the 14 columns and 3 more for today's column above the glass. The measured worst case is 49 (390x844, 320x568, 1024x768, 13 non-zero days),
 * one below this (bestScene.test.ts asserts it at every frame and size, with 13 non-zero days).
 */
export const BEST_SLOTS = 50;
/** From this local time nothing moves (the camera has come to rest, the ring has faded): Scene3D draws the scene once and keeps the frame. */
export const BEST_STILL_AT = 2.8;

const MAX_RECENT = 13;
const XT = 6.5; // today's column: the others stand to its left, one unit apart
const COL_HALF = 0.31;
const TALL = 4.4; // the column scale: top = max(today, best) * 1.1 maps to this many scene units
const GRID_X = 8;
const GRID_Z = 3;
const GLASS_X = 7.6;
const GLASS_Z = 2.2;
const RING_MAX = 1.5;
const RING_OPEN = Math.PI * (85 / 180); // the sun ring opening (a plain expression: no leading "(")
const DIST = 14;
const YAW_0 = -0.8;
const YAW_1 = -0.62;
const PITCH_0 = 0.58;
const PITCH_1 = 0.46;
const RISE_FROM = 0.15; // the first past column starts rising
const RISE_STAGGER = 0.05;
const RISE_DUR = 0.65;
const T0 = 0.9; // today's column rises from T0 to T1
const T1 = 1.8;
const RING_DUR = 0.8;
const LABEL_FROM = 1.95;
const LABEL_TO = 2.3;
const FIT_TOP = 0.16; // the fitted block (labels included) starts here ...
const FIT_BOTTOM = 0.68; // ... and ends here, as fractions of the height (the headline sits at about 0.69 h)
const LABEL_GAP = 6; // between today's column top and its yellow label, in px
const MAX_COL = TALL / 1.1; // the tallest a column can be: today's, since best <= today

/** A usable focus value: a finite number of ms, never negative. Anything else is no focus. */
const clean = (v: number): number => {
  'worklet';
  return v > 0 && v < Infinity ? v : 0;
};

/** v / top * 4.4 with top = max(today, best) * 1.1 (everything is 0 high when both are 0). */
const heightOf = (v: number, today: number, best: number): number => {
  'worklet';
  const top = Math.max(today, best) * 1.1;
  return top > 0 ? (clean(v) / top) * TALL : 0;
};

/** Column heights in scene units (the recent days oldest first, then today) and the height of the glass (the previous best). */
export const bestHeights = (recentMs: readonly number[], todayMs: number, previousBestMs: number): { bars: number[]; glass: number } => {
  'worklet';
  const today = clean(todayMs);
  const best = clean(previousBestMs);
  const bars: number[] = [];
  for (let i = 0; i < recentMs.length; i++) bars.push(heightOf(recentMs[i], today, best));
  bars.push(heightOf(today, today, best));
  return { bars, glass: heightOf(best, today, best) };
};

/** Font sizes of today's two labels (white H:MM, yellow +H:MM) and the BEST label. */
export const bestLabelSizes = (size: Size): { today: number; delta: number; best: number } => {
  'worklet';
  const u = Math.min(size.w, size.h);
  return { today: u * 0.06, delta: Math.max(10, u * 0.032), best: Math.max(9, u * 0.027) };
};

/** The height in px that today's two stacked labels need above the column's top. */
const stackHeight = (size: Size): number => {
  'worklet';
  const f = bestLabelSizes(size);
  return LABEL_GAP + 1.4 * (f.today + f.delta);
};

/** Pixel extent (at one pixel per scene unit at the target) of the floor, the glass (at its highest) and today's column top under a yaw and pitch. */
const extent = (yaw: number, pitch: number): { x0: number; x1: number; y0: number; y1: number } => {
  'worklet';
  const c = camera({ yaw, pitch, dist: DIST, cx: 0, cy: 0, f: DIST, target: [0, 1.5, 0] });
  const pts: Vec3[] = [[-GRID_X, 0, -GRID_Z], [GRID_X, 0, -GRID_Z], [-GRID_X, 0, GRID_Z], [GRID_X, 0, GRID_Z],
    [-GLASS_X, MAX_COL, -GLASS_Z], [GLASS_X, MAX_COL, -GLASS_Z], [-GLASS_X, MAX_COL, GLASS_Z], [GLASS_X, MAX_COL, GLASS_Z], [XT, MAX_COL, 0]];
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const q = project(c, pts[i]);
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  return { x0, x1, y0, y1 };
};

/** Pixels per scene unit that fit the skyline (and the labels above it) to the screen under a yaw and pitch. */
const fitScale = (yaw: number, pitch: number, size: Size): number => {
  'worklet';
  const e = extent(yaw, pitch);
  return Math.min((size.w * 0.9) / (e.x1 - e.x0), ((FIT_BOTTOM - FIT_TOP) * size.h - stackHeight(size)) / (e.y1 - e.y0));
};

/**
 * The camera at local time lt: turns and tips slowly (easing out to rest at BEST_STILL_AT). The scale is the smallest of
 * the fits at the start, the end and now, so the floor stays on screen the whole time; the picture is centred
 * horizontally and the block (labels included) vertically between 0.16 h and 0.68 h.
 */
export const camFor = (lt: number, size: Size): Cam => {
  'worklet';
  const k = seg(lt, 0, BEST_STILL_AT);
  const e = 1 - (1 - k) * (1 - k) * (1 - k);
  const yaw = lerp(YAW_0, YAW_1, e);
  const pitch = lerp(PITCH_0, PITCH_1, e);
  const s = Math.min(fitScale(YAW_0, PITCH_0, size), fitScale(YAW_1, PITCH_1, size), fitScale(yaw, pitch, size));
  const x = extent(yaw, pitch);
  return camera({
    yaw, pitch, dist: DIST,
    cx: size.w / 2 - (s * (x.x0 + x.x1)) / 2,
    cy: size.h * ((FIT_TOP + FIT_BOTTOM) / 2) + stackHeight(size) / 2 - (s * (x.y0 + x.y1)) / 2,
    f: s * DIST,
    target: [0, 1.5, 0],
  });
};

/** When today's column (rising from T0 to T1 on an ease in-out) reaches the glass, at a fraction r of its height. */
const crossAt = (r: number): number => {
  'worklet';
  const k = Math.max(0, Math.min(1, r));
  return lerp(T0, T1, k < 0.5 ? Math.cbrt(k / 4) : 1 - Math.cbrt(2 * (1 - k)) / 2);
};

/** Scene data [...recentMs, todayMs, previousBestMs] -> the recent days (the latest 13), today and the previous best. */
const split = (data: readonly number[]): { recent: number[]; today: number; best: number } => {
  'worklet';
  const n = data.length;
  const recent: number[] = [];
  for (let i = Math.max(0, n - 2 - MAX_RECENT); i < n - 2; i++) recent.push(data[i]);
  return { recent, today: n >= 2 ? clean(data[n - 2]) : 0, best: n >= 1 ? clean(data[n - 1]) : 0 };
};

/**
 * The scene at local time lt for data = [...recentMs, todayMs, previousBestMs], as prims: the floor grid, the columns
 * rising (a zero day has none), the glass at the previous best, today's gold column breaking through it and the ring
 * spreading where it broke.
 */
export const bestDraw = (lt: number, size: Size, data: number[]): Prim[] => {
  'worklet';
  const out: Prim[] = [];
  const { recent, today, best } = split(data);
  const { bars, glass } = bestHeights(recent, today, best);
  const n = bars.length;
  const cam = camFor(lt, size);
  const fa = seg(lt, 0, 0.4);
  // Floor grid: one prim, always the farthest.
  const grid: Vec3[] = [];
  for (let i = -GRID_X; i <= GRID_X; i++) grid.push([i, 0, -GRID_Z], [i, 0, GRID_Z]);
  for (let z = -GRID_Z; z <= GRID_Z; z++) grid.push([-GRID_X, 0, z], [GRID_X, 0, z]);
  pushSegments(out, cam, grid, C.white, 1, 0.07 * fa);
  if (out.length > 0) out[0].depth = 1e6;
  // Columns: the part under the glass and the part above it (only today's reaches it).
  const low: Prim[] = [];
  const up: Prim[] = [];
  const todayRise = inOut(seg(lt, T0, T1));
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const rise = last ? todayRise : outExpo(seg(lt, RISE_FROM + i * RISE_STAGGER, RISE_FROM + RISE_DUR + i * RISE_STAGGER));
    const h = bars[i] * rise;
    if (!(h > 0.002)) continue;
    const x = XT - (n - 1 - i);
    const pal = last ? GOLD : GRAPH;
    const top = Math.min(h, glass);
    if (top > 0.002) pushSolid(low, cam, boxFaces(x - COL_HALF, 0, -COL_HALF, x + COL_HALF, top, COL_HALF), [x, top / 2, 0], pal, 1);
    if (h - glass > 0.002) pushSolid(up, cam, boxFaces(x - COL_HALF, glass, -COL_HALF, x + COL_HALF, h, COL_HALF), [x, (glass + h) / 2, 0], pal, 1);
  }
  // The glass: drawn over the lower parts, under the part of today's column that has broken through.
  let lo = Infinity;
  for (let i = 0; i < low.length; i++) lo = Math.min(lo, low[i].depth);
  let hi = -Infinity;
  for (let i = 0; i < up.length; i++) hi = Math.max(hi, up[i].depth);
  const mid = lo < Infinity && hi > -Infinity ? (lo + hi) / 2 : Infinity;
  // (When the best is small the lower parts can be nearer than today's part above the glass: the glass then stays behind that part.)
  const gd = Math.max(Math.min(lo - 0.001, mid, 1e5), hi + 0.002);
  const pk = outExpo(seg(lt, 0.55, 1.05));
  if (pk > 0) {
    const px = GLASS_X * pk;
    const before = out.length;
    pushFace(out, cam, [[-px, glass, -GLASS_Z], [px, glass, -GLASS_Z], [px, glass, GLASS_Z], [-px, glass, GLASS_Z]], C.white, 0.05);
    pushSegments(out, cam, [[-px, glass, -GLASS_Z], [px, glass, -GLASS_Z], [-px, glass, GLASS_Z], [px, glass, GLASS_Z]], C.white, 1.1, 0.45, true);
    for (let i = before; i < out.length; i++) out[i].depth = gd - (out.length - i) * 0.0005;
  }
  for (let i = 0; i < low.length; i++) out.push(low[i]);
  for (let i = 0; i < up.length; i++) out.push(up[i]);
  // The ring on the glass where today's column broke it: one prim, in front of everything.
  const tallest = bars[n - 1];
  const crossT = crossAt(tallest > 0 ? glass / tallest : 1);
  const rp = seg(lt, crossT, crossT + RING_DUR);
  if (tallest > glass && rp > 0 && rp < 1) {
    const r = 0.45 + (RING_MAX - 0.45) * outExpo(rp);
    const step = (2 * Math.PI - RING_OPEN) / 48;
    const start = -Math.PI / 2 + 0.35 + RING_OPEN / 2;
    const ring: Vec3[] = [];
    for (let i = 0; i < 48; i++) {
      const a0 = start + step * i;
      const a1 = a0 + step;
      ring.push([XT + r * Math.cos(a0), glass, r * Math.sin(a0)], [XT + r * Math.cos(a1), glass, r * Math.sin(a1)]);
    }
    const before = out.length;
    pushSegments(out, cam, ring, C.yellow, 2.5 * (1 - rp) + 1, 1 - rp);
    if (out.length > before) out[before].depth = -1;
  }
  return out;
};

/** Scene3D's `draw`: the scene's data is [...recentMs, todayMs, previousBestMs]. (Module-level so the worklet guard sees it.) */
export const bestSceneDraw = (lt: number, data: number[], size: Size): Prim[] => {
  'worklet';
  return bestDraw(Math.min(lt, BEST_STILL_AT), size, data);
};

/**
 * Label3D's `at` for the three labels: `data` is [which, todayMs, previousBestMs] with which 0 = BEST (steel, at the glass's
 * back-left corner), 1 = today's H:MM (white) and 2 = the +H:MM (yellow), both stacked above today's column. Returns
 * [x, y, opacity, colour], kept inside the screen and above the headline.
 */
export const bestLabelAt = (lt: number, data: number[], screen: Size): [number, number, number, string] => {
  'worklet';
  const t = Math.min(lt, BEST_STILL_AT);
  const cam = camFor(t, screen);
  const f = bestLabelSizes(screen);
  const m = screen.w * 0.07;
  const today = clean(data[1]);
  const best = clean(data[2]);
  const lo = screen.h * 0.1;
  const hi = screen.h * 0.7;
  if (data[0] === 0) {
    const q = project(cam, [-GLASS_X, heightOf(best, today, best), -GLASS_Z]);
    // "BEST H:MM" is at most 10 characters wide (mono advance about 0.62 em).
    const x = Math.min(screen.w - m - 10 * f.best * 0.62, Math.max(m, q[0]));
    return [x, Math.min(hi, Math.max(lo, q[1] - f.best * 1.6)), seg(t, 0.55, 1.05), C.steel];
  }
  const top = project(cam, [XT, heightOf(today, today, best), 0]);
  // Yellow sits just above the column, white above it; "+H:MM" and "H:MM" are at most 6 characters wide.
  const yellowY = top[1] - LABEL_GAP - f.delta * 0.7;
  const whiteY = yellowY - f.delta * 0.7 - f.today * 0.7;
  const white = data[0] === 1;
  const half = (6 * (white ? f.today : f.delta) * 0.62) / 2;
  const x = Math.min(screen.w - m - half, Math.max(m + half, top[0]));
  return [x, Math.min(hi, Math.max(lo, white ? whiteY : yellowY)), seg(t, LABEL_FROM, LABEL_TO), white ? C.white : C.yellow];
};

/**
 * Glow3D's `at`: a warm glow on the top of today's gold column, following it up, appearing as it breaks the glass
 * (no glow when today does not reach the glass). `data` is the scene's [...recentMs, todayMs, previousBestMs].
 */
export const bestGlowAt = (lt: number, data: number[], size: Size): Glow => {
  'worklet';
  const t = Math.min(lt, BEST_STILL_AT);
  const { recent, today, best } = split(data);
  const { bars, glass } = bestHeights(recent, today, best);
  const tallest = bars[bars.length - 1];
  if (!(tallest > glass)) return NO_GLOW;
  const q = project(camFor(t, size), [XT, tallest * inOut(seg(t, T0, T1)), 0]);
  const crossT = crossAt(glass / tallest);
  const r = size.w * 0.17;
  return safeGlow([q[0], q[1], r, r * 0.8, seg(t, crossT, crossT + 0.5)]);
};
