# M9 chunk 3 · Week scene

## What it is for
Week complete as the 3D safe dial: a wedge per day (Monday..Sunday) as tall as that day's real focus (`dailyMs`), spinning in,
locking on Sunday at 1.5 s (Sunday turns gold, the index triangle lights), rim ring with 70 ticks, weekday letters, four rolling
readouts, headline and typed detail. A day with no focus is the minimum wedge (0.2), never invented. `daysShowedUp` is read from
the moment, never inferred from `dailyMs`.

## Connections + future
- `Scene3D` gained an optional `data` prop: `draw(lt, data, size)`, so `draw` stays a module-level worklet. `Label3D` gained the
  same `data`: `at(lt, data, screen)`, and `at` may return a 4th element, a colour (used for Sunday's letter going yellow).
  Both are backward compatible (old `draw(lt)` / `at(lt)` still type-check). M10-M12 pass their data this way.
- `Roll` (with DigitCell, MarkCell) moved to `parts.tsx`, exported, unchanged; `Day.tsx` imports it. M10-M12 reuse it.
- `MomentsPlayer.MomentBody`: `week` -> `Week`; Placeholder stays for best/streak/month.
- Reduced motion: `Week` gets `lt = MOMENT_DUR`, same code draws the final frame, Roll shows plain text.

## Files
- new `src/ui/moments/weekScene.ts` (`wedgeHeights`, `weekDraw`, `weekSceneDraw` = Scene3D adapter, `weekLetterAt`, `WEEK_SLOTS`, `WEEK_LETTERS`)
- new `src/ui/moments/Week.tsx`
- changed `Scene3D.tsx`, `parts.tsx` (+Roll), `Day.tsx`, `MomentsPlayer.tsx`
- new tests `src/ui/__tests__/weekScene.test.ts`, `Week.test.tsx`; `Scene3D.test.tsx` +2 tests
- docs: `docs/05-screens-and-navigation.md` (Close screen, moments)

## Slot count
`WEEK_SLOTS = 240`. Measured worst case over lt in [0, 3.6] step 0.05, three screen sizes, and weeks (all zeros, one huge day,
typical, NaN/negative/Infinity values): 218 prims. The test asserts <= 240 at every frame.
Budget: 64 rim lines + 70 ticks + 28 slices x up to 3 faces + 1 index.

## Tests
wedgeHeights proportional, zero day = 0.2, all-zero, NaN/negative/Infinity treated as zero; Sunday graphite before 1.5 s and gold
from it (only Sunday); index lights at the lock; slot budget + no NaN for all edge inputs; short/empty dailyMs; letter positions,
opacity and Sunday colour; Week readouts equal the moment's values (also all zero; daysShowedUp independent of dailyMs); final
frame has gold; player renders Week; Scene3D/Label3D `data` pass-through. Worklet guard passes.

## Errors
1. `momentsWorklets.test.ts`: `weekScene.ts: every function ... is a worklet` -> received `["SEC"]`. The guard's regex reads
   `const SEC = (2 * Math.PI) / 7` as a function declaration. Fix: `const SEC = Math.PI * (2 / 7)` (no leading paren). Passed after.
2. Week/Player tests first used `getByTestId`/`getByLabelText` without `hidden` (the player hides its subtree from screen readers);
   fixed with `hidden: true` / `includeHiddenElements`.

## Outputs verbatim
- `npx tsc --noEmit`: no output (clean). `npx eslint src`: no output (clean).
- `npx jest src/ui`: `Test Suites: 30 passed, 30 total` / `Tests: 355 passed, 355 total`
- `npx jest` (full): `Test Suites: 97 passed, 97 total` / `Tests: 1195 passed, 1195 total`

## Phone-check steps
1. Close a Sunday (or force a week moment) with moments on. Week complete plays after the others.
2. Dial spins in from the side and lands with Sunday's wedge at the front; at about 1.5 s it wobbles, Sunday turns gold and the
   triangle at the front lights yellow; the S under it turns yellow.
3. Wedge heights match your days: a day with no focus is a short stub, the longest day is tallest.
4. Four readouts roll: TASKS DONE, FOCUS H:MM, GOLD RINGS, DAYS SHOWED UP (e.g. `5 / 7`); check they match your week.
5. Headline "WEEK COMPLETE." and the typed detail line appear; nothing overlaps the second readout row on a small phone.
6. Reduce Motion on: final frame fades in, gold Sunday, plain numbers. Check frame rate in the spin (218 paths animating).

## Check A
**Verdict: PASS with warnings** (no ERROR; contract met, worklet-safe, tests meaningful).

Findings
- WARNING `Week.tsx:30` and the bench: readout layout differs from the bench week scene. Bench: two left-aligned columns (x = margin, W/2 + 0.02W), label ABOVE a u*0.05 value, first value amber. App: `Roll` centred at margin+0.2w and w-margin-0.2w, label BELOW a u*0.055 value, all white. It matches Day's Roll look, so it is a consistent adaptation, but it should be named as an accepted deviation (or the amber first value restored) before the visual is called "as approved".
- WARNING (layout, 320x568) headline box top (h*0.77 - 1.05*fs = 380.2) is 10 px above the bottom of the second readout label (390.1). Box only: the cap glyphs start about 398, so visible text does not touch; same positions as the bench (it has the same geometry). 360x780 is clear on every band.
- WARNING `src/ui/__tests__/zz-audit-perf.test.ts`, `zz-audit-trace.test.tsx`: scratch audit tests from another run are present and give 12 eslint warnings (the report says eslint is clean; for the chunk's own files it is). Delete before commit.
- NIT `weekScene.test.ts` "only Sunday goes gold": asserts gold count < graphite count, not that the gold prims are Sunday's wedge. Could compare gold prim x-centre with the front/index x. Weak but not tautological.
- NIT No test asserts a wedge's drawn height tracks `dailyMs` (only `wedgeHeights` is checked). One test comparing the projected top of a 2x day vs a 1x day would close it.
- NIT `weekDraw` with `dailyMs.length < 7` draws MIN_H for the missing days (a stub, not invented focus). Acceptable; domain guarantees 7.
- NIT Roll move could not be diffed: `src/ui/moments/` is untracked, so no "before" exists. By reading: Day.tsx only imports `Roll` from parts and uses it with the same props; Roll/DigitCell/MarkCell in parts.tsx are self-contained; Day tests pass (357). Behaviour-neutral as far as can be seen.

Checked and fine
1. Contract: `wedgeHeights` = 0.2 + 1.5*clean(d)/max(1, max), NaN/neg/Inf -> 0. Sunday gold only `i===6 && lt>=1.5`; index lights at 1.5; readouts are exactly `tasksDone`, `formatHM(focusedMs)`, `goldRings`, `${daysShowedUp} / 7`; headline/detail from `momentHeadline`/`momentDetail`; MomentBody `week -> Week`; reduced motion passes lt = MOMENT_DUR through the same code.
2. Fidelity: camera (yaw 0, pitch .66, dist 10.5, cy .36h, f 1.08w, target [0,.45,0]), R0 1.25/R1 3.0, GAP .045, 4 parts, rim r3.3 and 70 ticks (long every 10, 3.5/3.36, .45/.18), spin 0.1..1.5 from 2.8 rad, wobble 0.45 s, extrude `0.15+0.1i .. 0.85+0.1i`, index triangle coords, letters at 3.85 / (i+.5)SEC, headline 2.0 / typed 2.5, row y h*.585 + .065h: all identical to the bench. Only the stroke edge opacity (kit-wide 0.2 vs bench 0.12) differs, outside this chunk.
   Y bands (px), measured from `weekDraw` at lt 3.6 plus the layout formulas:
   - 360x780: dial 208.7-424.1; row1 446.4-478.7; row2 497.1-529.4; headline box 536.3-607.9; typed 635.4-651.6. No overlap.
   - 320x568: dial 140.4-331.9; row1 323.5-353.2; row2 360.4-390.1; headline box 380.2-443.9; typed 461.1-476.1. Bounding boxes touch (dial vs row1 by 8 px, row2 vs headline box by 10 px) but only at the dial's front-centre (index/S letter at x=160, readouts are at x about 56-116 and 204-264) and in the headline's empty ascent. No visible overlap.
3. Worklets: `momentsWorklets.test.ts` 12 passed. Transitive trace: weekSceneDraw -> weekDraw -> clean, wedgeHeights, rotAt, camFor, seg/lerp/outExpo (timeline worklets), camera/pushArc/pushLine/pushSolid/sliceFaces/pushFace (three.ts worklets); weekLetterAt -> rotAt, camFor, project, seg. All have the directive. Captured module values are numbers and the plain `C` object. `data` is a number[] / number: plain, safe to capture. Identity: `moment.dailyMs` is stable while the moment is, `size` is memoised in the player (`useMemo`), `draw`/`at` are module consts, so no per-render rebuild. `Label3D` returns a 4th element only for Sunday-style callers (`r.length > 3`); old 3-element `at` unchanged.
4. Scene3D/Label3D `data` optional, old `draw(lt)`/`at(lt)` still type-check (tsc clean) and Scene3D tests pass.
5. Slot-budget test sweeps 3 sizes x 4 weeks x 73 times and asserts <= 240 and finiteness; measured 217 prims in my own run at 360x780 and 320x568 with a real week (report says 218 worst). Real, not tautological.
6. Outputs
   - `npx tsc --noEmit`: exit 0, no output.
   - `npx eslint src`: `12 problems (0 errors, 12 warnings)`, all in the two `zz-audit-*` scratch tests (not the chunk's files).
   - `npx jest src/ui/__tests__/momentsWorklets.test.ts`: `Tests: 12 passed, 12 total`.
   - `npx jest src/ui`: `Test Suites: 32 passed, 32 total` (30 + the two scratch audit suites), `Tests: 357 passed, 357 total`.

## Check B (data audit + performance)

**Verdict: DATA PASS (no data errors). PERFORMANCE: WARNING, not a blocker.** Every readout and wedge is the stored data, traced end to end.
Perf is fine on a desktop JS engine, but 218 animated paths rebuilt every frame is the main risk on a low-end Android. Cheap reductions below cut the worst case from 218 to about 50 prims with nearly the same look.

### 1. End-to-end trace (temporary test, deleted)
Copied the setup of `momentsData.test.ts` (real week through `createTopic/createTask/reconcile/startTask/pauseTask/stopTask/toggleCheckTask/closeToday`: a no-row day, a checklist-only day, a gold overtime day, an auto-closed day, a task running at Sunday's close), took the returned `week` moment, rendered `<Week moment settled lt=MOMENT_DUR />` and read the rendered labels.

| Item | Hand value | Rendered / computed | Match |
|---|---|---|---|
| TASKS DONE | 5 (1+1+0+1+0+1+1) | label `TASKS DONE 5` | yes |
| FOCUS H:MM | 20+0+0+32+15+300+12 = 379 min = 6:19 | label `FOCUS H:MM 6:19` | yes |
| GOLD RINGS | THU + SAT = 2 | label `GOLD RINGS 2` | yes |
| DAYS SHOWED UP | MON TUE THU SAT SUN = 5 | label `DAYS SHOWED UP 5 / 7` | yes |
| detail line | `5 TASKS  ·  6:19 FOCUSED  ·  5 / 7 DAYS` | `momentDetail` output identical | yes |

Wedge heights `0.2 + 1.5*day/300` (max = 300 min, Saturday), Monday..Sunday:

| Day | min | hand height | `wedgeHeights` |
|---|---|---|---|
| M | 20 | 0.2+0.1 = 0.300 | 0.3 |
| T | 0 | 0.200 (stub) | 0.2 |
| W | 0 | 0.200 (stub) | 0.2 |
| T | 32 | 0.2+0.16 = 0.360 | 0.36 |
| F | 15 | 0.2+0.075 = 0.275 | 0.275 |
| S | 300 | 0.2+1.5 = 1.700 | 1.7 |
| S | 12 | 0.2+0.06 = 0.260 | 0.26 |

Asserted with `toBeCloseTo(..., 12)`. In `weekDraw` each wedge uses `heights[i] * outExpo(seg(...))`, which is exactly 1 for lt >= 1.45, so the final frame draws these heights.
- Letters `MTWTFSS`; index i = 0 is Monday (`rot + (i + 0.5) * SEC`; `dailyMs[0]` is `weekStart`, a Monday). Letter positions at the end (x, y): M (337.8, 390.5), T (333, 297.6), W (247.1, 248.6), T (142.9, 248.6), F (57, 297.6), S (52.2, 390.5), Sunday (195, 451.7) = centre x and lowest on screen, i.e. the front next to the index triangle. Sunday's letter is `#f7d45e` (yellow), the others steel.
- Gold: 10 gold-filled prims at the final frame, 0 at lt = 1.4 (before the lock). Only Sunday (`i === 6 && locked`).

### 2. Definition checks
- Nothing on the dial infers "showed up": `weekScene.ts` never reads `daysShowedUp`, `Week.tsx` only prints it. FRI (15 min focus, did not show up) and TUE (showed up, 0 focus, drawn as a stub) are both right in the trace.
- Zero days draw the 0.2 stub (`MIN_H + 0`), never an invented value. The only other path, `i < heights.length ? heights[i] : MIN_H` for a short `dailyMs`, also yields the stub.
- NaN/negative/Infinity become 0 (`clean`); the week max has a floor of 1 ms, so an all-zero week divides safely.
- The detail line and readouts come from the same moment fields and agree (table above).

### 3. Performance (jest/V8 on this PC; lt 0..3.6 step 0.05, 390x844, the trace week; best of 40 runs per frame)
| Per frame | min | median | max |
|---|---|---|---|
| `weekDraw` | 0.18 ms (lt 0) | 0.79 ms | 0.98 ms |
| `weekDraw` + `nearest` (sort) | 0.18 | 0.85 | 1.03 |
| `pathOf` for all prims | 0.01 | 2.48 | 4.54 |
| total (draw + sort + path strings) | | about 3.3 ms | about 5.6 ms |
| visible prims per frame (= non-empty paths) | 1 | 217 | 218 |

- Prims by time: lt 0 = 1 (index only, fade 0), 0.05 = 135, 0.5 = 182, 0.8 = 216, 0.85-3.6 = 217-218. Empty slots: 22 at most-full to 239.
- Final frame composition: 134 lines (64 rim + 70 ticks) and 83 polygons (wedge faces + index). Path strings total about 8.7k chars per frame.
- From lt = 1.95 (wobble over at 1.95, index lit at 1.75, wedges full at 1.45) the frame is identical to the last, yet the scene rebuilds and re-publishes all 217 paths until 3.6 s: about 46% of the scene's frames are wasted.
- Risk: Hermes on a low-end Android is much slower than V8 on a desktop (assume 5-20x for string/array-heavy worklet code), so about 3-6 ms here could be 15-60 ms there, over a 16.7 ms frame, plus up to 240 `useAnimatedProps` updates, each re-parsing a path string natively. Expect dropped frames on weak phones during the first 1.5 s (growth + spin); the settled tail should cost nothing.

Proposals (worst case now 218):
1. **Ticks as 2-4 path prims instead of 70** (biggest win). Allow a multi-segment prim (for example `Prim.d?: string` or `pts` plus a `breaks` list; `pathOf` currently closes any polyline longer than 2 points) and emit one `M..L..M..L` path for the 7 long ticks (opacity 0.45) and one for the 63 short ticks (0.18). The ticks sit just outside the wedges (r 3.18-3.5 vs R1 3.0) and the back ones can be partly hidden by tall wedges, so split each into a back half and a front half to keep painter's order: 4 prims. 218 -> 152.
2. **Rim ring as 2 prims** (back half, front half, each one open polyline of 32 points) instead of 64 lines. 218 -> 156 alone; with 1: 90. If it stays as lines, `segs` 64 -> 40 only gives 218 -> 194.
3. **PARTS 4 -> 2** (`weekScene.ts:21`): wedge polygons 82 -> about 42. A wedge is about 0.81 rad wide, so two slices are still convex and fine; the outer curve gets a little more faceted. 218 -> 178 alone; with 1 and 2: about 50.
4. **Slot count**: after 1-3 the worst case is about 50, so `WEEK_SLOTS = 64` (from 240) mounts 176 fewer animated paths and mappers (faster first mount and less memory). Keep the test asserting `<= WEEK_SLOTS` at every frame.
5. **Freeze after settle**: in `weekSceneDraw` clamp `lt` to 1.95, and in `Scene3D` do not re-publish when the clamped lt did not change (for example an optional `freezeAt` prop and a second shared value holding the last published lt). That removes all per-frame work for the last 46% of the scene and also keeps the Reduce Motion path a single frame.
6. Skipping per-slot updates for unchanged prims is only worth it with 5; during the spin every prim moves each frame.

Estimate after 1+2+3+4+5: moving phase about 50 prims (about 4x less path building and native updates), settled phase none.

### 4. Tests run
- `npx jest src/ui/__tests__/weekScene src/ui/__tests__/Week.test src/ui/__tests__/Scene3D src/ui/__tests__/momentsWorklets src/ui/__tests__/MomentsPlayer src/state/__tests__/momentsData src/domain`: `Test Suites: 15 passed, 15 total` / `Tests: 292 passed, 292 total`.
- My temporary audit tests (trace + perf) passed and were deleted (no `zz-audit-*` left from check B).

### Findings
1. **WARNING** `src/ui/moments/weekScene.ts:15` (`WEEK_SLOTS = 240`), `weekScene.ts` rim/tick loops in `weekDraw`, `Scene3D.tsx` `Slot`: 218 animated paths rebuilt every frame; about 3.3-5.6 ms on desktop V8, likely over the frame budget on a low-end Android. Fix: merge ticks (4 prims) and rim (2 prims) into multi-segment prims, `PARTS` 4 -> 2, `WEEK_SLOTS` 64 (worst case about 50).
2. **WARNING** `src/ui/moments/Scene3D.tsx` `useDerivedValue(() => nearest(draw(...), slots))`: the frame is identical from lt = 1.95 to 3.6 but is rebuilt and re-published with a new array each frame (about 46% of frames wasted). Fix: freeze after the last animation ends.
3. **NIT** `src/ui/moments/weekScene.ts` `i < heights.length ? heights[i] : MIN_H`: only reachable for a short `dailyMs`, gives the stub, not invented data; dead defence since the domain always gives 7. No change needed.
4. **NIT** the "Slot count" section says 218 worst case; measured 218 at lt 1.0-1.45 and 217 otherwise, consistent.
5. No data ERRORs: all four readouts, the detail line, the seven wedge heights, the day-to-letter mapping and the Sunday gold lock match the real stored week.

## Fixes after checks
| Finding | Change |
|---|---|
| B1 218 animated paths | Kit: `Prim.segs?: boolean` (pts are pairs, each one line, `M a L b M c L d`, never closed, no fill); worklet `pushSegments(out, c, pairs, stroke, width, opacity, dashed?)` (one prim, mean depth, pairs behind NEAR skipped, nothing pushed if none left); `pathOf(pts, segs?)`; `Scene3D` passes `p.segs`. Backward compatible. |
| B1 ring | 2 prims (back half z >= 0, front half), each 32 consecutive pairs (reuses `segs`, no extra `open` flag). |
| B1 ticks | 4 prims: long/short x back/front by `sin(angle) >= 0` (depth relative to the dial centre), so the wedges still paint between them. |
| B1 wedges | `PARTS` 4 -> 2 (each slice ~0.8 rad, still convex). |
| B1 slots | `WEEK_SLOTS` 240 -> 56. **New worst case: 49 prims** (3 sizes, 4 weeks incl. all zeros and one huge day, lt 0..3.6 step 0.05). Was 218. |
| B2 freeze | `weekSceneDraw` and `weekLetterAt` clamp lt to `WEEK_STILL_AT = 1.95`; `Scene3D` has `freezeAt?`: from lt >= freezeAt it calls `draw` once (at freezeAt), caches the frame in a shared value and returns it afterwards. Week passes it; Reduce Motion (lt = 3.6) draws once. Label3D not changed (7 cheap style updates; letters are already clamped). jest cannot observe the UI-thread skip, so the test checks the frame is drawn at freezeAt, not at lt. |
| A nit: gold = Sunday | Test: after the lock every gold prim's centroid is within 0.2 W of the screen centre (Sunday sits at the front), and some graphite prims are further out. |
| A nit: height follows dailyMs | Test: top (min y) of the front-left (Saturday) prims for Saturday = 0 / 60 / 120 min is strictly higher on screen each time (>5 px steps). |
| A warning: look | `Roll` has an optional `color` (default white); TASKS DONE is yellow (`C.yellow`, the app's amber) like the bench. Accepted deviation, unchanged: centred columns with the label under the value (the Day look) instead of the bench's left-aligned label-above. Test checks the digit colours. |
| New tests | `three.test.ts` (pushSegments: one prim, mean depth, skip behind lens/none left/zero opacity; pathOf segs), `weekScene.test.ts` (6 line prims = 134 lines, frozen frames equal), `Scene3D.test.tsx` (freezeAt), `Week.test.tsx` (colours). |

Note: the `zz-audit-*` scratch tests from the check runs were already gone; nothing is left to delete.

Outputs verbatim
- `npx tsc --noEmit`: no output. `npx eslint src`: no output.
- `npx jest src/ui`: `Test Suites: 30 passed, 30 total` / `Tests: 363 passed, 363 total`
- `npx jest` (full): `Test Suites: 97 passed, 97 total` / `Tests: 1203 passed, 1203 total`

## Lead verification
- `freezeAt` stops rebuilding the scene after 1.95 s (no draw, sort or nearest). Each frame still re-runs the 49 slot
  props on the same cached prims (49 `pathOf` strings): small, accepted; confirm smoothness on the phone.
- tsc clean, lint clean, `Test Suites: 97 passed, 97 total` / `Tests: 1203 passed, 1203 total`.
