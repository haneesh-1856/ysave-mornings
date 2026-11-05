# M9 chunk 1 · Week data

## What it is for
The Week complete moment needs each day's focus so the dial can draw one wedge per day. The week Moment now carries `dailyMs: number[]` (Monday..Sunday, index 0 = `weekStart`, 0 for a day with no row, sums to `focusedMs`). A data trace test proves every week number against a real week built through the app's own actions.

## Connections
- `momentsAtClose` (domain) fills `dailyMs` from `input.weekBundles` with the same `bundleFocusMs` used for `focusedMs`, keyed by `dayKey` (any order, missing days stay 0).
- `src/state/moments.ts` already passes the week's bundles; unchanged. `momentText` and the UI read only existing fields; unchanged.
- Future: M9 chunk 3 draws one wedge per entry of `dailyMs`.

## Files
- `src/domain/moments.ts`: `dailyMs` on the week variant and in the week computation.
- `src/domain/__tests__/moments.test.ts`: `dailyMs` added to two literals, new `dailyMs` describe.
- `src/ui/__tests__/MomentsPlayer.test.tsx`, `src/ui/__tests__/momentText.test.ts`: field added to week literals (type fix only).
- `src/state/__tests__/momentsData.test.ts`: new.
- `docs/04-domain-rules.md` section 12 item 5: "each day's focus (Monday to Sunday)".

## Tests
Domain (`week > dailyMs`): 7 entries Monday first with missing days 0; sums to `focusedMs`; same result for out-of-order bundles; all zeros with no bundles.

Data trace (`week moment: data traced from a real week`), week 2026-10-26..2026-11-01, task A (timed 30 min) and C (checklist), both default daily:
- Mon: A 20 min, C ticked, hand close. Focus 20, done 1, shows up. The close creates Tue's row.
- Tue: C ticked only (checklist-only day), auto-closed by the Thursday reconcile. Focus 0, done 1, shows up.
- Wed: no row (Tue was not hand-closed, app not opened); asserted `loadDayBundle` is null.
- Thu: A runs to 30 min (reconcile completes it), stopped at 32 min: overtime 2 min = gold. Focus 32, done 1.
- Fri: A 10 min + pause + 5 min (two sessions), nothing finished. Focus 15, done 0, does not show up.
- Sat: A started at SUN 00:00 EDT, app closed, auto-closed at SUN 04:00 EST. Clocks go back that night: 4 wall hours + 1 repeated = 300 min, done, overtime 270 = gold.
- Sun: A running 12 min at the hand close (ended at the close), C ticked. Focus 12, done 1.
- Expected: tasksDone 5, focusedMs 20+0+0+32+15+300+12 = 379 min, goldRings 2, daysShowedUp 5 (Mon, Tue, Thu, Sat, Sun), dailyMs [20, 0, 0, 32, 15, 300, 12] min, `weekCelebrated` = 2026-10-26.

## Errors
1. First run of `momentsData` failed: Saturday was 7 200 000 ms (120 min) not 21 600 000 (my 360 min). Cause: the test helper `at(day, hours)` adds real hours to the day start, and DST ends that night, so `at(SAT, 23)` was 02:00 EST Sunday, not 23:00 EDT. Fixed in the test (start at `at(SAT, 20)` = SUN 00:00 EDT, hand arithmetic redone to 300 min). The domain code was correct.
2. One `npx tsc --noEmit` run showed an error in `src/ui/moments/Scene3D.tsx` (untracked, not mine, apparently chunk 2 in progress); a later run was clean.

## Outputs
- `npx tsc --noEmit`: no errors (0 `error TS`).
- `npx eslint src`: no output, exit 0.
- `npx jest`: `Test Suites: 95 passed, 95 total` / `Tests:       1163 passed, 1163 total`

## Check B (data audit)

**Verdict: PASS** (no errors, no warnings; two NITs).

### Independent arithmetic (done from the scripted actions, not from the test's comments)
`at(day,h)` = day start (04:00 local) + h REAL hours. Budget A = 30 min.

| Day | Actions | focus | A done / gold | C ticked | tasksDone | shows up (item count) |
|---|---|---|---|---|---|---|
| Mon | A 20 min (<30), C ticked, hand close | 20 | no / no | yes | 1 | yes (1 item) |
| Tue | C ticked, auto-closed Thu | 0 | - | yes | 1 | yes |
| Wed | no row | 0 | - | - | 0 | no |
| Thu | A 31 min then reconcile (completedAt at 30:00), stop at 32 | 32 | yes / overtime 2 min >= 60 s gold | let go | 1 | yes |
| Fri | A 10 + 5 (two sessions), 15 < 30 | 15 | no / no | no | 0 | no (no planning marble, nothing done) |
| Sat | A starts at SAT 04:00 EDT + 20 h = SUN 00:00 EDT; day end = SUN 04:00 EST. 00:00 EDT to 02:00 EDT = 2 h, then 01:00 EST to 04:00 EST = 3 h: 5 h | 300 | yes / overtime 270 gold | no | 1 | yes |
| Sun | A open 12 min, ended at close instant; C ticked | 12 | no / no | yes | 1 | yes |

Totals: tasksDone 1+1+0+1+0+1+1 = 5; focusedMs 20+0+0+32+15+300+12 = 379 min; goldRings 2 (Thu, Sat); daysShowedUp 5 (Mon, Tue, Thu, Sat, Sun); dailyMs [20,0,0,32,15,300,12] min. weekStart 2026-10-26 (Monday, +6 = 2026-11-01). Every value matches the test's assertion. The Saturday auto-close at day end is correct, not at the close instant, so DST and the day-start boundary are handled by real-epoch arithmetic (no wall-clock subtraction).

### Definition checks
- daysShowedUp: `countsOf(weekBundles)` uses `collectionItems(...).length >= 1`, the same item list as the chain (doc 04 §9: planning marble or completed task) and Profile stat (§10: days with >= 1 collection item). Same rule; only the scope (this week's existing rows) differs. OK.
- tasksDone: counts `completedAt !== null` across every day row of the week, including auto-closed days (a task completed before an auto-close really was done). This matches the "TASKS DONE" a user expects. Forwarded tasks have `completedAt` null on the old day, so they count on the day they are finished only (doc 04 §6).
- goldRings / focus instant: `closedAt` is used as `now` for every day. This can only matter for an open session. `closeToday` calls `reconcile()` first, which auto-closes every past open day (sessions ended at that day's end), and the by-hand close ended today's sessions at `at` and applied the ops before `computeMomentsAfterClose` loads bundles (src/state/moments.ts:52-53). So no past day has an open session at that point; past days cannot inflate overtime or focus. The Saturday-running-into-Sunday scenario in the trace test proves it (300 min, not extended to the close).
- weekBundles loads via `listDays(weekStart, today)` -> only days with rows, so missing days contribute 0 and index alignment uses `addDays(weekStart, i) === dayKey`. OK.

### Edge cases (probed with a temporary test, now deleted)
- Only Sunday has a row (Mon..Sat none): week moment = tasksDone 1, focusedMs 720000, goldRings 0, daysShowedUp 1, dailyMs [0,0,0,0,0,0,720000]. Correct real data.
- Forwarded task: Sat A run 10 min and A + C moved at the hand close. Sun rows: A budget 1200 s (leftover 20 min), C, both `forwardedFromDayKey` Sat, `completedAt` null. After Sun A runs 30 min (done, 10 over = gold) and C ticked: tasksDone 2 (Sat 0, Sun 2), focused 2 400 000, goldRings 1, daysShowedUp 1, dailyMs Sat 600000 / Sun 1800000. Correct per §6 (forwarded = not done on the old day). Gold is judged against the forwarded (reduced) budget, which is the stored row's budget.
- Unplanned day (row, no planning marble): shows up only if a task was completed (doc §3/§9/§10); a plan-confirmed day with nothing done counts as showed up through the planning marble (same as chain). Focus is counted either way. Consistent.
- Deleted task: `removeTask` leaves day rows untouched (snapshots, doc §11), so past counts and focus stay.
- Sessions spanning midnight before the day start hour: dayKey is by the 04:00 rule; sessions are attached to day task rows, so focus belongs to the row's day (confirmed by the Sat/Sun DST case where the session crosses midnight and 02:00 clock change).

### Findings
1. NIT, src/domain/moments.ts:119: a day with focus but nothing finished (Fri 15 min) contributes to focusedMs/dailyMs but not daysShowedUp, so the dial could show a wedge on a day not counted as showed up. This follows doc 04 §10 exactly; chunk 3 should not add a "showed up" check mark from `dailyMs > 0`. Fix: none needed; keep the readout derived from the Moment field.
2. NIT, src/state/moments.ts:48-50 comment/contract: `weekBundles` safety (no open sessions on past days) depends on `closeToday` calling `reconcile()` first. If `computeMomentsAfterClose` is ever called from elsewhere without a reconcile, a stale open past day would be counted up to `closedAt`. Fix: a one-line comment on `computeMomentsAfterClose` stating the precondition (optional).

No errors or warnings.

### Test runs
- `npx jest src/state/__tests__/momentsData.test.ts src/domain/__tests__/moments.test.ts`: `Test Suites: 2 passed, 2 total` / `Tests:       27 passed, 27 total`.

## Check A
Verdict: **PASS with warnings** (no ERRORs).

1. Contract: `dailyMs` is a 7-slot array indexed by `addDays(weekStart, i) === dayKey` (Monday first, length fixed, 0 default, any order, same `bundleFocusMs` as `focusedMs`). No other behaviour changed (diff of `moments.ts` is only the type field and the loop). Doc 04 item 5 edit is one phrase and correct.
2. Domain tests: expected arrays are hand-written literals (30/7/5/12 min), not computed by the code under test. The sum test uses `reduce` against `focusedMs` (an invariant check, fine, since the first test pins values). The order test compares against the in-order result, which the first test anchors. Not tautologies.
3. Trace test: only real actions (`createTopic`, `createTask`, `reconcile`, `startTask`, `pauseTask`, `stopTask`, `toggleCheckTask`, `closeToday`). All required scenarios present: no-row day (WED, asserted null), checklist-only day (TUE), gold ring (THU 2 min overtime, SAT), auto-closed day (TUE, SAT, asserted via `closedBy`), task running at Sunday's close (SUN A). Arithmetic in comments re-derived and correct: tasksDone 5, focus 379, gold 2, showed up 5. DST claim verified: `jest.global-setup.js` sets the TZ (America/New_York); SAT day start = 04:00 EDT, +20 h = SUN 00:00 EDT (04:00 UTC); SUN day start = 04:00 EST (09:00 UTC); difference 5 h = 300 min. Comments at lines 18 and 90-93 explain it.
4. Layering/style match `src/state/__tests__/moments.test.ts` (same mock, helpers, `at`).

Findings
- WARNING `src/domain/moments.ts` (week loop, ~line 142): a bundle whose dayKey is outside weekStart..weekStart+6 is added to `focusedMs` but to no `dailyMs` slot, which would break "sums to focusedMs". Not reachable if the caller passes only the week's bundles, but nothing tests or guards it. Fix: add a domain test that documents the assumption, or skip out-of-week bundles in both sums.
- NIT `moments.ts` same line: `addDays` is called 7 times per bundle. Fix: precompute `const keys = Array.from({length:7},(_, i)=>addDays(weekStart,i))` once, then `keys.indexOf(b.day.dayKey)`.
- NIT `momentsData.test.ts:90`: comment says "A starts 20 h after SAT's day start" but the `at()` line 96 reads `at(SAT, 20)`; fine, but add the UTC instants (04:00Z start, 09:00Z close) to make the 300 min check direct.
- NIT `moments.test.ts`: no test for duplicate dayKey bundles (two bundles same day would add up); optional.

Outputs
- `npx tsc --noEmit`: no output (clean).
- `npx eslint src`: no output, exit 0.
- `npx jest src/domain src/state`: `Test Suites: 31 passed, 31 total` / `Tests:       449 passed, 449 total`

## Lead fix (after checks A and B)
- Check A warning (a bundle outside Monday-Sunday counted in `focusedMs` but in no `dailyMs` slot): the week moment
  now filters `weekBundles` to the seven week keys once, and every total (tasks, focus, gold, days showed up,
  `dailyMs`) uses that list. New domain test "ignores a day outside the week in every total".
- Check A nit: the seven keys are computed once (`weekKeys`), `indexOf` picks the slot.
- Check A nit: the DST comment in the trace test gives the UTC instants (04:00Z start, 09:00Z auto-close).
- Check B nit: `computeMomentsAfterClose` documents its precondition (after the close and after `reconcile`).
- Check B nit (a day with focus but nothing finished is not "showed up"): noted for chunk 3; the dial reads
  `daysShowedUp`, never `dailyMs > 0`.

Result: tsc clean, lint clean, `Test Suites: 3 passed, 3 total` / `Tests: 34 passed, 34 total` for the moments
suites; the full suite runs after chunk 2's fixes land.
