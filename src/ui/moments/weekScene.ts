// The Week complete dial: a safe dial, one wedge per day as tall as that day's focus. It spins, lands on Sunday and
// locks. Pure worklets (the UI thread builds the polygons each frame) and plain functions (tests call them directly).
// Ported from the `week` scene of drafts/celebrations/close-moments-3d-v1.html, with the app's real daily focus.

import { MOMENT_COLORS as C } from './colors';
import type { Size } from './parts';
import { lerp, outExpo, seg } from './timeline';
import { camera, GOLD, GRAPH, project, pushFace, pushSegments, pushSolid, safeGlow, sliceFaces, type Cam, type Glow, type Prim, type Vec3 } from './three';

/**
 * Prim slots the week scene needs: the rim ring (2 prims) + ticks (4) + 14 wedge slices x up to 3 visible faces + the
 * index. The measured worst case is just below this (weekScene.test.ts asserts it at every frame).
 */
export const WEEK_SLOTS = 56;
/** From this local time the dial no longer moves (the lock wobble ends): Scene3D draws it once and keeps the frame. */
export const WEEK_STILL_AT = 1.95;
/** Weekday letters on the rim, Monday first. */
export const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const SEC = Math.PI * (2 / 7); // a plain number: no leading "(" (the worklet guard reads that as a function)
const GAP = 0.045;
const R0 = 1.25;
const R1 = 3.0;
const LOCK_AT = 1.5;
const PARTS = 2; // two slices per wedge: ~0.8 rad wide, still convex
const RIM_SEGS = 32; // per half
const TICKS = 70;
const MIN_H = 0.2;
const MAX_EXTRA = 1.5;

/** A usable focus value: a finite number of ms, never negative. Anything else is no focus. */
const clean = (v: number): number => {
  'worklet';
  return v > 0 && v < Infinity ? v : 0;
};

/** Wedge heights in scene units for each day Monday..Sunday: 0.2 + 1.5 * dayMs / max (max of the week, at least 1). */
export const wedgeHeights = (dailyMs: readonly number[]): number[] => {
  'worklet';
  let max = 1;
  for (let i = 0; i < dailyMs.length; i++) max = Math.max(max, clean(dailyMs[i]));
  const out: number[] = [];
  for (let i = 0; i < dailyMs.length; i++) out.push(MIN_H + (MAX_EXTRA * clean(dailyMs[i])) / max);
  return out;
};

/** Dial rotation at local time lt: spins in from 2.8 rad away, lands with Sunday at the front, wobbles as it locks. */
const rotAt = (lt: number): number => {
  'worklet';
  const lock = -Math.PI / 2 - 6.5 * SEC;
  const wob = seg(lt, LOCK_AT, LOCK_AT + 0.45);
  return lock - (1 - outExpo(seg(lt, 0.1, LOCK_AT))) * 2.8 + Math.sin(wob * Math.PI * 3) * 0.05 * (1 - wob);
};

const camFor = (size: Size): Cam => {
  'worklet';
  return camera({ yaw: 0, pitch: 0.66, dist: 10.5, cx: size.w / 2, cy: size.h * 0.36, f: size.w * 1.08, target: [0, 0.45, 0] });
};

/** The dial at local time lt (spin, extrude, lock on Sunday at 1.5 s, index, ticks), as prims. Sunday turns gold at the lock. */
export const weekDraw = (lt: number, size: Size, dailyMs: readonly number[]): Prim[] => {
  'worklet';
  const out: Prim[] = [];
  const cam = camFor(size);
  const rot = rotAt(lt);
  const fa = seg(lt, 0, 0.35);
  const locked = lt >= LOCK_AT;
  // Rim ring and ticks, each in a back half (farther than the dial's centre, z >= 0) and a front half, so the wedges paint
  // between them in the right order. The ring is consecutive pairs, the ticks are 4 prims (long/short x back/front).
  for (let half = 0; half < 2; half++) {
    const ring: Vec3[] = [];
    for (let k = 0; k < RIM_SEGS; k++) {
      const u0 = Math.PI * (half + k / RIM_SEGS);
      const u1 = Math.PI * (half + (k + 1) / RIM_SEGS);
      ring.push([3.3 * Math.cos(u0), 0, 3.3 * Math.sin(u0)], [3.3 * Math.cos(u1), 0, 3.3 * Math.sin(u1)]);
    }
    pushSegments(out, cam, ring, C.white, 1, 0.22 * fa);
  }
  for (let kind = 0; kind < 4; kind++) {
    const long = kind < 2;
    const back = kind % 2 === 0;
    const r1 = long ? 3.5 : 3.36;
    const ticks: Vec3[] = [];
    for (let i = 0; i < TICKS; i++) {
      if ((i % 10 === 0) !== long) continue;
      const a = rot + (i * 2 * Math.PI) / TICKS;
      if ((Math.sin(a) >= 0) !== back) continue;
      ticks.push([3.18 * Math.cos(a), 0, 3.18 * Math.sin(a)], [r1 * Math.cos(a), 0, r1 * Math.sin(a)]);
    }
    pushSegments(out, cam, ticks, C.white, 1, (long ? 0.45 : 0.18) * fa);
  }
  const heights = wedgeHeights(dailyMs);
  for (let i = 0; i < 7; i++) {
    const h = (i < heights.length ? heights[i] : MIN_H) * outExpo(seg(lt, 0.15 + i * 0.1, 0.85 + i * 0.1));
    if (h < 0.01) continue;
    const a0 = rot + i * SEC + GAP;
    const a1 = rot + (i + 1) * SEC - GAP;
    for (let p = 0; p < PARTS; p++) {
      const b0 = lerp(a0, a1, p / PARTS);
      const b1 = lerp(a0, a1, (p + 1) / PARTS);
      const bm = (b0 + b1) / 2;
      const rm = (R0 + R1) / 2;
      pushSolid(out, cam, sliceFaces(R0, R1, b0, b1, 0, h), [rm * Math.cos(bm), h / 2, rm * Math.sin(bm)], i === 6 && locked ? GOLD : GRAPH, 1);
    }
  }
  // The index at the front: lights when the dial locks.
  const ik = seg(lt, LOCK_AT, LOCK_AT + 0.25);
  pushFace(out, cam, [[0, 0, -3.62], [-0.22, 0, -4.0], [0.22, 0, -4.0]], ik > 0 ? C.yellow : C.steel, 0.5 + 0.5 * ik);
  return out;
};

/** Scene3D's `draw`: the scene's data is the daily focus. (Module-level so the worklet guard sees it.) */
export const weekSceneDraw = (lt: number, dailyMs: number[], size: Size): Prim[] => {
  'worklet';
  return weekDraw(Math.min(lt, WEEK_STILL_AT), size, dailyMs);
};

/** Label3D's `at` for the weekday letter `i` (0 = Monday) on the rim: [x, y, opacity, colour]. Sunday goes yellow at the lock. */
export const weekLetterAt = (lt: number, i: number, screen: Size): [number, number, number, string] => {
  'worklet';
  const a = rotAt(Math.min(lt, WEEK_STILL_AT)) + (i + 0.5) * SEC;
  const q = project(camFor(screen), [3.85 * Math.cos(a), 0, 3.85 * Math.sin(a)]);
  return [q[0], q[1], seg(lt, 0, 0.35), i === 6 && lt >= LOCK_AT ? C.yellow : C.steel];
};

/** Glow3D's `at`: a warm glow on Sunday's wedge, appearing as the dial locks and it turns gold. `data` is the daily focus. */
export const weekGlowAt = (lt: number, dailyMs: number[], size: Size): Glow => {
  'worklet';
  const t = Math.min(lt, WEEK_STILL_AT);
  const heights = wedgeHeights(dailyMs);
  const h = heights.length > 6 ? heights[6] : MIN_H;
  const a = rotAt(t) + 6.5 * SEC;
  const rm = (R0 + R1) / 2;
  const q = project(camFor(size), [rm * Math.cos(a), h, rm * Math.sin(a)]);
  const r = size.w * 0.2;
  return safeGlow([q[0], q[1], r, r * 0.7, seg(lt, LOCK_AT, LOCK_AT + 0.35)]);
};
