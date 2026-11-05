# M9 contract · Week complete (3D)

Binding interfaces between chunks. Layering stays: `src/ui` and screens never import `src/data` or `getDb`; only
`src/state` calls repos, `now()`, `newId()`. Every function an animated callback calls must be a worklet
(`src/ui/__tests__/momentsWorklets.test.ts` checks every file directly in `src/ui/moments/`).

**Data rule (user, 2026-11-02):** everything a moment shows is the user's real stored data. No sample, padded or
invented values. Where there is nothing (a day with no row, no focus), show zero, never a made-up value.

## Chunk 1 · Week data
Files: `src/domain/moments.ts`, `src/domain/__tests__/moments.test.ts`, `src/state/__tests__/momentsData.test.ts` (new).

```ts
// src/domain/moments.ts: the week variant gains one field
| { kind: 'week'; weekStart: DayKey; tasksDone: number; focusedMs: number; goldRings: number; daysShowedUp: number;
    /** Focused ms of each day Monday..Sunday (index 0 = weekStart). 0 for a day with no row. Sums to focusedMs. */
    dailyMs: number[] }
```
- Computed from `input.weekBundles` with the same per-day sum (`bundleFocusMs`) already used for `focusedMs`, keyed by
  `dayKey` (bundles may be missing or out of order). Length is always 7.
- Domain tests: length 7, Monday first, missing days 0, sum equals `focusedMs`, out-of-order bundles.
- **Data trace test** `src/state/__tests__/momentsData.test.ts`: builds a real Monday-Sunday week through the app's
  actions (`createTopic`, `createTask`, `reconcile`, `startTask`, `stopTask`, checklist ticks, `closeToday`), with:
  a day with no row (app not opened), a checklist-only day (shows up, 0 focus), a gold ring (overtime >= 60 s),
  an auto-closed day, and a task still running at Sunday's close. Closes Sunday by hand and asserts every week field
  (`tasksDone`, `focusedMs`, `goldRings`, `daysShowedUp`, `dailyMs`, `weekStart`) against values worked out by hand
  in the test's comments. Uses the same fixture style as `src/state/__tests__/moments.test.ts`.
- Nothing in ui changes. `momentText` keeps working (it reads only existing fields).

## Chunk 2 · 3D kit
Files: `src/ui/moments/three.ts` (pure worklets), `src/ui/moments/Scene3D.tsx`, `src/ui/__tests__/three.test.ts`,
`src/ui/__tests__/Scene3D.test.tsx`. Geometry and maths follow the bench's "3D kit" section.

```ts
// src/ui/moments/three.ts: every exported function has the 'worklet' directive; plain numbers and arrays only.
export type Vec3 = [number, number, number];
export type Cam = { cw: number; sw: number; cp: number; sp: number; dist: number; cx: number; cy: number; f: number; tx: number; ty: number; tz: number };
/** yaw turns the world about the vertical axis, pitch tips it toward the camera (looking down). */
export function camera(o: { yaw: number; pitch: number; dist: number; cx: number; cy: number; f: number; target?: Vec3 }): Cam;
export function toCam(c: Cam, p: Vec3): Vec3;            // camera space: x right, y up, z = depth
export function project(c: Cam, p: Vec3): Vec3;          // [screenX, screenY, depth]
export function rotY(a: number, p: Vec3): Vec3;
export function boxFaces(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Vec3[][];
export function sliceFaces(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number): Vec3[][];
/** One drawable: a projected polygon (2+ points; 2 = a line) with its depth for painter's order. */
export type Prim = { pts: number[]; depth: number; fill: string; fillOpacity: number; stroke: string; strokeOpacity: number; strokeWidth: number; dashed: boolean };
/** Appends the faces of a convex solid that face the camera, flat-shaded from `pal` (dark, light rgb). */
export function pushSolid(out: Prim[], c: Cam, faces: Vec3[][], center: Vec3, pal: Palette, alpha: number): void;
export function pushFace(out: Prim[], c: Cam, pts: Vec3[], fill: string, fillOpacity: number): void;
export function pushLine(out: Prim[], c: Cam, a: Vec3, b: Vec3, stroke: string, width: number, opacity: number, dashed?: boolean): void;
export function pushArc(out: Prim[], c: Cam, y: number, r: number, a0: number, a1: number, stroke: string, width: number, opacity: number, segs?: number): void;
export type Palette = { dark: [number, number, number]; light: [number, number, number] };
export const GRAPH: Palette; export const GOLD: Palette;   // the bench's values
/** Far to near, stable for equal depths. */
export function sortPrims(ps: Prim[]): Prim[];
export function pathOf(pts: number[]): string;            // "M x y L x y ... Z" (no Z for 2 points)
export const OPEN: number;                                // the sun's ring opening, 85 degrees in radians
```

```tsx
// src/ui/moments/Scene3D.tsx
/** Draws the prims a worklet returns for the current local time. A fixed pool of `slots` animated SVG paths: each
 *  frame the sorted prims fill slots 0..n-1 and the rest draw nothing. No React re-render per frame. */
export function Scene3D(props: { lt: SharedValue<number>; size: Size; slots: number; draw: (lt: number) => Prim[] }): JSX.Element;
/** Mono text at a projected point: `at` is a worklet returning [x, y, opacity] for the local time. */
export function Label3D(props: { lt: SharedValue<number>; at: (lt: number) => [number, number, number]; text: string; size: number; color: string; align?: 'left' | 'center' | 'right'; screen: Size }): JSX.Element;
```
- When there are more prims than `slots`, the farthest ones are dropped, never the nearest (the front of the scene
  always draws). Each scene documents the slot count it needs and a test asserts it fits.
- Settled (reduced motion): the scene passes a fixed `lt` (`MOMENT_DUR`), so the same code draws the final frame.
- Tests: projection of known points, a box shows exactly 3 faces from a corner view, back faces culled, shading in
  0..1, `sortPrims` far to near, `pathOf` output, `Scene3D` renders `slots` paths, the worklet test passes.

## Chunk 3 · Week scene
Files: `src/ui/moments/weekScene.ts` (pure worklets: the dial for a local time), `src/ui/moments/Week.tsx`,
`src/ui/moments/parts.tsx` (`Roll` moves here from `Day.tsx`, unchanged, exported), `Day.tsx` (imports it),
`MomentsPlayer.tsx` (MomentBody: `week` -> `Week`), tests.

```ts
// src/ui/moments/weekScene.ts
/** Wedge heights in scene units for each day Monday..Sunday: 0.2 + 1.5 * dayMs / max (max of the week, at least 1). */
export function wedgeHeights(dailyMs: readonly number[]): number[];
/** The dial at local time lt (spin, extrude, lock on Sunday at 1.5 s, index, ticks), as prims. */
export function weekDraw(lt: number, size: Size, dailyMs: readonly number[]): Prim[];
```
- Look: the bench's `week` scene. Sunday (index 6) is today (the week moment only plays on Sunday) and turns yellow
  when the dial locks. Weekday letters M T W T F S S on the rim.
- The four readouts from the moment: TASKS DONE `tasksDone`, FOCUS H:MM `formatHM(focusedMs)`, GOLD RINGS
  `goldRings`, DAYS SHOWED UP `${daysShowedUp} / 7`, with `Roll` digits. Headline `momentHeadline`, detail
  `momentDetail`. The stamp stays as `momentTelemetry`.
- Tests: `wedgeHeights` proportional to `dailyMs` (a zero day is the minimum height, never invented), the readouts show
  exactly the moment's values, Sunday is gold after lock and not before, the player shows `Week` for a week moment,
  reduced motion draws the final frame.
