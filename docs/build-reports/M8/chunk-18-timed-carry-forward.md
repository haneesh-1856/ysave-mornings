# Chunk 18 · Close: opt-in carry-forward of unfinished time

## What it is for
User request (2026-11-01): at the Close screen, an unfinished timed task with minutes left should get the same choice an unticked checklist task has, "Move to <day>" or "Let it go". It is opt-in only: nothing is ever carried automatically (ADR-014).

## Connections
- Contract: `contract.md` section "Chunk 18". Docs 04 (section 6), 05 (Close row), 10 (ADR-014), 01 and README (non-goal reworded to "automatically carrying").
- Data flow: `useCloseSummary().unfinished` (uses `unfinishedTasks`) -> `CloseScreen` -> `OutcomePicker` -> `closeToday(outcomes)` -> `missingOutcomes` / `closeByHand` (pure) -> `Ops.forwardDayTasks[].addBudgetSec` and `insertDayTasks` -> `applyOps` (one transaction).
- Future: a "carry exactly N minutes" stepper would reuse `addBudgetSec`; stats could count carried minutes from `forwardedFromDayKey` rows. Not built.

## Files
- Domain: `src/domain/rollover.ts` (new `leftoverMinutes`, `unfinishedTasks`; `missingOutcomes(b, outcomes, at)` now takes the close instant; `closeByHand` carries time; `forwardDayTasks.addBudgetSec`). `rollover` (auto-close) is untouched.
- Data: `src/data/repos/ops.ts` (`budgetSec = budgetSec + addBudgetSec` in the same update).
- State: `src/state/actions/close.ts`, `src/state/hooks/useCloseSummary.ts` (`unticked` renamed `unfinished`, `UntickedRow` -> `UnfinishedRow` with optional `leftoverMin`), `src/state/testSupport.ts` (`letGoAll` helper for tests).
- UI: `src/screens/CloseScreen.tsx` ("Not finished today"), `src/ui/OutcomePicker.tsx` (`leftoverMin`: "N min left" line, "Move N min to <day>").
- Tests: see below. Docs: as listed under Connections, plus this report, `contract.md`, `README.md` (M8).

## Build
- Leftover = remaining budget at the close instant (open sessions count up to `now`), rounded up to whole minutes, at least 1, capped at `MINUTES.max` (180; doc `plan.ts` has no other rule: min 5 / step 5 only drive the stepper and are not applied to a carried value).
- Existing next-day row, same non-null taskId: timed -> leftover added to `budgetSec` (total capped at 180 min) and marked forwarded (note fills an empty note only); check -> only marked forwarded; already forwarded -> left alone. Otherwise a new timed row with `budgetSec` = leftover.
- A timed task finished at close (budget reached by `pendingCompletions`) or already completed is not offered. A never-started timed task is offered with its whole budget.
- Display: Today, Plan and Planned list all derive minutes from `budgetSec`, so an increased budget shows its new length without changes.

## Tests
- Domain `rollover.test.ts`: missing/offered rules, rounded-up leftover, whole budget, 1-minute floor, caps, add to existing timed row, check row only forwarded, already forwarded, let_go, completed (also by close), auto-close gives timed no outcome and carries nothing.
- Data `ops.test.ts`: `applyOps` adds budget and marks forwarded in the transaction.
- State `close.test.ts`: partial leftover, whole budget added to a planned row, finished-at-close needs no choice, summary `leftoverMin`.
- UI: `CloseUi.test.tsx` (timed picker label and minutes line), `CloseScreen.test.tsx` (timed row, highlight when unchosen, moving Read).
- Updated because the old expectations changed (a never-started timed task now needs a choice): `rollover.test.ts` (missing list, `both`, outcomes counts, "never forwards timed"), `close.test.ts` (counts 2 -> 3, summary field name), `CloseScreen.test.tsx`, `movedOneOff.test.tsx`, `ops.test.ts` (closeByHand case), `dayNotes.test.ts` and both `defaultAfterPlan` tests (now use `letGoAll()`).

## Errors / open
- `MissingOutcomesError` message is unchanged and valid for both kinds ("Choose Move or Let go for N tasks").
- Not run on a device.

## Outputs
See the final report of this chunk for tsc, lint and jest tails.

## Check
Verdict: PASS (no must-fix errors; two warnings worth a decision).

Outputs: `npx tsc --noEmit` clean (no output); `npx expo lint` clean (no output); `npx jest`: Test Suites 86 passed, Tests 1060 passed (one "worker failed to exit gracefully" notice, pre-existing style warning).

ERRORS: none.

WARNINGS
1. src/domain/plan.ts:45,56 (`clampMinutes`, `dayMinutes`) vs src/domain/rollover.ts leftoverSec: a carried budget is not on the plan grid (min 1, any whole minute). The plan builder clamps to MINUTES.min = 5, so a 1-4 min leftover shows as 5 min in Plan(tomorrow) and `confirmPlan` rewrites `budgetSec = minutes*60`, silently inflating it to 5 min when tomorrow's plan is confirmed or re-confirmed (the Today screen shows the true 1-4 min until then). Also stepper moves 8 -> 13 (off-grid). Scenario: 2 min left, Move, open Plan for tomorrow, Confirm -> row is 5 min. The build report's "min 1 not clamped" claim holds only until the plan is saved. Decide: round the carry up to the grid for display, or let the plan keep sub-5 values.
2. src/state/hooks/useCloseSummary.ts memo / OutcomePicker "N min left" and "Move N min": the summary is a snapshot (no ticker), so with a running task the label can go stale (screen says "Move 8 min", close carries 7). Same for an existing next-day row whose cap trims the add (label says 8, only e.g. 3 added). Behaviour is safe (outcomes for a task that finished meanwhile are ignored; closeByHand recomputes at `now`), only the number can differ.

NITS
- src/screens/TodayScreen.tsx:117-118 only `CheckTaskRow` shows "moved to <day>" from `closeOutcome === 'moved'`; a moved timed row on a closed day shows no such label (not wrong, just inconsistent).
- Case verified OK, no test: null-taskId timed task (code takes the "new row" path, correct); draft vs confirmed next day (same path as checks: existing row matched by taskId whatever the plan state; unplanned day gets a new forwarded timed row). Worth one explicit test each, plus exact-budget-at-close is covered by "used its whole budget".
- No test for the stale-screen case (task finishes between opening Close and confirming); logic handles it.
- Rounding verified by code: ceil(ms/60000) -> 7m20s left = 8, 30s = 1 (tests cover rounded up and 1 min floor). Cap 180 for new and existing rows covered.
- Other readers of closeOutcome/forwardedFromDayKey (plan.ts, PlanRow, PlannedList, RunScreen, TodayScreen, mappers) are kind-agnostic; nothing found in stats/collection/calendar. Forwarded timed rows are pre-ticked in plan and confirmPlan keeps `forwardedFromDayKey`. No misbehaviour found beyond warning 1.
- Layering: screens/ui import only state hooks/actions; OK.
- UI: group title "Not finished today", "N min left" sub line, "Move N min to <day>" / "Let it go", `outcome-missing` highlight kept. The picker's accessibility labels derive from the visible option labels, so they carry the minutes.
- Docs: 01, 04 (section 6), 05, 10 (ADR-014 present, with `addBudgetSec`), README, M8 README/contract consistent with code. Doc 04 diff is 8 insertions / 1 deletion, so its mixed CRLF/LF was not rewritten.

## Lead fix (after the check)

- **Warning 1 fixed: carried time below 5 min or off the 5-min grid.** `dayMinutes` in `src/domain/plan.ts` clamped a stored budget to 5..180. A carried 2 min therefore showed as 5 in Plan(tomorrow), and `confirmPlan` rewrote it to 5. Now a stored budget keeps its whole-minute value (1..180). `stepMinutes` snaps an off-grid length to the grid in the step's direction (13 -> 15 or 10). Below the minimum it only grows (2 -> 5 on +, stays 2 on -). Tests: the old "clamps odd saved budgets" case is replaced by "caps big saved budgets and keeps small or off-grid ones", plus "confirming a plan keeps a carried 2-minute row at 2 minutes" and "stepping an off-grid length snaps to the grid in that direction".
- **Nit fixed: timed rows on Today had no "from <day>" or "moved to <day>" line.** `TaskRow` takes optional `forwardedFrom` and `movedTo`, which are rendered as sub lines under the name and added to the accessibility label. `TodayScreen` passes them for timed rows the same way as for check rows. Test: `RunUi.test.tsx` "carried time shows ...".
- **Warning 2 left as is: the minute figure on the Close screen can be a minute stale for a running task.** The close recomputes at the instant you confirm, so the stored value is always right. Showing a live ticker on Close is not worth the cost.
- **Re-run by the lead:** `npx tsc --noEmit` clean, `npx expo lint` clean, `npx jest` 86 suites / 1063 tests passed.
