# Bug 01: a moved task did not show in the next day's plan

## Bug
Phone check: a checklist task was left unticked, the day was closed with "Move to Saturday", but the task did not appear in Saturday's plan. Saturday already held a DRAFT plan (ADR-010, made earlier from the Calendar).

## Reproduction
State-level tests in `src/state/__tests__/movedTask.test.ts` (fake clock, Wed draft, Fri close, Sat start).
- (a) no row for the next day: passed before the fix.
- (b) next day has a draft of other tasks, the moved task is not in it: passed before the fix (row inserted, forwarded).
- (c) `(c) next day draft already holds the same task`: FAILED. The existing row stayed `forwardedFromDayKey = null`, so the plan showed no "from Friday".
- (c2) `(c2) next day confirmed plan already holds the same task`: FAILED for the same reason (after fixing the test's own setup).
- (d) `(d) the forwarded row survives confirming...`, `(d2) an unfinalized draft day starting...`: passed (confirm and rollover already keep forwarded rows).
- `Plan(next day) after the move (Finalize path)` (usePlanDraft): FAILED before the fix (row not marked forwarded).

## Root cause
`closeByHand` (src/domain/rollover.ts) did `if (t.taskId !== null && takenTaskIds.has(t.taskId)) continue;`. When the next day (draft or plan) already held the same library task, which is the normal case for a repeating or default task, the moved task was dropped silently: no new row, and the existing row was never marked forwarded. The task was effectively planned there but without the ticked "from <day>" arrival, and a draft that had unticked/omitted it was never touched.

## Fix
Docs say a moved task becomes a pre-ticked "from <day>" row and are silent on the already-present case; chosen: do not duplicate, mark the existing row as forwarded. `closeByHand` now emits `forwardDayTasks: {dayTaskId, forwardedFromDayKey}[]` for an existing next-day row that is not already forwarded; `applyOps` applies it in the same transaction; `reconcile`'s `isEmpty` counts it. Confirm/finalize/save-draft and rollover were checked and already keep forwarded rows (confirmPlan updates keep `forwardedFromDayKey`).
Not fixed (noted): a Plan screen left open with unsaved edits from before the close holds a stale in-memory draft; confirming it would treat the new forwarded row as unticked and delete it.

## Files
- src/domain/rollover.ts, src/data/repos/ops.ts, src/state/actions/reconcile.ts
- tests: src/state/__tests__/movedTask.test.ts (new), src/domain/__tests__/rollover.test.ts, plus `forwardDayTasks: []` added to Ops literals in ops/PlannedScreen/PlanScreen/RunScreen/TodayScreen/plan/run tests.

## Outputs
- `npx tsc --noEmit`: clean. `npm run lint`: clean.
- `npx jest --silent`: 76 suites, 917 tests, all pass. Domain coverage 100% (rollover.ts, plan.ts).

## Check
