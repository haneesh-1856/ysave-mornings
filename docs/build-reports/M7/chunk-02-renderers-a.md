# M7 · Chunk 2 · Collection renderers A

## Build (Sonnet)

### Purpose
Four new collection looks (garden, plant, sky, bracelet) plus the line and paper jar variants, drawn with react-native-svg from the prototype geometry, and the shared animation/label kit the next chunk reuses.

### Files
- `src/ui/collection/kit.tsx` (new) — `useArrival`, `useClosedDecoration`, `capOf`, `collectionLabel`, plus helpers `viewMetrics`, `Frame` (the 110 x 96 pt layout: back layer, items, closed decoration, "+N", newest item in its own overlay) and `GoldRing`.
- `src/ui/collection/Garden.tsx`, `Plant.tsx`, `Sky.tsx`, `Bracelet.tsx` (new) — one renderer each, taking `CollectionProps`.
- `src/ui/collection/Jar.tsx` — gains `variant: 'glass' | 'line' | 'paper'`; its private `useDrop`/`useLid` moved into the kit (`useArrival('drop')`, `useClosedDecoration`). Glass drawing unchanged.
- `src/ui/collection/Collection.tsx` — dispatches on `useTheme().look.art`.
- Tests: `src/ui/collection/__tests__/renderers.test.tsx` (new, 40 tests incl. dispatch + kit). Existing `Jar.test.tsx` and `jarLayout.test.ts` unchanged and passing.

### Connections now
- `Collection` reads `useTheme().look.art`: line/paper -> `Jar variant`, garden, plant, sky, bracelet -> their renderers; glass and the not-yet-built looks (cairn, lights, honey, shelf, card) -> glass jar.
- Colors: `t.topic(item.colorKey).color`, `t.c.*` for `var(--p-*)`; nouns from `tokens.collectionNouns` (label only).
- Motion via `useMotion` (instant under Reduce Motion), as before.

### Future connections
- Chunk 3 builds Cairn, Lights, Honey, Shelf, StampCard on `Frame`/`useArrival` (flicker and stamp are already in `useArrival`) and removes the fallback.
- Chunk 4 may switch `collectionLabel` to `collectionNoun.ts` (`collectionNoun`/`unitNoun`).

### Decisions
- Animation via one progress value `p` (0 -> 1, `animate(1)`) and `interpolate` for the keyframes (pop 0/1.35/1, stamp 2.2/0.92/1, flicker opacity). Jar's drop is now `-70*scale*(1-p)`, the same motion as before (overshoot easings still bounce).
- Scaling arrivals use a translate-scale-translate around the item's own point (grow: its base), so no animated SVG props.
- Closed decoration with `animateLid`: drawn in an overlay that fades in and scales 0.5 -> 1 (the prototype has no animation for these); without it, drawn inline. The bracelet's open arc is always drawn and the closed ring is drawn over it (identical stroke, so no flash).
- Test ids: `item-<i>` per item, `gold-<i>` on garden/plant gold marks, `gold-ring` on the others, `<art>-overflow`, decorations `garden-moon`, `sky-moon`, `plant-bloom`, `bracelet-clasp`.
- Plant stem height counts at most the 8 drawn leaves (prototype was unbounded). Sky's dotted line connects drawn stars only. "+N" positions are my choice (prototype has none): garden (20,6), sky (100,84), bracelet centre, plant (92,40).
- Item colors, `small` and `gold` read from the item; gold marks use `t.c.sun`.

### Command outputs
- `npm run typecheck`: one error, in another builder's in-progress file (`src/ui/__tests__/CardBlur.test.tsx(11,67): Expected 0 arguments, but got 1`); nothing in `src/ui/collection`.
- `npm run lint`: clean.
- `timeout 300 npx jest src/ui/collection`: 3 suites, 66 tests passed.

### Known limitations + phone checks
- Not run on a device; animations are only unit-tested through the mocked `animate`.
- Check 1: in Profile > Try a look, pick a garden look (Lavender journal) and complete a task: a flower grows from the soil. Close the day: the moon appears.
- Check 2: sky pops a star in; bracelet drops a bead onto the ring and closing adds the clasp; plant grows a leaf and blooms when closed.
- Check 3: Ink notebook shows the outlined jar and lid (lid stays outlined when closed); paper jar has the offset shadow.
- Check 4: with Reduce Motion on, all of these appear instantly.
- Check 5: looks cairn/lights/honey/shelf/card still show the glass jar until chunk 3.

## Check (Sonnet)

**Verdict: PASS**

Run: `npm run lint` clean, `npx jest src/ui/collection` 3 suites / 66 tests pass, `npm run typecheck` clean.
Read kit.tsx, Jar/Garden/Plant/Sky/Bracelet/Collection and compared the numbers with `jarSVG`, `gardenSVG` and `EXTRA_ART` sky/bracelet/plant in the prototype.

ERRORS: none.

NOTES (non-blocking):
1. `kit.tsx` `useArrival`: `played.current` is only set while `enabled`. If a screen flips `animateLast` false -> true with an unchanged `lastKey` after that item arrived while disabled, the old item replays once. Nothing in the contract covers this, and callers currently pass a constant.
2. `kit.tsx` `useArrival` runs `animate(1)` even when `overflow > 0` (no overlay is drawn), so the shared value moves for nothing. It is harmless. The test "does not animate without animateLast, nor when items overflow" only asserts that `item-(cap-1)` exists. It never asserts the overflow case, so it can't catch a regression.
3. A11y: the outer `View` is `accessible` with role image and the label from `collectionLabel`. The inner `Svg` and overlay `Animated.View`s are not marked `importantForAccessibility="no-hide-descendants"` or `accessibilityElementsHidden`. This matches the pre-existing Jar pattern, and no test checks it. Consider hiding the descendants explicitly.
4. Tests do not pin the arrival kind per look (grow / pop / drop) or any geometry. They check only that `animate` was called, testIDs and labels. The kinds are correct in code: garden and plant grow, sky pops, bracelet drops.
5. On mount with `animateLast`, the first frame is at rest and then jumps to 0 before animating (the shared value starts at 1). This is the same as the existing Jar behaviour.
6. Geometry faithful: garden, sky (P table, sparkle path, moon at 98,-2 with cut at 101,-4), bracelet (R 34, -66 + 28*i, clasp), plant (pot, stem curve, leaf side/rotation, bloom) all match the prototype. The only deviations are capping plant's `n` at 8 and drawing the bracelet's open arc under the closed ring, both visually equivalent. Theme tokens are used throughout. The only literal is `#fff` for highlights, as in the prototype.
7. Contract items checked and correct: capacities (7/8/12/12), sizes (110x96, viewBox `0 -12 110 98`), `capOf`, `collectionLabel` plurals ("leaves", ", closed"), `useClosedDecoration` (mounts closed at 1, only false -> true animates, reopening instant, state kept in step when `animateLid` is off), newest-item overlay only when `animateLast` and `overflow === 0`, Collection dispatch with glass-jar fallback, Jar variant default 'glass'.
