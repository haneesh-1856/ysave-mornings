# Chunk 3 · Plan generation + confirm

## Build (Sonnet)

### Purpose
Pure rules for the Plan screen (doc 04 §2, §3, §11): turn the library + a target day into an editable
`PlanDraft`, edit it immutably, and turn it into DB writes (`confirmPlan`). Also decides which days can be
planned and what an unplanned day is pre-filled with.

### Files
- `mobile/src/domain/plan.ts` (imports only `./types` and `./dayKey`)
- `mobile/src/domain/__tests__/plan.test.ts` (36 tests)

### Connections now
Exports exactly the contract: `buildPlan, setTicked, stepMinutes, setCue, setTreat, addOneOff, canConfirm,
confirmPlan, plannableDays, prefillUnplanned`, plus types `PlanRow, PlanDraft, PlanReason` (and `PlanInput`,
the shared input shape of `buildPlan`/`prefillUnplanned`). Uses `repeatsOn`, `addDays` from dayKey and `MINUTES` from types.

### Future connections
- Chunk 4 (rollover) calls `prefillUnplanned` for an unplanned today and inserts the result.
- Chunk 7 (repos) persists `confirmPlan` output (insert / update / delete) in one transaction.
- M3 Plan screen uses `buildPlan`, the editors, `canConfirm`, `plannableDays`.
- The caller of `confirmPlan` sets `days.planConfirmedAt` if empty and creates the `days` row if missing (plan.ts has no clock).

### Decisions & contract/doc conflicts
- No conflicts with docs found.
- A library task that already has a used dayTask (forwarded, or saved) is not listed a second time.
- Saved row order: rows tied to a live library task sit at the task's sortOrder; forwarded, one-off and
  deleted-task rows come after library rows (by dayTask sortOrder). Forwarded rows always go last even if the task is live.
- Deleted-task rule (§11) falls out naturally: library rows are built only from live tasks, and every used dayTask is a row.
- Tasks whose topic is deleted/unknown are not shown; a dayTask row with such a topic gets a group at the end (first-appearance order).
- Minutes of a saved row = `budgetSec/60`, clamped to 5..180. Check rows have budgetSec 0, so minutes come from the library task, else 15.
- Ticking a `notOn` row does not move it (stays in `notOn`, ticked). There is no "move" function.
- `addOneOff`: blank trimmed name returns the draft unchanged; minutes clamped; new group appended if the topic has none.
- `sortOrder` in `confirmPlan` = index in the whole plan order (groups, then notOn) counting unticked rows, so kept rows with progress cannot collide with inserts.
- Ticked row with a `dayTaskId` missing from `existing` is inserted (with its forwardedFromDayKey).
- `prefillUnplanned` = `confirmPlan(buildPlan(input), [], []).insert` minus forwarded rows (they already exist as rows). Its sortOrders leave gaps where forwarded rows sit; harmless.

### Command outputs summary
- `npx jest src/domain/__tests__/plan`: 1 suite, 36 tests passed.
- Coverage of plan.ts: 100% statements / 100% branches / 100% functions / 100% lines. `mobile/coverage` deleted.
- `npx tsc --noEmit`: no errors in `src/domain/`; remaining errors only in chunk 6's in-progress `src/data/*` (drizzle typings), ignored.
- `npx expo lint`: 0 errors; 2 `import/first` warnings, both in chunk 6's `src/data/__tests__/schema.test.ts`.
- Note: jest briefly failed because chunk 6 had package.json mid-edit (invalid JSON); passed once it was valid.

### Known limitations
- No row-moving, reordering or removal editors (one-offs cannot be un-added except by unticking).
- Note editing is intentionally absent (library repo write).
- Group order for deleted/unknown topics depends on the order of dayTasks passed in.
- Unticked existing rows with progress remain in `existing` but are not shown as rows if the draft was built from a stale `existing`; the caller should pass the same snapshot to both.

## Check (Sonnet)

**Verdict: FAIL** (one real defect, in an edge that §3 prefill makes reachable; everything else conforms).

### ERRORS
1. `mobile/src/domain/plan.ts` `confirmPlan` (lines ~226-262) together with `buildPlan` `used` filter (~line 70). Confirm on a day that has
   prefilled (non-forwarded) `day_tasks` rows but `planConfirmedAt` null (exactly the §3 state after an unplanned rollover, then "Plan today")
   can emit an `insert` whose (dayKey, taskId) already exists in `existing`, violating the unique index (dayKey, taskId).
   `buildPlan` ignores non-forwarded rows when unconfirmed, so the library default task appears as a fresh ticked row with `dayTaskId: null`;
   `confirmPlan` inserts it, and the prefilled row is only removed via `deleteIds` if it has no session/completedAt.
   - Expected: no duplicate (dayKey, taskId) insert ever.
   - Actual (probed with a scratch test, deleted): prefilled row `p` (taskId t) with one session, day.planConfirmedAt null ->
     `{"insert":[{taskId:"t",...}],"update":[],"deleteIds":[]}` -> insert collides with kept row `p`.
     Without a session: `deleteIds:["p"]` plus an insert of the same taskId, which is only safe if the repo runs deletes before inserts (and it discards the row id / completedAt-free state).
   - Fix suggestion (stays within the contract): in `confirmPlan`, for a ticked row with no matching `dayTaskId`, if `existing` contains a row with the same non-null `taskId`,
     treat it as that row (push an update with budgetSec/cue/treat/sortOrder, mark it updated) instead of inserting. Alternatively `buildPlan` could map unconfirmed non-forwarded rows
     onto same-taskId library tasks (setting dayTaskId); that deviates from the contract sentence "only rows with forwardedFromDayKey are used", so prefer the confirmPlan fix.
     Add tests: prefilled row with a session + unconfirmed day -> no insert for that taskId; prefilled row without progress -> update, not delete+insert.

### Verified OK (no defect)
- Exports/signatures match the contract; extra `PlanInput` is harmless. Imports only `./types` and `./dayKey`. Pure; editors immutable (tested; unknown key returns same draft).
- Every §2 table row, confirmed-plan start state, per-day edits not touching library (only plan rows change), Confirm replace/keep/insert/update semantics, snapshots, budgetSec (minutes*60 timed, 0 check), `plannableDays`, §3 prefill, §11 deleted tasks keep their row: all correct.
- Confirmed-plan duplicates: a library task with a forwarded/saved row is not listed twice (usedTaskIds), so untick-then-retick of an existing row stays an update; an unticked existing row with progress is kept and generates no insert. No duplicate arises when the draft and `existing` come from the same snapshot.
- 15-min fallback for check rows: sound (minutes is irrelevant to check budgetSec 0; deleted/orphan check rows show 15). Deleted topic: dayTask-referenced groups appended; library tasks of deleted topics hidden. Fine.
- Builder decisions judged against docs: all acceptable. Forwarded rows always sorted after library rows is a UI choice, not contradicted by docs.

### Non-blocking notes
- Dedupe of check-forwarded rows relies on rollover (chunk 4) calling `prefillUnplanned` only when today has no non-forwarded rows (contract says so); prefill itself would re-emit defaults if called twice with only prefilled rows (since non-forwarded rows are ignored). Same root cause as error 1: consider letting `prefillUnplanned` also skip taskIds present in `input.dayTasks`.
- Chunk 7 must apply deletes before inserts and set `planConfirmedAt`/create the `days` row; the plan.ts doc comment states the latter. API gap: no helper to move a notOn row or remove a one-off (documented limitation).
- `prefillUnplanned` sortOrders have gaps (harmless).

### Commands
- `npx tsc --noEmit`: no errors outside `src/data/*` (ignored).
- `npx expo lint`: no output errors attributable to plan.ts/plan.test.ts.
- `npx jest src/domain`: 6 suites, 119 tests passed.
- Coverage plan.ts: 100% statements / branches / functions / lines. `mobile/coverage` deleted; scratch probe test deleted.
- Tests are behavioural (exact outputs), cover all rules except the prefilled-unconfirmed-day confirm case in error 1.

## Fix (Opus)

### Error
Check error 1: on an unconfirmed day (`planConfirmedAt` null) that already has prefilled, non-forwarded `day_tasks` rows (the state after an unplanned rollover, doc 04 §3), Confirm could emit an insert for a (dayKey, taskId) pair that already exists. If the prefilled row had a session or completedAt, that hits the unique index (doc 03). If it had neither, the row was deleted and inserted again, which loses its id and only works if the repo runs deletes before inserts.

### Root cause
`buildPlan` used only forwarded rows on an unconfirmed day (`used = dayTasks.filter(forwarded)`). A prefilled row was therefore invisible, so its library task showed up as a new ticked row with `dayTaskId: null`, and `confirmPlan` turned it into an insert. Nothing in `confirmPlan` checked `existing` by taskId.

### Changes (`mobile/src/domain/plan.ts`)
- L52-55: new helper `dayMinutes(d, lib)`. It moves the existing rule into one place: budgetSec/60, clamped; check rows use the task's minutes, else 15. Saved rows and attached rows both use it.
- L75-158 `buildPlan` (contract amendment):
  - On an unconfirmed day, each non-forwarded row whose taskId points to a visible library task is put in `attached` (L100-110). Visible means not deleted, a non-blank name and a live topic.
  - That library row keeps its key (task id), its reason ('default' / 'repeats' / 'not_on_day') and its group or notOn position. It also gets `ticked: true`, `dayTaskId`, the day row's minutes, and the day row's cue and treat (L154-156).
  - Every other existing row still goes through the 'saved' / 'forwarded' path. That includes a prefilled row whose task was deleted (§11) and a row with a null taskId. The `visible` predicate replaces the old inline filter, with the same behaviour.
- L268-300 `confirmPlan` guard: a ticked row with no matching `dayTaskId` whose non-null taskId already exists in `existing` becomes an update of that row. If that row is already updated, or another ticked draft row claims it through its `dayTaskId`, the duplicate is dropped. No insert can collide on (dayKey, taskId). This is documented in the JSDoc.
- L333-341 `prefillUnplanned`: passes `input.dayTasks` as `existing`. Rows that are already present (forwarded rows, an earlier prefill) become updates, and the guard skips taskIds that are already there. Only genuinely new rows come back, so a second call returns `[]`. The old forwarded-row filter is no longer needed: forwarded rows are now in `existing`, so they come back as updates, never as inserts.

### Tests (`mobile/src/domain/__tests__/plan.test.ts`)
- L50: the old test "ignores non-forwarded dayTasks" encoded the bug. It now asserts that the prefilled row attaches (`dayTaskId: 'x'`, ticked, reason 'default').
- New describe block at L72: attached rows keep their library key, reason and position (default / repeats / not_on_day / check minutes) and take the day row's values. A deleted-task row and a no-task row become ticked 'saved' rows.
  - (1) Prefilled row with a session: no insert for its taskId; one update.
  - (2) No progress: update, no delete and insert.
  - (3) Unticked with no progress: deleteIds contains it and there is no insert.
  - Extra: unticked with a session: kept untouched.
- (4) L394: a hand-built draft for the guard. A taskId match becomes an update, a second row for the same taskId is dropped, a row whose match is claimed by another row's dayTaskId is dropped, and genuinely new rows and one-offs are still inserted.
- (5) L458: `prefillUnplanned` twice returns `[]` the second time. When some rows are already present, only the missing default comes back.

### Commands (from `mobile/`)
- `npx tsc --noEmit`: exit 0, no errors.
- `npx expo lint`: exit 0, no output.
- `npx jest src/domain --coverage --collectCoverageFrom=src/domain/plan.ts`: 6 suites, 127 tests passed (was 119). plan.ts is at 100% statements, branches, functions and lines.
- `mobile/coverage` deleted.

### Effect on downstream chunks
- Chunk 4 (rollover): calling `prefillUnplanned` is now safe even when today already has prefilled rows, because it is idempotent. The contract's "call only when no non-forwarded rows" is no longer needed for correctness, but it still holds. If rollover passes forwarded rows in `dayTasks`, they are not returned again, the same as before.
- Chunk 7 (repos): Confirm on a prefilled day now produces updates instead of delete plus insert, so the repo no longer depends on running deletes before inserts to avoid this collision. Running deletes first is still the safe order. The caller still sets `planConfirmedAt`.
- M3 Plan screen: on an unconfirmed day with a prefill, a row's key stays the task id (not the dayTask id). It shows the day row's minutes, cue and treat. It can be ticked or unticked like any library row, and stays in its normal group or "Not on <weekday>" position.

## Re-check (Sonnet)

### Verdict: PASS

### Remaining errors
None.

### Verification
1. Error 1 gone. Exhaustive scratch test (deleted): 2 (confirmed or not) x 243 existing-row combinations over 5 tasks (none / prefilled / forwarded; some with completedAt, some with sessions; including a deleted task) x 8 tick-toggle patterns = 3888 confirms. In every case: no insert has a taskId present in `existing`, no taskId appears twice in inserts, no id is updated twice, and no deleteId is updated or has a session/completedAt. Passed.
2. L50 test now asserts `{reason:'default', ticked:true, dayTaskId:'x'}` and that no separate 'x' row exists. This follows the amended contract (prefilled rows attach by taskId). It is not weakened. Five new tests cover: with session, no progress, unticked with and without progress, the guard, and idempotence.
3. `prefillUnplanned` idempotent: for all 243 existing-row combinations, feeding the first result back as existing rows returns []; the first result never contains an already-present taskId. With no existing rows it returns the defaults (a, c).
4. Doc 04 §2 table: default (ticked), repeats (unticked), not-on-day (unticked, notOn), forwarded (ticked, own group), one-off (ticked), and the confirmed-plan start state are all intact. The existing tests for these pass. Contract text matches the code.

### Commands (from mobile/)
- `npx tsc --noEmit`: exit 0, no output.
- `npx expo lint`: no output.
- `npx jest src/domain --coverage --collectCoverageFrom=src/domain/plan.ts`: 6 suites, 127 tests passed. plan.ts is at 100% statements, branches, functions and lines.
- Scratch test and `mobile/coverage` deleted.
