# M3 · Chunk 3 · Glass jar renderer

## Build (Sonnet)

### Purpose
The glass-jar collection renderer: `Jar` and the `Collection` dispatcher, with a pure layout function. It takes
`CollectionItem[]` and draws marbles stacked from the bottom, a gold ring for overtime, small marbles for
checklist tasks, the planning marble in `sun`, and a lid (flat and accent-colored when the day is closed).

### Files (all under `mobile/src/ui/collection/`)
- `jarLayout.ts`: pure geometry (`layoutJar`, `lastItemKey`, jar path and size constants).
- `Jar.tsx`: the SVG renderer, the `useDrop` hook and the `CollectionProps` type.
- `Collection.tsx`: dispatcher; only the glass jar for now.
- `__tests__/jarLayout.test.ts`, `__tests__/Jar.test.tsx`.

### Connections now
Imports `CollectionItem` (domain), `useTheme`/`Theme` (`t.topic(k).color`, `t.c.sun/surface/muted/line/accent/ink`)
and `useMotion` (Reduce Motion and theme easing/duration). Nothing imports it yet; chunk 5 is the first user.

### Future connections
- Chunk 5 Planned screen: `<Collection items closed={false} scale≈2.3 animateLast />`.
- M4 Today dock (scale ≈ 0.65) and the Run screen.
- M5 Close lid animation: `closed` currently swaps the lid instantly; animating the lid transition goes in `Jar.tsx`.
- M6 Calendar mini jars: same component at a tiny scale (a11y label is per jar, so the grid may want to hide it).
- M7: the other 11 looks implement the same `CollectionProps` and are chosen in `Collection` from `theme.look.art`.

### Decisions
- Geometry is a faithful port: viewBox `0 -12 70 98`, the jar path, the 8 prototype resting spots, radius 7 / 4.6
  (small), gold ring r 9.6 dashed `3 2` in `sun`, highlight dot at (-0.34r, -0.37r), glass fill `surface` at 0.75 opacity,
  the two white glints, the open lid (tilted -16°, `line` color) and the closed lid (flat, `accent`).
  The prototype draws an open tilted lid when not closed; kept (testID `jar-lid-open` vs `jar-lid-closed`).
- Overflow (not in the prototype, which wraps via `i % 8` and overlaps): up to 8 items use the exact spots; 9+ items use packed
  rows at the largest uniform scale (radius 7 down to 2.5 in 0.5 steps) that fits all of them (about 40 fit at the
  smallest size). Past that, the first N (oldest) are drawn and "+K" is shown inside the jar. The jar never grows.
- Drop animation: the newest marble is drawn in its own absolutely-positioned `Animated.View` overlay (same size and viewBox), and a
  `translateY` shared value animates from `-70·scale` to 0 with `useMotion().animate` (theme duration and bezier; the springy
  preset overshoots, which gives the bounce). This avoids animated SVG props, which I could not verify on a device. Reduce
  Motion: no animation, marble appears in place.
- Not replaying: `lastItemKey` (`count:id:at`) is the trigger of the effect, so a re-render with equal items does nothing; a new item replays; mount plays once.
  If the newest item is hidden by overflow, nothing animates.
- a11y: one element, role `image`, label `Jar with N marble(s)` plus `, closed`; singular for 1. The SVG is not separately exposed.
- Tests use `await renderThemed` (RNTL in this repo renders asynchronously) and mock `useMotion` to count `animate` calls.

### Command outputs
- `npx jest src/ui/collection`: 2 suites, 20 tests passed.
- `npm run typecheck`: clean (an earlier error in `src/state/__tests__/plan.test.ts`, chunk 1's file, was gone by the final run).
- `npm run lint`: clean.
- `npm test`: 34 suites, 344 tests passed (includes the other builders' files present at the time).
- `npm run test:coverage`: see the final reply for the result; `mobile/coverage` deleted.

### Known limitations
- Needs a phone check: the drop feel (overlay translate plus theme easing, especially under `springy`) and whether the
  overlay clips on Android (the jar View must not clip children above its top edge).
- SVG performance on low-end Android with many marbles (each marble is 2-3 SVG nodes; a 40-marble jar is about 120 nodes) and the
  Calendar grid with many mini jars.
- The lid change on `closed` is instant; the dropping marble is drawn above the glass, not inside the jar clip.
- Only the glass look is implemented; `Collection` ignores `theme.look.art` until M7.
- Dashes/rotation props on `Rect` (`rotation`, `origin`) are verified only through the type definitions and the test renderer, not visually.

## Check (Sonnet)

### Verdict: PASS

ERRORS: none (no real defects found).

### Verified
- Exports/props match the contract (`Jar`, `Collection`, `CollectionProps {items, closed, scale?, animateLast?}`); presentational; colors only via `t.topic(k).color` (planning item has colorKey 'sun'), `t.c.sun` (gold ring), `t.c.surface/muted/line/accent/ink`. Only hardcoded colors are the white glints `#fff`, same as the prototype.
- Geometry matches `jarSVG` glass: viewBox `0 -12 70 98`, JAR_PATH, SPOTS (8), r 7/4.6, y offset `7-r`, highlight (-0.34r,-0.37r,0.28r, 0.7), ring 9.6 / width 2 / dash "3 2" in sun, glass body + two glints, lid rect x17 w36 h8 rx3, y 4/-10, rotation 0/-16 about (17, lidY), accent when closed else line. RN-SVG `rotation`+`origin` confirmed in extractTransform.ts.
- Drop: only the last item is drawn in an overlay (same W/H/viewBox, so it aligns with the resting spot at any scale; distance = 70*scale). The static copy of that marble is excluded, so no double draw; overlay stays at translateY 0 after the animation, so no jump. Effect keyed on `lastItemKey` (count:id:at) so same-items re-render (even with a different scale) does not replay; a new item does. `reduce` sets 0 with no animation. Springy bezier (.34,1.56,.64,1) overshoots past 0, so it does bounce (gentle/crisp/calm presets do not, which is by theme).
- Animation is a shared value + `useAnimatedStyle` translate: no per-frame JS. `useMemo` on layout; no re-render storm.
- a11y: single `accessible` View, role image, label "Jar with N marble(s)" + ", closed"; SVG not separately exposed.

### Non-blocking notes
1. Overflow: with 41+ items the NEWEST marble is hidden (oldest kept, "+K" shown) and nothing animates, so the freshly completed marble is not guaranteed visible. Unrealistic in a day, but if it matters, keep the newest and drop the oldest instead.
2. Possible one-frame flash: `y` starts at 0 and is set to `-distance` in `useEffect` (after first commit). On mount and when a new last item appears, the new marble may render for a frame at its resting spot before jumping up. Cannot verify without a device; a safe fix is to initialize the shared value to `-distance` when `animateLast` is on (or use `useLayoutEffect`). Also, if `animateLast` flips from false to true with an unchanged last item, it plays for the existing item (played ref is only set when enabled).
3. Bounce overshoot goes below rest by roughly 10 viewBox units at scale 1 (inside the glass, but near the base); fine, check on device.
4. Tests do not assert marble color (planning = sun), gold ring color, the overlay offset/alignment, or that the newest is visible with overflow; the animation tests only count mocked `animate` calls. Behavior is covered for replay/no-replay/reduce, which is the core.
5. Android clipping of the overlay above the jar's top edge is unverified (builder already lists it).

### Commands
- `npm run typecheck`: clean (no output).
- `npm run lint`: clean (no output).
- `npx jest src/ui/collection src/ui/__tests__`: 12 suites, 82 tests passed.
- `mobile/coverage` deleted.
