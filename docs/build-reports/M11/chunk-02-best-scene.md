# M11 chunk 2 · Best scene

**What it is for:** draws the Personal best moment as a 3D skyline: one column per real day of the 13 before today
(none for a zero day), a glass plane at the real previous best, today's gold column breaking through it with the sun's
ring spreading on the glass, `BEST H:MM`, today's `H:MM` and `+H:MM`.

**Connections now:** `bestScene.ts` (worklets on the M9 kit), `Best.tsx` (`Scene3D` with
`data = [...recentMs, todayMs, previousBestMs]`, `freezeAt = BEST_STILL_AT`, three `Label3D`), `MomentsPlayer.tsx`
(`best` -> `Best`). Ui fixtures now carry 13 real-shaped `recentMs`.
**Future connections:** M12 month scene follows the same pattern; M13 removes `Placeholder` after it.

## Build (Sonnet)
- `BEST_SLOTS` 50 (worst 49 at every size), `BEST_STILL_AT` 2.8 s (ring gone by 2.6 s). Grid, glass edges and ring one
  prim each, with forced depths (grid farthest, glass between the lower parts and today's part above it, ring nearest).
- Changes from the bench: camera angle (the bench view was a thin strip at phone width), ring radius 1.5, today's two
  labels stacked above its column (beside it they sat over neighbours), local `RING_OPEN` (the worklet guard treats
  `three.OPEN` as a function).

## Check A (code, Sonnet): PASS
Mutations (gold moved, zero day as a stub, wrong glass, wrong text, labels moving after freeze, slot overflow) all
fail a test. Applied: glass depth clamped behind today's above-glass part when the best is small (test best 20 /
today 150), glass height checked by projection, labels memoised.

## Check B (data, performance, layout, Sonnet): PASS
Case A (110 / 100) and the forwarded/deleted/auto-closed case (520 / 500): every drawn height equals v / top x 4.4,
columns in day order, zero days absent, only today above the glass, labels `BEST 1:40 · 1:50 · +0:10` and
`BEST 8:20 · 8:40 · +0:20`. Renders at 390 and 320, settled and with the ring: all readable, no collisions. Applied:
the block lowered (fit 0.16h..0.68h). Accepted: three label worklets keep running after the freeze (small cost).

## Lead verification
Viewed `best-390-v2.png`: skyline lower, labels clear. tsc clean, lint clean, `Test Suites: 103 passed, 103 total`,
`Tests: 1273 passed, 1273 total`. No probe files left.

## Phone check (user)
Beat your best day by hand: past 13 days rise as columns (none for empty days), the glass sits at your best, today's
gold column breaks it, the ring spreads, your real numbers above it.
