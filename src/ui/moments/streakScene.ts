// The Streak moment: one step per day on a spiral stair (one turn per 7 days), landing in order, today's step on top in
// gold, an amber thread climbing through the step tips, a central axis and a floor ring. Pure worklets (the UI thread
// builds the polygons each frame) and plain functions (tests call them directly).
// Ported from the `streak` scene of drafts/celebrations/close-moments-3d-v1.html. One change: the camera yaw eases to a
// stop at STREAK_STILL_AT (the bench kept turning), so Scene3D can draw the final frame once and keep it.

import { MOMENT_COLORS as C } from './colors';
import type { Size } from './parts';
import { lerp, outExpo, seg } from './timeline';
import { camera, GOLD, GRAPH, boxFaces, NO_GLOW, project, pushSegments, pushSolid, rotY, safeGlow, type Cam, type Glow, type Prim, type Vec3 } from './three';

/**
 * Prim slots the stair needs: the floor ring, the axis and the thread (one prim each) + up to 3 visible faces for each
 * of 21 steps. The measured worst case is 65 (n = 21; 5 for n = 1, 24 for 7, 45 for 14), one below this (streakScene.test.ts asserts it at every frame).
 */
export const STREAK_SLOTS = 66;
/** From this local time nothing moves (the camera has come to rest): Scene3D draws the stair once and keeps the frame. */
export const STREAK_STILL_AT = 2.6;

const STEP = Math.PI * (2 / 7); // one step turns the stair 1/7 of a turn (a plain number: no leading "(")
const LAND_FROM = 0.15; // the first step starts landing
const LAND_SPREAD = 1.2; // the last step starts this much later
const LAND_DUR = 0.4;
const THREAD_FROM = 1.45;
const THREAD_TO = 2.1;

/** Height of one step: a little tighter once the stair is more than one turn. */
const riseOf = (n: number): number => {
  'worklet';
  return n > 7 ? 0.5 : 0.62;
};

/** When step i (0 = oldest) of n starts to land. */
const landAt = (i: number, n: number): number => {
  'worklet';
  return LAND_FROM + (i / Math.max(1, n - 1)) * LAND_SPREAD;
};

/** Step i's angle on the stair: today (the last step) starts facing the camera. */
const angOf = (i: number, n: number): number => {
  'worklet';
  return -Math.PI / 2 - (n - 1 - i) * STEP;
};

/** How many of the top steps carry a weekday label: the latest week (letters repeat every 7, so older steps stay bare). */
export const STREAK_LABELLED = 7;
const THICK = 0.28; // a step's height: chunky enough that a step reads as a tread
const HALF_W = 0.8; // half its width (the bench had 0.55): wide enough that neighbours overlap like treads
const R_IN = 0.5; // inner radius of a step (the bench had 0.7)
const R_OUT = 2.6;
const DIST = 12;
const PITCH = 0.32; // lower than the bench's 0.4: steps stack up the screen instead of spreading across it
/** The stair (with room for the labels above its top) is fitted to this part of the screen height. */
const FIT = 0.52;

/**
 * The camera at local time lt: turns slowly (easing out to rest at STREAK_STILL_AT). The scale is fitted to n so the whole
 * stair fills about 0.12 h .. 0.64 h whatever its height (a 1-step stair is limited by the width instead).
 */
const camFor = (lt: number, size: Size, n: number): Cam => {
  'worklet';
  const k = seg(lt, 0, STREAK_STILL_AT);
  const topY = (n - 1) * riseOf(n);
  const hWorld = topY + 1.3; // from the floor to the label above the top step
  const extent = hWorld * Math.cos(PITCH) + 2 * 2.7 * Math.sin(PITCH); // plus the floor ring's depth
  const s = Math.min((FIT * size.h) / extent, size.w * 0.155); // pixels per scene unit at the target
  return camera({
    yaw: -1.0 + 0.9 * (1 - (1 - k) * (1 - k) * (1 - k)),
    pitch: PITCH,
    dist: DIST,
    cx: size.w / 2,
    cy: size.h * 0.36,
    f: s * DIST,
    target: [0, hWorld / 2 - 0.15, 0],
  });
};

/** A step's tip (the outer middle of its top face), where the thread passes. */
const tipOf = (i: number, n: number): Vec3 => {
  'worklet';
  return rotY(angOf(i, n), [R_OUT, i * riseOf(n) + THICK, 0]);
};

/** The stair at local time lt for n steps (1..21), as prims. The top step (today) turns gold once it has landed. */
export const streakDraw = (lt: number, size: Size, n: number): Prim[] => {
  'worklet';
  const out: Prim[] = [];
  const count = Math.max(0, Math.min(21, Math.floor(n)));
  if (count === 0) return out;
  const cam = camFor(lt, size, count);
  const rise = riseOf(count);
  const fa = seg(lt, 0, 0.4);
  // Floor ring (one prim, 64 short lines) and the central axis.
  const ring: Vec3[] = [];
  for (let k = 0; k < 64; k++) {
    const a0 = (k * 2 * Math.PI) / 64;
    const a1 = ((k + 1) * 2 * Math.PI) / 64;
    ring.push([2.7 * Math.cos(a0), 0, 2.7 * Math.sin(a0)], [2.7 * Math.cos(a1), 0, 2.7 * Math.sin(a1)]);
  }
  pushSegments(out, cam, ring, C.white, 1, 0.12 * fa);
  pushSegments(out, cam, [[0, 0, 0], [0, (count - 1) * rise + 0.7, 0]], C.steel, 1.5, 0.45 * fa);
  // The steps: each drops in from 1.6 above, in order.
  for (let i = 0; i < count; i++) {
    const k = outExpo(seg(lt, landAt(i, count), landAt(i, count) + LAND_DUR));
    if (k <= 0) continue;
    const y = i * rise + (1 - k) * 1.6;
    const a = angOf(i, count);
    const faces = boxFaces(R_IN, y, -HALF_W, R_OUT, y + THICK, HALF_W).map((f) => f.map((v) => rotY(a, v)));
    const gold = i === count - 1 && k >= 1;
    pushSolid(out, cam, faces, rotY(a, [(R_IN + R_OUT) / 2, y + THICK / 2, 0]), gold ? GOLD : GRAPH, Math.min(1, k * 1.6));
  }
  // The thread: one growing list of segments through the step tips, the last one partly drawn.
  const tk = seg(lt, THREAD_FROM, THREAD_TO) * (count - 1);
  const thread: Vec3[] = [];
  for (let i = 0; i < Math.ceil(tk); i++) {
    const p = tipOf(i, count);
    const q = tipOf(i + 1, count);
    const f = Math.min(1, tk - i);
    thread.push(p, [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)]);
  }
  pushSegments(out, cam, thread, C.yellow, 2, 0.9);
  return out;
};

/** Scene3D's `draw`: the scene's data is the number of steps. (Module-level so the worklet guard sees it.) */
export const streakSceneDraw = (lt: number, n: number, size: Size): Prim[] => {
  'worklet';
  return streakDraw(Math.min(lt, STREAK_STILL_AT), size, n);
};

/** Label font size: smaller on a stair of more than one turn, where labels sit closer together. */
export const streakLabelSize = (size: Size, n: number): number => {
  'worklet';
  return Math.max(n > 7 ? 7 : 9, Math.min(size.w, size.h) * (n > 7 ? 0.022 : 0.028));
};

/** Label3D's `at` for step i (0 = oldest) of n: [x, y, opacity, colour]; today's label is yellow. Kept inside the screen. */
export const streakLabelAt = (lt: number, i: number, n: number, screen: Size): [number, number, number, string] => {
  'worklet';
  const count = Math.max(1, Math.min(21, Math.floor(n)));
  const cam = camFor(Math.min(lt, STREAK_STILL_AT), screen, count);
  const today = i === count - 1;
  // Hangs off the step's tip: today's straight above its gold step (clear of it), the others a little above and outward.
  const y = i * riseOf(count) + THICK + (today ? 1.1 : 0.4);
  const q = project(cam, rotY(angOf(i, count), [today ? R_OUT : 3.1, y, 0]));
  const mid = project(cam, [0, y, 0]);
  // "W - TODAY" is 9 characters wide, a bare letter 1 (mono advance about 0.62 em).
  const half = ((today ? 9 : 1) * streakLabelSize(screen, count) * 0.62) / 2;
  const m = screen.w * 0.07;
  const x = Math.min(screen.w - m - half, Math.max(m + half, q[0]));
  // Above the headline (its top is near 0.69 h) and below the top chrome.
  const py = Math.min(screen.h * 0.66, Math.max(screen.h * 0.1, q[1]));
  const land = landAt(i, count);
  // A label behind the axis (farther than the stair's centre) is dimmed: it reads as the far side of the stair.
  const behind = q[2] > mid[2];
  const unlabelled = i < count - STREAK_LABELLED || i >= count;
  const o = unlabelled ? 0 : seg(lt, land + 0.2, land + 0.5) * (behind && !today ? 0.35 : 1);
  return [x, py, o, today ? C.yellow : C.steel];
};

/** Label3D's `at` adapter: `data` is [i, n]. (Module-level so the worklet guard sees it.) */
export const streakLabelOf = (lt: number, data: number[], screen: Size): [number, number, number, string] => {
  'worklet';
  return streakLabelAt(lt, data[0], data[1], screen);
};

/** Glow3D's `at`: a warm glow on today's step (the top one), appearing as it lands and turns gold. `data` is the step count. */
export const streakGlowAt = (lt: number, n: number, size: Size): Glow => {
  'worklet';
  const count = Math.max(0, Math.min(21, Math.floor(n)));
  if (count === 0) return NO_GLOW;
  const i = count - 1;
  const cam = camFor(Math.min(lt, STREAK_STILL_AT), size, count);
  const q = project(cam, rotY(angOf(i, count), [(R_IN + R_OUT) / 2, i * riseOf(count) + THICK, 0]));
  const land = landAt(i, count) + LAND_DUR;
  const r = size.w * 0.2;
  return safeGlow([q[0], q[1], r, r * 0.7, seg(lt, land, land + 0.45)]);
};
