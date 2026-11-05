// The 3D kit of the moments: a perspective camera, flat-shaded convex solids and the painter's order, as plain maths
// on numbers and arrays. Every function is a worklet so a scene can build its polygons on the UI thread each frame;
// they are also plain functions, so tests call them directly. No classes, Map/Set or returned closures (worklets
// cannot carry those). Ported from the "3D kit" of drafts/celebrations/close-moments-3d-v1.html.

export type Vec3 = [number, number, number];
export type Cam = {
  cw: number; sw: number; cp: number; sp: number; dist: number; cx: number; cy: number; f: number; tx: number; ty: number; tz: number;
};
export type Palette = { dark: [number, number, number]; light: [number, number, number] };
/**
 * One drawable: a projected polygon (2+ points; 2 = a line) with its depth for painter's order. `pts` is flat [x0, y0, x1, y1, ...].
 * With `segs` the points are pairs, each pair one separate line ("M a L b M c L d ..."), never closed, no fill: many lines
 * in one prim (ticks, a ring drawn as consecutive pairs) so they cost one slot.
 */
export type Prim = {
  pts: number[]; depth: number; fill: string; fillOpacity: number; stroke: string; strokeOpacity: number; strokeWidth: number; dashed: boolean;
  segs?: boolean;
};

export const GRAPH: Palette = { dark: [24, 27, 33], light: [104, 110, 122] };
export const GOLD: Palette = { dark: [96, 76, 16], light: [255, 222, 110] };
/** The sun's ring opening, 85 degrees. */
export const OPEN = (85 * Math.PI) / 180;

/** Nearer than this (camera depth) a point is behind or on the lens and its polygon is skipped. */
export const NEAR = 0.2;
const EDGE_OPACITY = 0.2;
const EDGE_GRAPH = '#ffffff';
const EDGE_GOLD = '#fff1b8';
// normalize([-0.45, 0.85, -0.55])
const LIGHT_LEN = Math.hypot(-0.45, 0.85, -0.55);
const LIGHT: Vec3 = [-0.45 / LIGHT_LEN, 0.85 / LIGHT_LEN, -0.55 / LIGHT_LEN];

/** yaw turns the world about the vertical axis, pitch tips it toward the camera (looking down). */
export const camera = (o: { yaw: number; pitch: number; dist: number; cx: number; cy: number; f: number; target?: Vec3 }): Cam => {
  'worklet';
  const t = o.target ?? [0, 0, 0];
  return {
    cw: Math.cos(o.yaw), sw: Math.sin(o.yaw), cp: Math.cos(o.pitch), sp: Math.sin(o.pitch),
    dist: o.dist, cx: o.cx, cy: o.cy, f: o.f, tx: t[0], ty: t[1], tz: t[2],
  };
};

/** Camera space: x right, y up, z = depth. */
export const toCam = (c: Cam, p: Vec3): Vec3 => {
  'worklet';
  const x = p[0] - c.tx;
  const y = p[1] - c.ty;
  const z = p[2] - c.tz;
  const x1 = x * c.cw - z * c.sw;
  const z1 = x * c.sw + z * c.cw;
  return [x1, y * c.cp + z1 * c.sp, -y * c.sp + z1 * c.cp + c.dist];
};

/** [screenX, screenY, depth]. Divides by depth: callers must check depth >= NEAR (and not NaN) before using x and y. */
export const project = (c: Cam, p: Vec3): Vec3 => {
  'worklet';
  const q = toCam(c, p);
  return [c.cx + (c.f * q[0]) / q[2], c.cy - (c.f * q[1]) / q[2], q[2]];
};

export const rotY = (a: number, p: Vec3): Vec3 => {
  'worklet';
  const co = Math.cos(a);
  const si = Math.sin(a);
  return [p[0] * co - p[2] * si, p[1], p[0] * si + p[2] * co];
};

const facesOf = (v: Vec3[], ix: number[][]): Vec3[][] => {
  'worklet';
  const out: Vec3[][] = [];
  for (let i = 0; i < ix.length; i++) {
    const face: Vec3[] = [];
    for (let j = 0; j < ix[i].length; j++) face.push(v[ix[i][j]]);
    out.push(face);
  }
  return out;
};

const BOX_IX = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
const SLICE_IX = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

/** The six faces of an axis-aligned box. */
export const boxFaces = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vec3[][] => {
  'worklet';
  return facesOf([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], BOX_IX);
};

/** A narrow slice of a ring as a prism (narrow enough to treat as convex). */
export const sliceFaces = (r0: number, r1: number, a0: number, a1: number, y0: number, y1: number): Vec3[][] => {
  'worklet';
  const c0 = Math.cos(a0);
  const s0 = Math.sin(a0);
  const c1 = Math.cos(a1);
  const s1 = Math.sin(a1);
  const v: Vec3[] = [
    [r0 * c0, y0, r0 * s0], [r1 * c0, y0, r1 * s0], [r1 * c1, y0, r1 * s1], [r0 * c1, y0, r0 * s1],
    [r0 * c0, y1, r0 * s0], [r1 * c0, y1, r1 * s0], [r1 * c1, y1, r1 * s1], [r0 * c1, y1, r0 * s1],
  ];
  return facesOf(v, SLICE_IX);
};

const shade = (pal: Palette, k: number): string => {
  'worklet';
  const r = Math.round(pal.dark[0] + (pal.light[0] - pal.dark[0]) * k);
  const g = Math.round(pal.dark[1] + (pal.light[1] - pal.dark[1]) * k);
  const b = Math.round(pal.dark[2] + (pal.light[2] - pal.dark[2]) * k);
  return `rgb(${r},${g},${b})`;
};

// A worklet gets a copy of the palette objects, so GOLD is told apart by value, not identity. Any other palette
// (custom ones included) gets the white edge.
const isGold = (pal: Palette): boolean => {
  'worklet';
  return pal.light[0] === GOLD.light[0] && pal.light[1] === GOLD.light[1] && pal.light[2] === GOLD.light[2];
};

const visible = (opacity: number): boolean => {
  'worklet';
  return opacity > 0 && opacity < Infinity;
};

/** Absolute area of the polygon `flat` (shoelace). */
const area = (flat: number[]): number => {
  'worklet';
  let a = 0;
  for (let i = 0; i < flat.length; i += 2) {
    const j = (i + 2) % flat.length;
    a += flat[i] * flat[j + 1] - flat[j] * flat[i + 1];
  }
  return Math.abs(a) / 2;
};

/** Appends the faces of a convex solid that face the camera, flat-shaded from `pal` (dark, light rgb). `center` orients each face outward. */
export const pushSolid = (out: Prim[], c: Cam, faces: Vec3[][], center: Vec3, pal: Palette, alpha: number): void => {
  'worklet';
  if (!visible(alpha)) return;
  const cc = toCam(c, center);
  const edge = isGold(pal) ? EDGE_GOLD : EDGE_GRAPH;
  for (let i = 0; i < faces.length; i++) {
    const pts = faces[i];
    const n = pts.length;
    if (n < 3) continue;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (let j = 0; j < n; j++) {
      fx += pts[j][0] / n;
      fy += pts[j][1] / n;
      fz += pts[j][2] / n;
    }
    const fcc = toCam(c, [fx, fy, fz]);
    // A face turned away from the camera: its centre lies beyond the solid's centre along the view ray.
    if ((fcc[0] - cc[0]) * fcc[0] + (fcc[1] - cc[1]) * fcc[1] + (fcc[2] - cc[2]) * fcc[2] >= 0) continue;
    const ax = pts[1][0] - pts[0][0];
    const ay = pts[1][1] - pts[0][1];
    const az = pts[1][2] - pts[0][2];
    const bx = pts[2][0] - pts[0][0];
    const by = pts[2][1] - pts[0][1];
    const bz = pts[2][2] - pts[0][2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz);
    // All points equal or collinear: no area, no normal.
    if (!(len > 1e-9)) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    if (nx * (fx - center[0]) + ny * (fy - center[1]) + nz * (fz - center[2]) < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const k = 0.22 + 0.78 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const flat: number[] = [];
    let near = false;
    for (let j = 0; j < n; j++) {
      const q = project(c, pts[j]);
      if (!(q[2] >= NEAR)) near = true;
      flat.push(q[0], q[1]);
    }
    if (near || area(flat) < 1e-6) continue;
    out.push({ pts: flat, depth: fcc[2], fill: shade(pal, k), fillOpacity: alpha, stroke: edge, strokeOpacity: EDGE_OPACITY, strokeWidth: 1, dashed: false });
  }
};

/** A flat translucent face (glass, curtains). */
export const pushFace = (out: Prim[], c: Cam, pts: Vec3[], fill: string, fillOpacity: number): void => {
  'worklet';
  if (pts.length < 3 || !visible(fillOpacity)) return;
  const flat: number[] = [];
  let depth = 0;
  for (let j = 0; j < pts.length; j++) {
    const q = project(c, pts[j]);
    if (!(q[2] >= NEAR)) return;
    flat.push(q[0], q[1]);
    depth += q[2] / pts.length;
  }
  if (area(flat) < 1e-6) return;
  out.push({ pts: flat, depth, fill, fillOpacity, stroke: 'none', strokeOpacity: 0, strokeWidth: 0, dashed: false });
};

export const pushLine = (out: Prim[], c: Cam, a: Vec3, b: Vec3, stroke: string, width: number, opacity: number, dashed: boolean = false): void => {
  'worklet';
  if (!visible(opacity)) return;
  const pa = project(c, a);
  const pb = project(c, b);
  if (!(pa[2] >= NEAR) || !(pb[2] >= NEAR)) return;
  // A hair nearer than the faces at the same depth, so a line on a face draws over it.
  out.push({
    pts: [pa[0], pa[1], pb[0], pb[1]], depth: (pa[2] + pb[2]) / 2 - 0.001, fill: 'none', fillOpacity: 0,
    stroke, strokeOpacity: opacity, strokeWidth: width, dashed,
  });
};

/**
 * Many lines as ONE prim. `pairs` is [a0, b0, a1, b1, ...] (even length); a pair with an end behind the lens is skipped; the
 * depth is the mean depth of the points kept. Nothing is pushed when no pair is left. A ring is drawn as consecutive pairs.
 */
export const pushSegments = (out: Prim[], c: Cam, pairs: Vec3[], stroke: string, width: number, opacity: number, dashed: boolean = false): void => {
  'worklet';
  if (!visible(opacity)) return;
  const flat: number[] = [];
  let depth = 0;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const pa = project(c, pairs[i]);
    const pb = project(c, pairs[i + 1]);
    if (!(pa[2] >= NEAR) || !(pb[2] >= NEAR)) continue;
    flat.push(pa[0], pa[1], pb[0], pb[1]);
    depth += pa[2] + pb[2];
  }
  if (flat.length === 0) return;
  out.push({ pts: flat, depth: depth / (flat.length / 2) - 0.001, fill: 'none', fillOpacity: 0, stroke, strokeOpacity: opacity, strokeWidth: width, dashed, segs: true });
};

/** A horizontal arc at height y, angles in radians, as short lines (`segs` per full turn). */
export const pushArc = (out: Prim[], c: Cam, y: number, r: number, a0: number, a1: number, stroke: string, width: number, opacity: number, segs: number = 64): void => {
  'worklet';
  if (a0 === a1 || !(segs >= 1)) return;
  const n = Math.max(2, Math.ceil((segs * Math.abs(a1 - a0)) / (2 * Math.PI)));
  for (let i = 0; i < n; i++) {
    const u0 = a0 + (a1 - a0) * (i / n);
    const u1 = a0 + (a1 - a0) * ((i + 1) / n);
    pushLine(out, c, [r * Math.cos(u0), y, r * Math.sin(u0)], [r * Math.cos(u1), y, r * Math.sin(u1)], stroke, width, opacity);
  }
};

/** Far to near (painter's order), stable for equal depths. Sorts `ps` in place and returns it. */
export const sortPrims = (ps: Prim[]): Prim[] => {
  'worklet';
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i];
    let j = i - 1;
    while (j >= 0 && ps[j].depth < p.depth) {
      ps[j + 1] = ps[j];
      j--;
    }
    ps[j + 1] = p;
  }
  return ps;
};

/** The `n` nearest prims, far to near. When there are more than `n` the farthest are dropped. */
export const nearest = (ps: Prim[], n: number): Prim[] => {
  'worklet';
  sortPrims(ps);
  return ps.length > n ? ps.slice(ps.length - n) : ps;
};

const num = (v: number): number => {
  'worklet';
  return Math.round(v * 100) / 100;
};

/**
 * "M x y L x y ... Z" (no Z for 2 points, a line). Fewer than 2 points or a non-finite value gives "M0 0", which draws nothing.
 * `segs`: pairs of points, each one line, never closed ("M a L b M c L d").
 */
export const pathOf = (pts: number[], segs: boolean = false): string => {
  'worklet';
  if (pts.length < 4) return 'M0 0';
  for (let i = 0; i < pts.length; i++) if (!(Math.abs(pts[i]) < Infinity)) return 'M0 0';
  if (segs) {
    let d = '';
    for (let i = 0; i + 3 < pts.length; i += 4) d += `${i > 0 ? ' ' : ''}M${num(pts[i])} ${num(pts[i + 1])} L${num(pts[i + 2])} ${num(pts[i + 3])}`;
    return d;
  }
  let d = `M${num(pts[0])} ${num(pts[1])}`;
  for (let i = 2; i + 1 < pts.length; i += 2) d += ` L${num(pts[i])} ${num(pts[i + 1])}`;
  return pts.length > 4 ? `${d} Z` : d;
};

/**
 * A glow around a gold piece (user request 2026-11-05): [x, y, rx, ry, opacity] in screen pixels. Scenes return one
 * from their `...GlowAt` worklet; Glow3D draws it as a soft yellow radial gradient. Opacity 0 draws nothing.
 */
export type Glow = [number, number, number, number, number];

/** No glow (also the answer whenever a computed value is not finite). */
export const NO_GLOW: Glow = [0, 0, 0, 0, 0];

/** The glow, or NO_GLOW when any value is not a finite number (Android's SVG drawing rejects NaN). */
export const safeGlow = (g: Glow): Glow => {
  'worklet';
  for (let i = 0; i < 5; i++) if (!Number.isFinite(g[i])) return NO_GLOW;
  return g[4] > 0 ? g : NO_GLOW;
};
