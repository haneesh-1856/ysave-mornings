# Chunk 19 · Close: moments at close (data and rules, no UI)

## What it is for
The user chose six short full-screen "moments" to play when the day is closed by hand. This chunk decides WHICH are due and WHAT each shows, and remembers what was already celebrated (ADR-015). Chunk 20 draws them; chunk 21 adds the Settings controls.

## Connections
- Contract: `contract.md` section "Chunk 19". Docs: 04 (section 12), 10 (ADR-015).
- Data flow: `CloseScreen` -> `closeToday(outcomes)` -> close applied (`applyOps`) -> `computeMomentsAfterClose` (state) reads settings, today's bundle, week and month bundles, per-day focus totals -> `momentsAtClose` (pure) -> `nextMarkers` -> `setMomentMarkers` -> returns `Moment[]`.
- Future: chunk 20 consumes `Moment[]` (discriminated by `kind`, plain numbers and keys, no formatting). Chunk 21 uses `setMonthlyGoalHours` / `setMomentsEnabled`.

## Files
- Domain: `src/domain/moments.ts` (`Moment`, `momentsAtClose`, `nextMarkers`, `streakRun`, `MomentMarkers`, `DEFAULT_MARKERS`).
- Data: `src/data/repos/settings.ts` (`get/setMonthlyGoalHours`, `get/setMomentsEnabled`, `get/setMomentMarkers`), `src/data/repos/sessions.ts` (`focusTotalsByDay`).
- State: `src/state/moments.ts` (`computeMomentsAfterClose`), `src/state/actions/close.ts` (`closeToday` returns `Moment[]`).
- UI: none; `CloseScreen` still ignores the return value.
- Docs: 04, 10, this report, `contract.md`, M8 `README.md`.

## Build
- Streak rule reused: a day counts when it has >= 1 collection item (the `chain` and `daysShowedUp` rule, planning marble included); the run is the consecutive counting days ending today, today included. `chain` only looks 7 days back, so the walk uses the same predicate and goes back until the first non-counting day.
- Week rule reused: `weekStartOf` (Monday); last day = start + 6.
- Markers are one JSON object under `momentMarkers` (the five fields move together and are read together; one write per close). Bad or missing fields fall back to defaults field by field.
- Streak "same run" test: skip when the saved end day lies inside the current run and the saved length >= current length. A longer step of the same run (14 after 7) plays; a new run after a gap plays.
- Personal best history: one query, sessions joined to `day_tasks` grouped by `dayKey` (`sum(max(0, coalesce(endedAt, at) - startedAt))`), no bundles loaded. Week and month use bundles (at most 31 days). The streak walk loads one bundle per day back to the first gap.
- Markers are saved after the close, not in its transaction; if computing moments throws, `closeToday` still returns normally with `[]`.

## Tests
- Domain `moments.test.ts`: every kind at its boundaries, order, empty day, `nextMarkers`.
- Data `settings.test.ts` (getters, setters, validation, marker repair), `sessions.test.ts` (`focusTotalsByDay`).
- State `moments.test.ts`: end-to-end on a seeded db: first close, record on day 2 saved and not repeated, monthly goal once, moments off, auto-close.
- Existing `close.test.ts` needed no change (return value was unused).

## Errors / open
- Not run on a device (no UI yet).
- A goal changed after a month was already celebrated does not replay that month.

## Outputs
See the final report of this chunk for tsc, lint and jest tails.

## Check
**Verdict: PASS** (no must-fix errors).

Runs (app root): `npx tsc --noEmit` exit 0, no output. `npx expo lint` exit 0, no output. `npx jest`: Test Suites 88 passed, Tests 1094 passed. Doc 04 diff is a pure append (+13 lines), mixed line endings untouched.

### ERRORS
None.

### WARNINGS
1. `src/state/actions/close.ts` (the `catch { return []; }` in `closeToday`): errors are swallowed with no log. A real bug in moments (bad marker write, query error) would silently look like "no moments". Isolation itself is right (the close is already applied), but log the error (dev warn) and add a test that forces a throw and asserts `closeToday` still returns [].
2. `src/state/moments.ts` streak walk: one `loadDayBundle` per day back to the first gap. A 365-day run is hundreds of queries on every close, but only 1 in 7 runs even reach a multiple of 7. Cheap fix: skip the walk unless needed, or count only up to the next multiple of 7 above the saved marker. Not tested for performance.
3. Missing tests the spec lists: no DST case (Nov 1 2026 week/month/best grouping; code only uses dayKey string arithmetic so it looks safe, but unproven); no state-level test of a session closed late after midnight with `dayStartHour` (attribution is via `day_tasks.dayKey`, which is correct by reading); no end-to-end streak walk (gap, today not counting) or week moment through `closeToday` (only the pure domain tests cover them); no test of failure isolation; no test for long runs.
4. Goal edge: with a goal set and `momentsEnabled` turned back on later, a goal reached while off fires at the next close (acceptable, but not documented).

### NITS
- `streakRun` and the state walk both encode the "counts" rule separately (`>= 1` item); the walk duplicates `chain`'s predicate instead of calling a shared one.
- `focusTotalsByDay` has no `deletedAt` filter, which is right: only topics/tasks are soft-deleted, `day_tasks` are snapshots; forwarded rows are separate day_tasks so their sessions stay on the original day. Open sessions on an earlier day would count up to `at`; close/reconcile ends them, so this does not occur in practice.
- Report says "Existing close.test.ts needed no change", fine; contract, ADR-015, README row and doc 04 section 12 match the code.

## Lead fix (after the check)

- **Warning 1 fixed: a moments failure was silent.** In `closeToday`, the catch now calls `console.warn('closeToday: moments failed, playing none', e)` under `__DEV__`. The close is already applied, so it still returns `[]`. New test in `src/state/__tests__/moments.test.ts`: "still closes the day, plays none, and warns in development". It forces `getMomentsEnabled` to throw and checks the day is closed, the moments come back `[]`, and the warning was printed.
- **Warning 2 left as is: the streak walk.** It runs once per close by hand, and each day is a local SQLite read. If it ever shows up as slow, it can be capped at the last celebrated run.
- **Warnings 3 and 4 left open.** The missing end-to-end cases (DST, late close after midnight, a week through `closeToday`) and the "goal reached while moments were off" note are carried to chunk 20.
- **Re-run by the lead:** `npx tsc --noEmit` clean, `npx expo lint` clean, `npx jest` 88 suites / 1095 tests passed.

## Rule change from the user (2026-11-01)

- **Day complete plays only when every task is done.** The user's words: "if user closes the day with all tasks completed, then day complete; if closed without completing all the tasks, then using the moments off transition theme. And rest all same." `momentsAtClose` now adds `day` only when `total > 0 && done === total`. With tasks left, nothing replaces it in the list: chunk 20's ending reads "no `day` moment" as the quiet ending (dim sun, ring left open, "the day closes quietly"). The other five moments are unchanged.
- **Tests:**
  - The domain `day` tests now cover all done (plays), a task left (absent) and an empty day (nothing plays).
  - In the state tests, the unfinished-task closes now expect `['longest']`, `['longest', 'best']` and `['longest', 'month']`.
  - The monthly-goal case, where the task ran its full budget, still expects `day`.
- **Docs:** doc 04 section 12, rule 2, has been updated. The test bench (drafts/celebrations/close-moments-v1.html) shows the same rule.
