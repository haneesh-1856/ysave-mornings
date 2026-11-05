// The Month moment: the month's focus climbs a cylinder as a curtain (one turn per 31 ticks, one day per tick). The goal
// floats above it as the sun's ring with its opening; when the real total reaches the goal the gap closes and one pulse
// goes out. A month in review has no goal: the ring marks the total and stays open. Pure worklets (the UI thread builds
// the polygons each frame) and plain functions (tests call them directly).
// Ported from the `month` scene of drafts/celebrations/close-moments-3d-v1.html. Changes: the curtain is the real
// cumulative focus of each day, the camera eases to a stop at MONTH_STILL_AT (the bench kept turning) and is fitted to
// the screen, and the ring closes and pulses before then.

import { MOMENT_COLORS as C } from './colors';
import type { Size } from './parts';
import { inOut, lerp, seg } from './timeline';
import { camera, NO_GLOW, project, pushFace, pushSegments, safeGlow, type Cam, type Glow, type Prim, type Vec3 } from './three';

/**
 * Prim slots the scene needs: the floor ring, the ticks, one prim per group of 4 days of curtain (8 for 31 days), the top
 * line, the day marks, the goal ring and the pulse. The measured worst case is MONTH_SLOTS (390x844, 320x568, 1024x768,
 * 31 days all non-zero); monthScene.test.ts asserts it at every frame and size.
 */
export const MONTH_SLOTS = 14;
/** From this local time nothing moves (the camera has come to rest, the ring has closed and the pulse is gone): Scene3D draws the scene once and keeps the frame. */
export const MONTH_STILL_AT = 3;

const TICKS = 31; // one turn per month, whatever its length
const MAX_DAYS = 31;
const GROUP = 4; // days per curtain face
const R = 2.5; // the cylinder
const HU = 4.4; // the curtain's height at top = max(goal, total) * 1.08
const GOAL_R = R + 0.25;
const PULSE_GROW = 0.15;
const RING_OPEN = Math.PI * (85 / 180); // the sun ring opening (a plain expression: no leading "(")
const DIST = 11;
const YAW_0 = -0.5;
const FACE_OFF = 0.5; // the head settles this far (about 29 degrees) to the right of dead ahead, away from the ring's label
const PITCH = 0.45;
const P0 = 0.3; // the curtain climbs from P0 to P1
const P1 = 1.9;
const CLOSE_DUR = 0.4;
const PULSE_FROM = 0.35; // after the ring starts closing
const PULSE_DUR = 0.6;
const HEAD_FROM = 0.45;
const HEAD_TO = 0.75;
const FIT_TOP = 0.16; // the fitted block (labels included) starts here ...
const FIT_BOTTOM = 0.68; // ... and ends here, as fractions of the height (the headline sits at about 0.69 h)
const TOP_PAD = 0.12; // room for the running total above the curtain, as a fraction of the shorter side
const MS_PER_HOUR = 3_600_000;

/** A usable focus value: a finite number of ms, never negative. Anything else is no focus. */
const clean = (v: number): number => {
  'worklet';
  return v > 0 && v < Infinity ? v : 0;
};

/** The scene's numbers from data = [goalMs or -1, ...dailyMs]: the goal (0 = review), the days (at most 31) and the cumulative totals. */
const split = (data: readonly number[]): { goal: number; days: number; cum: number[] } => {
  'worklet';
  const cum: number[] = [0];
  const days = Math.max(0, Math.min(MAX_DAYS, data.length - 1));
  for (let i = 0; i < days; i++) cum.push(cum[i] + clean(data[i + 1]));
  return { goal: data.length > 0 ? clean(data[0]) : 0, days, cum };
};

/**
 * The curtain's height in scene units at the end of each day (index 0 = 0, so one more entry than days), the height of
 * the ring (at the goal, or at the total in review) and whether it is closed (only when the total reaches the goal).
 */
export const monthHeights = (data: readonly number[]): { curtain: number[]; ring: number; closed: boolean; review: boolean } => {
  'worklet';
  const { goal, days, cum } = split(data);
  const total = cum[days];
  const target = goal > 0 ? goal : total;
  const top = Math.max(target, total) * 1.08;
  const curtain: number[] = [];
  for (let i = 0; i <= days; i++) curtain.push(top > 0 ? (cum[i] / top) * HU : 0);
  return { curtain, ring: top > 0 ? (target / top) * HU : 0, closed: goal > 0 && total >= goal, review: goal <= 0 };
};

/** Font sizes of the running total and of the ring's label. */
export const monthLabelSizes = (size: Size): { total: number; ring: number } => {
  'worklet';
  const u = Math.min(size.w, size.h);
  return { total: u * 0.045, ring: Math.max(9, u * 0.027) };
};

/** The running total as text: hours with one decimal. */
export const monthTotalText = (ms: number): string => {
  'worklet';
  return `${(clean(ms) / MS_PER_HOUR).toFixed(1)} H`;
};

/** The ring's label text: `GOAL N H`, or `X.X H THIS MONTH` in review. */
export const monthRingText = (data: readonly number[]): string => {
  'worklet';
  const { goal, days, cum } = split(data);
  return goal > 0 ? `GOAL ${Math.round(goal / MS_PER_HOUR)} H` : `${monthTotalText(cum[days])} THIS MONTH`;
};

const ang = (x: number): number => {
  'worklet';
  return Math.PI / 2 + (x / TICKS) * 2 * Math.PI;
};

/** Pixel extent (at one pixel per scene unit at the target) of the floor and the tallest goal ring with its pulse under a yaw. */
const extent = (yaw: number): { x0: number; x1: number; y0: number; y1: number } => {
  'worklet';
  const c = camera({ yaw, pitch: PITCH, dist: DIST, cx: 0, cy: 0, f: DIST, target: [0, 1.8, 0] });
  const pts: Vec3[] = [];
  const yMax = HU / 1.08;
  const pr = GOAL_R * (1 + PULSE_GROW);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI;
    pts.push([(R + 0.4) * Math.cos(a), 0, (R + 0.4) * Math.sin(a)], [pr * Math.cos(a), yMax, pr * Math.sin(a)]);
  }
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

/** Pixels per scene unit that fit the cylinder (and the running total above it) to the screen under a yaw. */
const fitScale = (yaw: number, size: Size): number => {
  'worklet';
  const e = extent(yaw);
  const pad = TOP_PAD * Math.min(size.w, size.h);
  return Math.min((size.w * 0.9) / (e.x1 - e.x0), ((FIT_BOTTOM - FIT_TOP) * size.h - pad) / (e.y1 - e.y0));
};

/** The yaw the camera settles at: the curtain's head (the last day) faces the viewer, a little to the right. Within half a turn of the start. */
const yawEnd = (days: number): number => {
  'worklet';
  if (days <= 0) return YAW_0 + 0.6;
  let y = -Math.PI / 2 - ang(days) + FACE_OFF;
  const turn = 2 * Math.PI;
  y -= Math.round((y - YAW_0) / turn) * turn;
  return y;
};

/**
 * The camera at local time lt for a month of `days` days: turns and eases out to rest at MONTH_STILL_AT, where the last
 * day faces the viewer. The scale fits the cylinder (a circle looks the same from every yaw); the picture is centred
 * horizontally and the block (the running total included) vertically between 0.16 h and 0.68 h.
 */
export const camFor = (lt: number, size: Size, days: number): Cam => {
  'worklet';
  const k = seg(lt, 0, MONTH_STILL_AT);
  const e = 1 - (1 - k) * (1 - k) * (1 - k);
  const yaw = lerp(YAW_0, yawEnd(days), e);
  const s = fitScale(yaw, size);
  const x = extent(yaw);
  const pad = TOP_PAD * Math.min(size.w, size.h);
  return camera({
    yaw, pitch: PITCH, dist: DIST, target: [0, 1.8, 0],
    cx: size.w / 2 - (s * (x.x0 + x.x1)) / 2,
    cy: size.h * ((FIT_TOP + FIT_BOTTOM) / 2) + pad / 2 - (s * (x.y0 + x.y1)) / 2,
    f: s * DIST,
  });
};

/** The curtain's progress at local time lt, in days climbed (0..days). */
const climbed = (lt: number, days: number): number => {
  'worklet';
  return inOut(seg(lt, P0, P1)) * days;
};

/** When the climb reaches the day position x (of `days`): the inverse of the ease in-out. */
const timeOf = (x: number, days: number): number => {
  'worklet';
  const r = Math.max(0, Math.min(1, days > 0 ? x / days : 0));
  return lerp(P0, P1, r < 0.5 ? Math.cbrt(r / 4) : 1 - Math.cbrt(2 * (1 - r)) / 2);
};

/** When the real total reaches the goal (the ring starts to close), or -1 when it never does (review). */
const crossTime = (cum: readonly number[], days: number, goal: number): number => {
  'worklet';
  if (!(goal > 0) || !(cum[days] >= goal)) return -1;
  let j = 1;
  while (j < days && cum[j] < goal) j++;
  return timeOf(j - 1 + (goal - cum[j - 1]) / (cum[j] - cum[j - 1]), days);
};

/** A ring (or an arc of it) at height y as consecutive segment pairs. */
const ringPairs = (y: number, r: number, a0: number, a1: number, n: number): Vec3[] => {
  'worklet';
  const pairs: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const u0 = a0 + ((a1 - a0) * i) / n;
    const u1 = a0 + ((a1 - a0) * (i + 1)) / n;
    pairs.push([r * Math.cos(u0), y, r * Math.sin(u0)], [r * Math.cos(u1), y, r * Math.sin(u1)]);
  }
  return pairs;
};

/** The point on the curtain's top at day position x (0..days): its angle and height. */
const at = (x: number, curtain: readonly number[], days: number): { a: number; y: number } => {
  'worklet';
  const i = Math.min(days - 1, Math.floor(x));
  return { a: ang(x), y: lerp(curtain[i], curtain[i + 1], x - i) };
};

/**
 * The scene at local time lt for data = [goalMs or -1, ...dailyMs], as prims: the floor ring and ticks, the curtain climbing
 * (a zero day leaves it flat), its top line, the goal ring (closing when the total reaches the goal) and the pulse.
 */
export const monthDraw = (lt: number, size: Size, data: number[]): Prim[] => {
  'worklet';
  const out: Prim[] = [];
  const { goal, days, cum } = split(data);
  const { curtain, ring, closed, review } = monthHeights(data);
  const cam = camFor(lt, size, days);
  const fa = seg(lt, 0, 0.35);
  // The floor ring and the ticks: the farthest prims.
  pushSegments(out, cam, ringPairs(0, R, 0, 2 * Math.PI, 72), C.white, 1, 0.16 * fa);
  if (out.length > 0) out[0].depth = 1e6;
  const ticks: Vec3[] = [];
  for (let d = 0; d < TICKS; d++) {
    const a = ang(d);
    const l = d % 10 === 0 ? 0.35 : 0.16;
    ticks.push([R * Math.cos(a), 0, R * Math.sin(a)], [(R + l) * Math.cos(a), 0, (R + l) * Math.sin(a)]);
  }
  const before = out.length;
  pushSegments(out, cam, ticks, C.white, 1, 0.3 * fa);
  if (out.length > before) out[before].depth = 1e6 - 1;
  // The curtain: faces per group of days, one top line, a mark every fifth day.
  const upto = climbed(lt, days);
  if (days > 0 && upto > 0) {
    const topLine: Vec3[] = [];
    const marks: Vec3[] = [];
    for (let g = 0; g < Math.ceil(upto); g += GROUP) {
      const end = Math.min(upto, g + GROUP);
      const xsAt: number[] = [];
      for (let x = g; x < end; x++) xsAt.push(x);
      xsAt.push(end);
      const low: Vec3[] = [];
      const high: Vec3[] = [];
      for (let k = 0; k < xsAt.length; k++) {
        const p = at(xsAt[k], curtain, days);
        low.push([R * Math.cos(p.a), 0, R * Math.sin(p.a)]);
        high.push([R * Math.cos(p.a), p.y, R * Math.sin(p.a)]);
        if (k > 0) topLine.push(high[k - 1], high[k]);
      }
      pushFace(out, cam, low.concat(high.reverse()), C.yellow, 0.13);
    }
    for (let d = 0; d < Math.ceil(upto); d += 5) {
      const p = at(d, curtain, days);
      marks.push([R * Math.cos(p.a), 0, R * Math.sin(p.a)], [R * Math.cos(p.a), p.y, R * Math.sin(p.a)]);
    }
    pushSegments(out, cam, topLine, C.white, 2, 1);
    pushSegments(out, cam, marks, C.yellow, 1, 0.25);
  }
  // The goal: the sun's ring floating at the goal height (at the total in review).
  const crossT = closed ? crossTime(cum, days, goal) : -1;
  const closeK = closed ? inOut(seg(lt, crossT, crossT + CLOSE_DUR)) : 0;
  const show = review ? seg(lt, P1 - 0.2, P1 + 0.2) : seg(lt, 0.15, 0.6);
  if (show > 0) {
    const span = 2 * Math.PI - RING_OPEN * (1 - closeK);
    const a0 = -Math.PI / 2 + 0.5 + (2 * Math.PI - span) / 2;
    const met = closeK > 0;
    pushSegments(out, cam, ringPairs(ring, GOAL_R, a0, a0 + span, Math.ceil((72 * span) / (2 * Math.PI))), met ? C.yellow : C.white, met ? 3 : 1.5, show * (met ? 1 : review ? 0.75 : 0.55), !met && !review);
  }
  // Once closed, one pulse goes out from the ring.
  if (closed) {
    const pk = seg(lt, crossT + PULSE_FROM, crossT + PULSE_FROM + PULSE_DUR);
    if (pk > 0 && pk < 1) {
      pushSegments(out, cam, ringPairs(ring, GOAL_R * (1 + pk * PULSE_GROW), 0, 2 * Math.PI, 72), C.yellow, Math.max(1, 3 * (1 - pk)), (1 - pk) * 0.8);
    }
  }
  return out;
};

/** Scene3D's `draw`: the scene's data is [goalMs or -1, ...dailyMs]. (Module-level so the worklet guard sees it.) */
export const monthSceneDraw = (lt: number, data: number[], size: Size): Prim[] => {
  'worklet';
  return monthDraw(Math.min(lt, MONTH_STILL_AT), size, data);
};

/** The head of the curtain: where it is on screen at lt, the total so far in ms and the days climbed. */
const headState = (lt: number, data: readonly number[], screen: Size): { x: number; y: number; ms: number; upto: number } => {
  'worklet';
  const t = Math.min(lt, MONTH_STILL_AT);
  const { days, cum } = split(data);
  if (days === 0) return { x: screen.w / 2, y: screen.h * 0.3, ms: 0, upto: 0 };
  const { curtain } = monthHeights(data);
  const upto = climbed(t, days);
  const p = at(Math.min(upto, days - 0.0001), curtain, days);
  const q = project(camFor(t, screen, days), [R * Math.cos(p.a), p.y, R * Math.sin(p.a)]);
  const i = Math.min(days - 1, Math.floor(upto));
  return { x: q[0], y: q[1], ms: lerp(cum[i], cum[i + 1], Math.min(1, upto - i)), upto };
};

/** The screen box (left, right, top, bottom) of the goal ring at height `ring`. */
const ringBox = (cam: Cam, ring: number): { l: number; r: number; t: number; b: number } => {
  'worklet';
  let l = Infinity;
  let r = -Infinity;
  let t = Infinity;
  let b = -Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    const q = project(cam, [GOAL_R * Math.cos(a), ring, GOAL_R * Math.sin(a)]);
    l = Math.min(l, q[0]);
    r = Math.max(r, q[0]);
    t = Math.min(t, q[1]);
    b = Math.max(b, q[1]);
  }
  return { l, r, t, b };
};

/** The running total at local time lt as text (at the end it is the month's total). */
export const monthTotalAt = (lt: number, data: number[], screen: Size): string => {
  'worklet';
  return monthTotalText(headState(lt, data, screen).ms);
};

// The label boxes are sized from the longest text each can show (mono advance about 0.62 em).
const headWidth = (data: readonly number[], size: Size): number => {
  'worklet';
  const { days, cum } = split(data);
  return monthTotalText(cum[days]).length * monthLabelSizes(size).total * 0.62;
};

const ringWidth = (data: readonly number[], size: Size): number => {
  'worklet';
  return monthRingText(data).length * monthLabelSizes(size).ring * 0.62;
};

/**
 * Label3D's `at` for the running total: [x, y, opacity], right-aligned at x, just above the head of the curtain, kept
 * inside the screen and above the headline.
 */
export const monthHeadAt = (lt: number, data: number[], screen: Size): [number, number, number] => {
  'worklet';
  const t = Math.min(lt, MONTH_STILL_AT);
  const m = screen.w * 0.07;
  const h = headState(t, data, screen);
  const x = Math.min(screen.w - m, Math.max(m + headWidth(data, screen), h.x));
  const u = Math.min(screen.w, screen.h);
  // Just above the head; when that would be inside the ring, it eases up to above the ring's top instead.
  const natural = h.y - u * 0.05;
  const box = ringBox(camFor(t, screen, split(data).days), monthHeights(data).ring);
  const lift = box.t - u * 0.05;
  const k = seg(natural, box.b + u * 0.05, box.b - u * 0.02);
  const y = Math.min(screen.h * 0.66, Math.max(screen.h * 0.1, Math.min(natural, lerp(natural, lift, k))));
  return [x, y, h.upto > 0 ? seg(t, HEAD_FROM, HEAD_TO) : 0];
};

/**
 * Label3D's `at` for the ring's label: [x, y, opacity, colour], left-aligned at the ring's left-most point on screen and
 * just above its top-most point (clear of the ring itself), kept inside the screen; moved above the running total when
 * the two would meet.
 */
export const monthRingAt = (lt: number, data: number[], screen: Size): [number, number, number, string] => {
  'worklet';
  const t = Math.min(lt, MONTH_STILL_AT);
  const { goal, days, cum } = split(data);
  const cam = camFor(t, screen, days);
  const f = monthLabelSizes(screen);
  const u = Math.min(screen.w, screen.h);
  const m = screen.w * 0.07;
  const { ring, closed, review } = monthHeights(data);
  const { l: left, t: top } = ringBox(cam, ring);
  const w = ringWidth(data, screen);
  const x = Math.min(screen.w - m - w, Math.max(m, left - u * 0.02));
  let y = top - u * 0.035;
  // Clear of the running total (its box: right edge at its x, one text high around its y).
  const hd = monthHeadAt(t, data, screen);
  const gap = (f.total + f.ring) * 0.75;
  if (x < hd[0] && hd[0] - headWidth(data, screen) < x + w && Math.abs(y - hd[1]) < gap) y = hd[1] - gap;
  y = Math.min(screen.h * 0.66, Math.max(screen.h * 0.1, y));
  const crossT = closed ? crossTime(cum, days, goal) : -1;
  const met = closed && inOut(seg(t, crossT, crossT + CLOSE_DUR)) > 0;
  const show = review ? seg(t, P1 - 0.2, P1 + 0.2) : seg(t, 0.3, 0.6);
  return [x, y, show, met ? C.yellow : C.steel];
};

/**
 * Glow3D's `at`: a warm glow around the sun's ring as it closes on the goal (none in a review month or before the goal is
 * reached: the ring is white then). `data` is the scene's [goalMs or -1, ...dailyMs].
 */
export const monthGlowAt = (lt: number, data: number[], size: Size): Glow => {
  'worklet';
  const t = Math.min(lt, MONTH_STILL_AT);
  const { goal, days, cum } = split(data);
  const { ring, closed } = monthHeights(data);
  if (!closed) return NO_GLOW;
  const crossT = crossTime(cum, days, goal);
  const box = ringBox(camFor(t, size, days), ring);
  const rx = ((box.r - box.l) / 2) * 1.25;
  const ry = Math.max(((box.b - box.t) / 2) * 1.6, rx * 0.35);
  return safeGlow([(box.l + box.r) / 2, (box.t + box.b) / 2, rx, ry, inOut(seg(t, crossT, crossT + CLOSE_DUR))]);
};
