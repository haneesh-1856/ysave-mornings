# M9 chunk 2 · 3D kit

## What it is for
The shared 3D toolkit of the five moment scenes: a worklet perspective camera, flat-shaded convex solids with back-face
culling, painter's order, and a renderer (`Scene3D`) that draws whatever polygons a scene's worklet returns for the
current local time, plus `Label3D` for mono text at a projected point. Maths ported from the "3D kit" of
`drafts/celebrations/close-moments-3d-v1.html`. No scene is built here.

## Connections
- M9 chunk 3 (Week dial): `weekDraw` builds slices with `sliceFaces`/`pushSolid` (GRAPH, then GOLD for Sunday) and
  `pushArc`/`pushLine` for rim and ticks, and passes it to `Scene3D`; weekday letters use `Label3D`.
- M10 stair, M11 skyline, M12 climb: same `Scene3D` with their own `draw` and slot count; M12 uses `OPEN` for the sun ring.
- Reduced motion: a scene passes a fixed `lt` (`MOMENT_DUR`), same code draws the final frame.
- Rule for scene authors: `draw` and `at` run on the UI thread, so every helper they call needs the `'worklet'`
  directive (checked by `momentsWorklets.test.ts`). Each scene documents the slot count it needs.

## Files
- `src/ui/moments/three.ts` (new): `camera`, `toCam`, `project`, `rotY`, `boxFaces`, `sliceFaces`, `pushSolid`, `pushFace`,
  `pushLine`, `pushArc`, `sortPrims`, `pathOf`, `GRAPH`, `GOLD`, `OPEN`, types, plus `nearest(ps, n)` (extra export).
- `src/ui/moments/Scene3D.tsx` (new): `Scene3D`, `Label3D`.
- `src/ui/__tests__/three.test.ts`, `src/ui/__tests__/Scene3D.test.tsx` (new).

Decisions worth knowing:
- `sortPrims` sorts in place (insertion sort, stable) and returns the same array; `nearest` sorts, then slices off the farthest.
- `pushSolid` tells GOLD from GRAPH by value, not identity (a worklet receives a copy of module objects).
- Edges: white 0.2 opacity (GRAPH) or `#fff1b8` 0.2 (GOLD), width 1. `pushFace` has stroke `'none'`; `pushLine` fill `'none'`.
- `pathOf` rounds to 2 decimals: `M0 0 L10 0 L10 5 Z`.
- Unused slots draw `M0 0` with zero opacity. `Label3D` computes the screen margin outside the animated callback
  because `margin` in parts.tsx is not a worklet.
- Paths carry `testID="scene3d-path"`, the Svg `scene3d`.

## Tests
`three.test.ts` (projection incl. target offset and pitch sign, far floor point higher than near, corner box = 3 faces,
head-on = 1, shading within palette for both, edges, near-plane skip for solids/faces/lines, `pushArc` counts 64/32/2/12,
`sortPrims` far to near and stable, `nearest`, `pathOf` for 2 and 4 points). `Scene3D.test.tsx` (renders `slots` paths,
accessibility props, more prims than slots, `nearest` drops the farthest, `Label3D` text). Worklet test passes.
Note: jest runs the animated callbacks as plain JS, so the on-phone UI-thread behaviour is covered only by the worklet guard.

## Errors
1. `npx tsc --noEmit`: `src/ui/moments/Scene3D.tsx(17,34): error TS2345 ... Types of property 'fill' are incompatible.
   Type 'string' is not assignable to type 'undefined'.` (the unused-slot branch returned fewer keys than the used one, so
   the inferred prop type clashed). Fix: the unused-slot branch returns every key (`fill:'none'`, `stroke:'none'`, zero
   widths/opacities, `strokeDasharray: SOLID`). Clean afterwards. No test failed.

## Outputs
- `npx tsc --noEmit`: no output (clean).
- `npx eslint src/ui`: no output (clean).
- `npx jest` (full): `Test Suites: 95 passed, 95 total` / `Tests:       1163 passed, 1163 total`
- New + worklet tests: `Test Suites: 3 passed, 3 total` / `Tests:       36 passed, 36 total`

## Performance notes
- Slots are chosen by the scene (not here). Each slot is one `Path` with one `useAnimatedProps`, all reading one shared
  `useDerivedValue` (one `draw` + sort per frame, not per slot). Unused slots stay mounted but invisible.
- Per frame allocations: every prim is an object with a `pts` array, each face/vertex a small tuple, one path string per
  visible slot, plus `slice` in `nearest` only when over the slot count. Fine for a few hundred prims; scenes with many
  arcs (64 lines per full circle) should budget slots accordingly. Insertion sort is O(n^2) worst case but n is a few
  hundred and the array is mostly sorted frame to frame.
- `strokeDasharray` uses two module constants, so no array is allocated per frame.

## Check B
Verdict: PASS with 1 WARNING and 3 NITs. Maths match the bench exactly; no ERRORs. Scratch scripts live outside the repo
(`...\scratchpad\checkB`: `ref.js` = bench maths, `cmp.js`, `adv.js`, `svg.js`, output `scene.svg`); nothing was added to the repo.

### 1. Numerical equivalence (three.ts transpiled vs the bench's camera/solid maths, 200 random cameras)
- `project`: 1000 random points, max abs diff screen x/y = 0, depth = 0.
- `pushSolid` for 200 boxes/slices x GRAPH+GOLD (400 runs, 1132 visible faces): visible face count mismatches 0, fill
  (shade k) string mismatches 0, projected point max diff 0, face depth max diff 0. (Bit-identical: same operation order.)

### 2. Adversarial
- Zero-area face: pushed as a prim with all points equal (`M180 292.83 L180 292.83 ...Z`), harmless but wasted slot. NIT.
- Behind camera (z=-100 box): 0 prims; box at z=20 (still in front of lens): 2. Exactly depth 0.2 is kept (`< NEAR`), same as bench.
  Depth 0 gives Infinity in `project` but every push* guards it first.
- NaN inputs: WARNING. NaN passes every guard (`q[2] < NEAR` and `dot >= 0` are false for NaN), so a NaN yaw/point/size yields
  prims with paths like `MNaN NaN L216.1 292.83 ...` and fills `rgb(NaN,NaN,NaN)`; `pushLine` with NaN opacity is pushed
  (`opacity <= 0` false); `pushArc` with NaN angle draws 0 lines. `pathOf([])` gives `MNaN NaN`. react-native-svg can log or
  throw on a "NaN" path on device, and a NaN depth also breaks sort order (`[3,NaN,2,1]`).
  Fix (three.ts:155, 170, 182): make the guards NaN-safe, `if (!(q[2] >= NEAR)) ...skip`, and in `pathOf` (three.ts:229)
  return `'M0 0'` when `pts.length < 2` or when any `num()` is not finite. Cheap and covers a scene feeding bad data.
- `nearest`: empty list ok; n=0 returns []; n > length returns all; n=-1 returns []; n=NaN returns all (NIT, not reachable).
  Slots smaller than the prim count: `[3,1,2,5,4,0]` with n=3 keeps depths `[2,1,0]` (the nearest, far to near). Correct.
- Performance (node, this machine; 2000 frames after warm-up, build + `nearest(ps, 200)` + `pathOf` each kept prim):
  100 slice solids (255 prims) 0.32 ms/frame; 300-line arc 0.12 ms; 300 reverse-sorted prims 0.15 ms (insertion sort alone
  0.003 ms). At 10x slower: about 3.2 ms worst, under the 16 ms budget. Maths is not the risk (see 3).

### 3. Scene3D per-frame work and re-renders
- Per frame, on the UI thread: `draw` allocates all tuples/faces/prims/`pts` arrays/shade strings; `nearest` may `slice`;
  one `pathOf` string per visible slot. All proportional to prim count, no avoidable heavy work in the maths.
- WARNING (cannot be proven in jest): with N slots there are N `useAnimatedProps` mappers, and every slot's mapper reruns every
  frame because they all read `prims.value`, including the unused ones that return the identical `M0 0` object. 200 slots
  means up to 200 native `Path` prop updates per frame in Reanimated 4.7.1 / svg 15.16.0, which is likely the real cost on a
  slow phone, not the maths. Suggest the Week chunk keep `slots` tight (about the real maximum, 7 slices x 3 faces + ticks)
  and check on a device; a possible later option is one `Path` per colour group with a joined `d`.
- NIT (Scene3D.tsx:16): `Slot` is not wrapped in `React.memo`. The per-frame path is clean (no state, no re-render; `ids`
  and the slots are only built when `Scene3D` itself renders), but if a parent re-renders (e.g. Week with React state for
  the readouts) all N slots re-render. Fix: `const Slot = React.memo(function Slot...)`; props `i`/`prims` are stable.
- NIT (Scene3D.tsx:34): an inline `draw` prop changes identity when the parent re-renders and rebuilds the derived value's
  mapper; scenes should pass a stable function (document it, or have scenes `useCallback`). `sortPrims` also mutates the
  array `draw` returns, so a scene must not return a cached/shared array (document it).

### 4. Visual sanity (`scene.svg`, bench week camera: yaw 0, pitch 0.66, dist 10.5, cx 180, cy 280, f 389, target [0,0.45,0])
- Ring of 7 slices plus a centre box plus rim arc: 86 prims, depth order far to near monotonic (first 13.30, last 8.25).
- Dial front (-z) point projects at y=381.6, depth 8.41; back (+z) at y=236.1, depth 13.15: front is lower on screen and nearer.
- The last prim drawn is the nearest one and sits low on screen (mean y 389). A box viewed from this camera shows 2 faces
  (top + front), sorted far to near (10.16 then 9.68). All as expected.

## Check A
Verdict: PASS with warnings. No ERROR found.

Commands (run by checker A):
- `npx jest src/ui/__tests__/momentsWorklets.test.ts`: `Test Suites: 1 passed, 1 total` / `Tests:       10 passed, 10 total`
- `npx tsc --noEmit`: no output (clean)
- `npx eslint src/ui`: no output (clean)
- `npx jest src/ui`: `Test Suites: 28 passed, 28 total` / `Tests:       324 passed, 324 total`

1. Contract conformance: every listed export exists with the contract signature (plus `nearest`). `nearest` sorts then keeps the last n (nearest); slot overflow drops the farthest; `dashed` flows `Prim.dashed` -> `strokeDasharray` DASH/SOLID; unused slots return `M0 0` with zero opacity. `rotY(a, p)` per contract. No ERRORs.
2. Worklet safety: every function in three.ts (incl. helpers `facesOf`, `shade`, `isGold`, `num`) has the directive; module-level values captured are only data (`BOX_IX`, `SLICE_IX`, `LIGHT`, `GOLD`, `NEAR`, `EDGE_*`, `DASH`, `SOLID`). Transitive chain checked by hand: Scene3D -> `nearest` -> `sortPrims`; `pathOf` -> `num`; `pushSolid` -> `toCam`/`project`/`isGold`/`shade`; `pushArc` -> `pushLine` -> `project`; `boxFaces`/`sliceFaces` -> `facesOf`; all worklets. Returned values are plain objects/arrays/strings (no closures/Map/Set/classes). `draw`/`at` documented as worklets (Scene3D.tsx:262-266, 280-283). `Label3D` margin computed outside the callback. No ERRORs.
3. Maths vs bench: camera/toCam/project (yaw then pitch signs, `-y*sp + z1*cp + dist`, `cy - f*y/d`), cull rule (`dot(fcc-cc, fcc) >= 0`), normal flip, `k = 0.22 + 0.78*max(0, n.L)`, LIGHT = normalize(-0.45,0.85,-0.55), GRAPH/GOLD, shade rounding, gold edge `#fff1b8`, face-index lists for box and slice, near plane 0.2 (skip whole polygon), line depth `-0.001`, `pushFace` mean projected depth, arc `n = max(2, ceil(segs*|a1-a0|/2pi))`: all identical. No deviations.
4. Layering/style/deps: three.ts imports nothing; Scene3D imports only `@/theme/fonts`, `./parts`, `./three` (no data/state). No new deps from this chunk (the `package.json` diff is the Barlow Condensed font, another chunk).

Findings:
- WARNING src/ui/__tests__/Scene3D.test.tsx:200-222: the Scene3D tests only count paths. Nothing asserts what a slot draws (path `d`, `fill`, dashed array, unused slots `M0 0`/opacity 0, farthest dropped through the component). The "nearest" test at line 217 duplicates three.test.ts:173. Fix: read the animated props of the rendered paths (e.g. `getAllByTestId('scene3d-path',{hidden:true})[i].props` or the animatedProps style, whichever the reanimated jest mock exposes) and assert slot 0 is the farthest kept prim, an extra slot is invisible, and a `dashed` prim yields `[6,5]`.
- WARNING src/ui/__tests__/three.test.ts:93-109: shading test only checks the channel range and that faces differ; a wrong formula or light vector would still pass. Fix: assert one exact value, e.g. a face whose outward normal is the light direction gives `k=1` (palette light colour), and a face facing away gives `k=0.22` (`shade` result for the dark+0.22 mix).
- WARNING src/ui/__tests__/three.test.ts: missing edges: `nearest(ps, 0)` returns `[]`; `Scene3D` with `slots={0}` renders no paths; `pushArc` with `a0 === a1` (emits 2 zero-length lines, see NIT); empty `faces`; `pushSolid` with the camera inside/beside a box where only some points are behind the lens (near-plane test uses an all-near box). Add one case each.
- WARNING src/ui/moments/Scene3D.tsx:251-258 (phone check, not testable here): per frame each slot sets `d, fill, fillOpacity, stroke, strokeOpacity, strokeWidth, strokeDasharray`. jest cannot show that react-native-svg accepts an animated `strokeDasharray` array and string `fill` through `useAnimatedProps` on the UI thread. Fix: verify on the phone in chunk 3 (week scene) before M10-M12 build on it; fallback is to drop `strokeDasharray` from the animated props and keep two static layers (solid/dashed) only if it misbehaves.
- NIT src/ui/moments/three.ts:191-198: `pushArc` with `a0 === a1` pushes 2 zero-length lines. Same as the bench; early `if (a0 === a1) return;` would save two slots.
- NIT src/ui/moments/three.ts:107-111: `isGold` treats any palette whose `light` equals GOLD.light as gold; custom palettes get the white edge. Fine for the five scenes, but a one-line comment that palettes other than GRAPH/GOLD always use the white edge would help scene authors.
- NIT src/ui/moments/three.ts:229-233: `pathOf([])` yields `MNaN NaN`; callers never pass fewer than 2 points. A `pts.length < 2 ? 'M0 0'` guard costs nothing.
- NIT src/ui/moments/three.ts:44-48 / 55: `project` divides by `q[2]` without guarding 0; every pusher checks `NEAR` first, but `project` is exported for scenes (Label3D `at`). Doc comment could say callers must check depth >= NEAR (the bench's label3 does `d < 0.2`). Consider exporting `NEAR` for `at` worklets.
- NIT src/ui/__tests__/Scene3D.test.tsx:198: the comment says `draw`/`at` are worklets in the app; fine, but a scene that passes a non-worklet `draw` is only caught by the guard if `draw` is a module-level function in src/ui/moments (the guard does not see inline arrows passed as props). Consider documenting that scene `draw` functions must be module-level `'worklet'` consts so the guard covers them.

## Fixes after checks
| # | Finding | What changed |
|---|---|---|
| 1 | NaN-safe guards | every push* uses `!(depth >= NEAR)` so NaN is skipped; a private `visible(opacity)` skips non-finite or <= 0 opacity (alpha in `pushSolid`, fill opacity in `pushFace`, stroke opacity in `pushLine`) |
| 2 | `pathOf` | returns `'M0 0'` for fewer than 2 points or any non-finite value |
| 3 | `pushArc` | returns early when `a0 === a1` or `segs < 1` |
| 4 | zero-area faces | `pushSolid` skips faces with fewer than 3 points or a zero-length normal, and projected area under 1e-6 (shoelace `area`); `pushFace` skips fewer than 3 points and zero projected area |
| 5 | `NEAR` | exported; doc comment on `project` says it divides by depth and callers check `depth >= NEAR` |
| 6 | `isGold` | comment: matches by value, custom palettes get the white edge |
| 7 | Scene3D | `Slot` wrapped in `memo`; doc comments say `draw`/`at` must be module-level worklet consts and `draw` must return a fresh array (in-place sort) |
| 8 | shading tests | exact k: normal = LIGHT gives the light colour (k=1); a face turned away gives the k=0.22 colour |
| 9 | Scene3D tests | assert rendered `d`, fill, fillOpacity, `strokeDasharray` ([6,5] for dashed), unused slots `M0 0` with zero opacity, farthest dropped when prims > slots; duplicate `nearest` test removed |
| 10 | edge tests | `nearest(ps, 0)`, `slots={0}`, `pushArc` equal angles, empty and zero-area faces, box partly behind the lens, NaN points and opacities, `pathOf([])` |

Errors: none; no run failed.

Outputs
- `npx tsc --noEmit`: no output (clean)
- `npx eslint src/ui`: no output (clean)
- `npx jest src/ui`: `Test Suites: 28 passed, 28 total` / `Tests:       334 passed, 334 total`
- `npx jest` (full): `Test Suites: 95 passed, 95 total` / `Tests:       1174 passed, 1174 total`
