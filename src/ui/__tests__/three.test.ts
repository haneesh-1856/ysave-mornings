import {
  boxFaces, NEAR, camera, GOLD, GRAPH, nearest, OPEN, pathOf, project, pushArc, pushFace, pushLine, pushSegments, pushSolid, rotY, sliceFaces, sortPrims, toCam,
  type Prim, type Vec3,
} from '../moments/three';

const cam = (o: Partial<Parameters<typeof camera>[0]> = {}) => camera({ yaw: 0, pitch: 0, dist: 10, cx: 200, cy: 300, f: 400, ...o });
const prim = (depth: number, tag = ''): Prim => ({ pts: [0, 0, 1, 1], depth, fill: tag, fillOpacity: 1, stroke: 'none', strokeOpacity: 0, strokeWidth: 0, dashed: false });
const rgb = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('projection', () => {
  it('puts the target on the screen centre at the camera distance', () => {
    expect(project(cam(), [0, 0, 0])).toEqual([200, 300, 10]);
  });

  it('moves the camera target with the target offset', () => {
    const c = cam({ target: [3, 2, -1] });
    expect(project(c, [3, 2, -1])).toEqual([200, 300, 10]);
    // 1 unit right of the target at depth 10 is f/10 pixels right
    expect(project(c, [4, 2, -1])[0]).toBeCloseTo(240);
  });

  it('scales by focal length over depth: x right is screen right, y up is screen up', () => {
    const [x, y] = project(cam(), [1, 1, 0]);
    expect(x).toBeCloseTo(240);
    expect(y).toBeCloseTo(260);
  });

  it('a point higher up appears higher on screen (smaller y)', () => {
    const c = cam({ pitch: 0.5 });
    expect(project(c, [0, 2, 0])[1]).toBeLessThan(project(c, [0, 0, 0])[1]);
  });

  it('looking down, a far floor point appears higher than a near one', () => {
    const c = cam({ pitch: 0.6 });
    // yaw 0: +z is away from the camera, -z toward it
    const far = project(c, [0, 0, 3]);
    const near = project(c, [0, 0, -3]);
    expect(far[1]).toBeLessThan(near[1]);
    expect(far[2]).toBeGreaterThan(near[2]);
  });

  it('toCam gives depth = dist at the target and turns with yaw', () => {
    expect(toCam(cam(), [0, 0, 0])).toEqual([0, 0, 10]);
    const q = toCam(cam({ yaw: Math.PI / 2 }), [1, 0, 0]);
    expect(q[0]).toBeCloseTo(0);
    expect(q[2]).toBeCloseTo(11);
  });

  it('rotY turns about the vertical axis and keeps height', () => {
    const p = rotY(Math.PI / 2, [1, 5, 0]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBe(5);
    expect(p[2]).toBeCloseTo(1);
  });

  it('OPEN is 85 degrees', () => {
    expect(OPEN).toBeCloseTo(1.4835, 3);
  });
});

describe('solids', () => {
  const box = boxFaces(-1, 0, -1, 1, 2, 1);
  const center: Vec3 = [0, 1, 0];

  it('boxFaces and sliceFaces have six quads', () => {
    expect(box).toHaveLength(6);
    expect(box.every((f) => f.length === 4)).toBe(true);
    const s = sliceFaces(1, 2, 0, 0.3, 0, 1);
    expect(s).toHaveLength(6);
    expect(s.every((f) => f.length === 4)).toBe(true);
  });

  it('a box seen from a corner view yields exactly 3 faces', () => {
    const out: Prim[] = [];
    pushSolid(out, cam({ yaw: 0.6, pitch: 0.5 }), box, center, GRAPH, 1);
    expect(out).toHaveLength(3);
    for (const p of out) expect(p.pts).toHaveLength(8);
  });

  it('culls the back faces: head on a box shows only the front face', () => {
    const out: Prim[] = [];
    pushSolid(out, cam(), box, center, GRAPH, 1);
    expect(out).toHaveLength(1);
  });

  it('a ring slice seen from above shows 2 or 3 faces', () => {
    const out: Prim[] = [];
    pushSolid(out, cam({ yaw: 0.3, pitch: 0.7 }), sliceFaces(1, 2, 0, 0.3, 0, 1), [1.5 * Math.cos(0.15), 0.5, 1.5 * Math.sin(0.15)], GRAPH, 1);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('shades every face inside the palette range, and faces differ in brightness', () => {
    for (const pal of [GRAPH, GOLD]) {
      const out: Prim[] = [];
      pushSolid(out, cam({ yaw: 0.6, pitch: 0.5 }), box, center, pal, 1);
      for (const p of out) {
        const c = rgb(p.fill);
        for (let i = 0; i < 3; i++) {
          expect(c[i]).toBeGreaterThanOrEqual(Math.min(pal.dark[i], pal.light[i]));
          expect(c[i]).toBeLessThanOrEqual(Math.max(pal.dark[i], pal.light[i]));
        }
      }
    }
    const out: Prim[] = [];
    pushSolid(out, cam({ yaw: 0.6, pitch: 0.5 }), box, center, GRAPH, 1);
    const reds = out.map((p) => rgb(p.fill)[0]);
    expect(Math.max(...reds)).toBeGreaterThan(Math.min(...reds));
  });

  it('draws a thin edge: white for graphite, pale gold for gold; alpha goes to the fill', () => {
    const g: Prim[] = [];
    const y: Prim[] = [];
    pushSolid(g, cam({ yaw: 0.6, pitch: 0.5 }), box, center, GRAPH, 0.5);
    pushSolid(y, cam({ yaw: 0.6, pitch: 0.5 }), box, center, GOLD, 1);
    expect(g[0]).toMatchObject({ stroke: '#ffffff', strokeOpacity: 0.2, strokeWidth: 1, fillOpacity: 0.5, dashed: false });
    expect(y[0]).toMatchObject({ stroke: '#fff1b8', strokeOpacity: 0.2, strokeWidth: 1 });
  });

  it('skips faces with a point nearer than the near plane', () => {
    const out: Prim[] = [];
    // camera 10 away; z = -9.95 is 0.05 from the lens
    pushSolid(out, cam(), boxFaces(-1, 0, -9.95, 1, 2, -9), [0, 1, -9.5], GRAPH, 1);
    expect(out).toHaveLength(0);
  });

  it('pushFace skips near-plane polygons and uses the mean depth', () => {
    const out: Prim[] = [];
    pushFace(out, cam(), [[0, 0, -9.9], [1, 0, 0], [1, 1, 0]], '#fff', 0.5);
    expect(out).toHaveLength(0);
    pushFace(out, cam(), [[0, 0, 0], [1, 0, 2], [1, 1, 4]], '#fff', 0.5);
    expect(out).toHaveLength(1);
    expect(out[0].depth).toBeCloseTo(12);
    expect(out[0].pts).toHaveLength(6);
  });
});

describe('exact shading', () => {
  // A square plane through the origin whose normal is the light direction.
  const L = (() => { const l = Math.hypot(-0.45, 0.85, -0.55); return [-0.45 / l, 0.85 / l, -0.55 / l] as Vec3; })();
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  const u = unit(cross(L, [0, 1, 0]));
  const v = cross(L, u);
  const quad: Vec3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [u[0] * a + v[0] * b, u[1] * a + v[1] * b, u[2] * a + v[2] * b] as Vec3);
  const mix = (k: number) => GRAPH.dark.map((d, i) => Math.round(d + (GRAPH.light[i] - d) * k));

  it('a face whose normal is the light gets the light colour (k = 1)', () => {
    const out: Prim[] = [];
    pushSolid(out, cam(), [quad], [-L[0], -L[1], -L[2]], GRAPH, 1);
    expect(out).toHaveLength(1);
    expect(rgb(out[0].fill)).toEqual([...GRAPH.light]);
  });

  it('a face turned away from the light gets k = 0.22', () => {
    const out: Prim[] = [];
    pushSolid(out, cam({ yaw: Math.PI }), [quad], [L[0], L[1], L[2]], GRAPH, 1);
    expect(out).toHaveLength(1);
    expect(rgb(out[0].fill)).toEqual(mix(0.22));
  });
});

describe('edge cases', () => {
  it('NEAR is 0.2', () => {
    expect(NEAR).toBe(0.2);
  });

  it('pushArc with equal angles draws nothing', () => {
    const out: Prim[] = [];
    pushArc(out, cam(), 0, 2, 1, 1, '#fff', 1, 1);
    pushArc(out, cam(), 0, 2, 0, 3, '#fff', 1, 1, 0);
    expect(out).toHaveLength(0);
  });

  it('empty faces and zero-area faces draw nothing', () => {
    const out: Prim[] = [];
    pushSolid(out, cam(), [], [0, 0, 0], GRAPH, 1);
    pushSolid(out, cam(), [[[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]], [0, 0, 0], GRAPH, 1);
    pushSolid(out, cam(), [[[0, 0, 0], [1, 0, 0], [2, 0, 0]]], [0, 1, 0], GRAPH, 1);
    pushFace(out, cam(), [[1, 1, 1], [1, 1, 1], [1, 1, 1]], '#fff', 1);
    pushFace(out, cam(), [], '#fff', 1);
    expect(out).toHaveLength(0);
  });

  it('a box partly behind the lens is skipped face by face, never half drawn', () => {
    const out: Prim[] = [];
    pushSolid(out, cam(), boxFaces(-1, 0, -12, 1, 2, 2), [0, 1, -5], GRAPH, 1);
    for (const p of out) expect(p.pts.every(Number.isFinite)).toBe(true);
    expect(out.length).toBeLessThan(3);
  });

  it('NaN points and non-finite or zero opacities are skipped', () => {
    const out: Prim[] = [];
    pushLine(out, cam(), [NaN, 0, 0], [1, 0, 0], '#fff', 1, 1);
    pushFace(out, cam(), [[NaN, 0, 0], [1, 0, 0], [1, 1, 0]], '#fff', 1);
    pushSolid(out, cam(), boxFaces(NaN, 0, 0, 1, 1, 1), [0, 0, 0], GRAPH, 1);
    pushLine(out, cam(), [0, 0, 0], [1, 0, 0], '#fff', 1, NaN);
    pushLine(out, cam(), [0, 0, 0], [1, 0, 0], '#fff', 1, Infinity);
    pushFace(out, cam(), [[0, 0, 0], [1, 0, 0], [1, 1, 0]], '#fff', 0);
    pushSolid(out, cam({ yaw: 0.6, pitch: 0.5 }), boxFaces(-1, 0, -1, 1, 2, 1), [0, 1, 0], GRAPH, NaN);
    expect(out).toHaveLength(0);
  });

  it('nearest(ps, 0) is empty', () => {
    expect(nearest([prim(1), prim(2)], 0)).toEqual([]);
  });

  it('pathOf of fewer than 2 points or a non-finite value is the empty path', () => {
    expect(pathOf([])).toBe('M0 0');
    expect(pathOf([1, 2])).toBe('M0 0');
    expect(pathOf([0, 0, NaN, 1, 2, 3])).toBe('M0 0');
    expect(pathOf([0, 0, Infinity, 1])).toBe('M0 0');
  });
});

describe('lines and arcs', () => {
  it('pushLine makes a 2 point prim a hair nearer than its mean depth, and skips zero opacity and near points', () => {
    const out: Prim[] = [];
    pushLine(out, cam(), [0, 0, 0], [1, 0, 2], '#fff', 2, 0.5, true);
    expect(out).toHaveLength(1);
    expect(out[0].pts).toHaveLength(4);
    expect(out[0].depth).toBeCloseTo(11 - 0.001);
    expect(out[0]).toMatchObject({ strokeWidth: 2, strokeOpacity: 0.5, dashed: true });
    pushLine(out, cam(), [0, 0, 0], [1, 0, 2], '#fff', 2, 0);
    pushLine(out, cam(), [0, 0, 0], [1, 0, -9.9], '#fff', 2, 1);
    expect(out).toHaveLength(1);
  });

  it('pushArc makes one line per segment: 64 for a full turn, 32 for half, at least 2', () => {
    const full: Prim[] = [];
    pushArc(full, cam(), 0, 2, 0, 2 * Math.PI, '#fff', 1, 1);
    expect(full).toHaveLength(64);
    const half: Prim[] = [];
    pushArc(half, cam(), 0, 2, 0, Math.PI, '#fff', 1, 1);
    expect(half).toHaveLength(32);
    const tiny: Prim[] = [];
    pushArc(tiny, cam(), 0, 2, 0, 0.01, '#fff', 1, 1);
    expect(tiny).toHaveLength(2);
    const custom: Prim[] = [];
    pushArc(custom, cam(), 0, 2, 0, 2 * Math.PI, '#fff', 1, 1, 12);
    expect(custom).toHaveLength(12);
  });
});

describe('painter order', () => {
  it('sorts far to near and is stable for equal depths', () => {
    const ps = [prim(3, 'a'), prim(9, 'b'), prim(3, 'c'), prim(5, 'd'), prim(9, 'e')];
    expect(sortPrims(ps).map((p) => p.fill)).toEqual(['b', 'e', 'd', 'a', 'c']);
  });

  it('nearest keeps the n nearest, far to near, and drops the farthest', () => {
    const ps = [prim(3, 'a'), prim(9, 'b'), prim(1, 'c'), prim(5, 'd')];
    expect(nearest(ps, 2).map((p) => p.fill)).toEqual(['a', 'c']);
    expect(nearest([prim(2, 'x'), prim(1, 'y')], 5)).toHaveLength(2);
    expect(nearest([], 3)).toEqual([]);
  });
});

describe('pathOf', () => {
  it('closes a polygon', () => {
    expect(pathOf([0, 0, 10, 0, 10, 5, 0, 5])).toBe('M0 0 L10 0 L10 5 L0 5 Z');
  });
  it('leaves a 2 point line open', () => {
    expect(pathOf([1, 2, 3.456, 4])).toBe('M1 2 L3.46 4');
  });
});

describe('pushSegments and pathOf segs', () => {
  const c = cam({ pitch: 0.5 });

  it('pushes ONE open prim with a pair per line and the mean depth', () => {
    const out: Prim[] = [];
    pushSegments(out, c, [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], '#fff', 1, 0.5);
    expect(out).toHaveLength(1);
    expect(out[0].segs).toBe(true);
    expect(out[0].pts).toHaveLength(8);
    expect(out[0].fill).toBe('none');
    const a = project(c, [0, 0, 0])[2];
    const b = project(c, [0, 0, 1])[2];
    expect(out[0].depth).toBeCloseTo((a + b) / 2 - 0.001);
  });

  it('skips a pair behind the lens, pushes nothing when none is left or the opacity is 0', () => {
    const out: Prim[] = [];
    pushSegments(out, c, [[0, 0, 0], [1, 0, 0], [0, 0, -100], [1, 0, -100]], '#fff', 1, 1);
    expect(out[0].pts).toHaveLength(4);
    const none: Prim[] = [];
    pushSegments(none, c, [[0, 0, -100], [1, 0, -100]], '#fff', 1, 1);
    pushSegments(none, c, [[0, 0, 0], [1, 0, 0]], '#fff', 1, 0);
    expect(none).toHaveLength(0);
  });

  it('pathOf draws pairs as separate lines, never closed', () => {
    expect(pathOf([0, 0, 10, 0, 20, 5, 30, 5], true)).toBe('M0 0 L10 0 M20 5 L30 5');
    expect(pathOf([0, 0, 10, 0, 20, 5, NaN, 5], true)).toBe('M0 0');
    expect(pathOf([0, 0, 10, 0, 10, 10])).toBe('M0 0 L10 0 L10 10 Z');
  });
});
