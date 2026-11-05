# M10 chunk 2 · Streak scene

**What it is for:** draws the streak moment as a 3D spiral stair, one step per real day (up to 21), one turn per 7
days, today's step on top in gold, the latest week's steps labelled with their real weekday.

**Connections now:** `streakScene.ts` (pure worklets on the M9 kit: `camera`, `rotY`, `boxFaces`, `pushSolid`,
`pushSegments`), `Streak.tsx` (`Scene3D` with `data = n`, `freezeAt = STREAK_STILL_AT`; `Label3D` per labelled step;
letters from `streakWeekdays` + `WEEK_LETTERS`), `MomentsPlayer.tsx` (`streak` -> `Streak`).
**Future connections:** M11 (best) and M12 (month) reuse the same pattern; M13 removes `Placeholder` once both land.

## Build (Sonnet)
- `STREAK_SLOTS` 66, `STREAK_STILL_AT` 2.6 s (yaw eases to a stop, then `Scene3D` keeps the frame), `streakDraw`,
  `streakLabelAt`, `streakSceneDraw`, `streakLabelOf`, `streakLabelSize`, `STREAK_LABELLED` 7.
- Floor ring, axis and the climbing thread are one prim each. Worst prims per frame: n=1: 5, 7: 24, 14: 45, 21: 65.
- Thread colour is `C.yellow` (the moment palette has no separate amber).

## Check A (code and contract, Sonnet): PASS with warnings, re-check PASS with warnings
First pass: gold test did not pin the top step, a tautological style assertion, hard-coded label half widths, no n
clamp in the label worklet. All fixed and re-verified by mutation reasoning. Re-check nits (applied by the lead): a stray
Latin-1 byte in a comment, a stale measured-prims comment, `LAST 21 DAYS` moved to 0.675h clear of the label clamp.

## Check B (data audit, performance, layout, Sonnet): PASS with warnings
Data exact for (7, Sun 11-01), (7, Fri 11-06), (14, Sun 11-08), (28, Wed 11-25: 21 steps from Thu 11-05, `W · TODAY`,
headline keeps 28). Renders showed the stair too small, steps reading as scattered, today's label on the gold step and
21 labels as mush. Fixes (builder): camera fitted per n (stair 0.12h..0.64h), wider and thicker treads, only the top 7
steps labelled, back-side labels dimmed, today's label above its step, `LAST 21 DAYS` when days > 21, tests for each.
Lead looked at fresh renders (n = 1, 7, 21 at 390x844): reads as a spiral stair, labels clear. Accepted for the phone
check: at n = 21 the thread crosses near treads and some labels sit a little off their step.

## Lead verification
tsc clean, lint clean, `Test Suites: 100 passed, 100 total`, `Tests: 1237 passed, 1237 total`. One full run made while
a checker ran jest at the same time showed 6 timeouts; a clean rerun alone passed everything (load, not a defect). No
temp files in the repo.

## Phone check (user)
Close the 7th day in a row by hand: steps drop in one by one, the thread climbs, the camera turns and stops, today's
step is gold with `<letter> · TODAY` above it, the letters are your real last 7 weekdays, smooth after it stops.
