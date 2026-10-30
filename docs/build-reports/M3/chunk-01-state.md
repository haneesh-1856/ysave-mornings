# M3 · Chunk 1 · Plan state

## Build (Sonnet)

### Purpose
Give the Plan and Planned screens their state: which days can be planned, an in-memory plan draft, the confirm action, the stored-plan read hook, and the shared double-submit guard.

### Files
- `mobile/src/state/hooks/usePlannableDays.ts`: `usePlannableDays`.
- `mobile/src/state/hooks/usePlanDraft.ts`: `usePlanDraft`, `PlanDraftApi` type.
- `mobile/src/state/hooks/useDayPlan.ts`: `useDayPlan`.
- `mobile/src/state/hooks/useSubmitGuard.ts`: `useSubmitGuard`.
- `mobile/src/state/actions/plan.ts`: `confirmDayPlan`, `setTaskNoteFromPlan`.
- `mobile/src/state/__tests__/plan.test.ts`: 22 tests.
- Edited: `mobile/src/app/topic/new.tsx` and `[id].tsx` now use `useSubmitGuard` (see Decisions).
- No new error class: `ValidationError` (already re-exported by `src/state/errors.ts`) is reused.

### Connections now
Hooks read repos (`days`, `tasks`, `topics`, `settings`) and the domain (`plan`, `collection`, `dayKey`) through `getDb()`/`now()`, and re-read via `useDataVersion`. `confirmDayPlan` calls `confirmPlan` then `saveConfirmedPlan` and bumps `'days'`. `setTaskNoteFromPlan` calls the tasks repo and bumps `'tasks'`. Topic new/edit screens use the guard. Nothing in the plan UI uses these yet.

### Future connections
- Chunks 4-5: PlanScreen uses `usePlanDraft`, `usePlannableDays`, `confirmDayPlan`, `setTaskNoteFromPlan`, `useSubmitGuard`; PlannedScreen uses `useDayPlan`; the Today placeholder uses `usePlannableDays`.
- M5 Close -> "Plan tomorrow" routes to `/plan/<tomorrow>`; the same hooks apply.
- M6 Calendar tomorrow -> Plan: same route and hooks.
- M4 Today reads `useDayPlan(todayKey).rows` (sorted DayTasks) and `items`.

### Decisions
- `usePlanDraft`: the base plan (buildPlan) is a `useMemo` keyed on `[db, dayKey, todayKey, version('days','settings')]`; edits live in `useState` keyed by dayKey. Dirty edits always win over a rebuilt base; a clean draft follows the stored plan when `'days'` bumps. Note edits (`'tasks'` bump) do not rebuild the draft. Switching dayKey drops the other day's edits.
- Deleted tasks: every `taskId` in the day's rows that is missing from `listTasks` is fetched with `getTask` and appended to the input.
- `toggle` flips `ticked` using the current row; unknown key is a no-op (domain behaviour). For a confirmed day, saved rows are keyed by dayTask id, not task id (tests use that).
- `addOneOff` looks up the topic for `colorKey`; an unknown topic is ignored (no row).
- Not plannable: `draft` null, `plannable` false, `dirty` false, `canConfirm` false, editors no-op.
- `confirmDayPlan` re-checks plannable using today's Day and `getDayStartHour` at call time, throws `ValidationError('dayKey', ...)`, uses `{...draft, dayKey}`, flattens `sessionsByDayTask` for `confirmPlan`, and passes the day-start snapshot to `saveConfirmedPlan`.
- `useSubmitGuard.run` returns `undefined` when blocked; busy stays true after success; a throw resets then rethrows.
- Topic screens refactor: both now `try { run(() => { action; router.back() }) } catch (ValidationError) { setError }`. Behaviour is the same for the success and validation paths; one small difference: a non-Validation error (or a Remove error) now also resets `busy` before propagating, where before the buttons stayed disabled. No tests exist for those routes; the guard itself is tested. If strict identity matters, revert them.
- Tests use `await renderHook` / `await act(async ...)` (RNTL 14).
- No changes to `src/domain` or `src/data`.

### Command outputs
- `npm run typecheck`: no errors in my files; errors only in the parallel builder's in-progress `src/ui/collection/__tests__/Jar.test.tsx` seen mid-run (ignored as instructed); a later run was clean.
- `npm run lint`: clean.
- `npm test`: 34 suites, 344 tests pass (state: 5 suites, 43 tests).
- `npm run test:coverage`: see final reply (run in background; `mobile/coverage` deleted).

### Known limitations
- `src/state` is outside `collectCoverageFrom`, so no coverage gate for it.
- Hooks do one `getDayStartHour` query per render (same as M2).
- Edits are lost if `dayKey` changes (by design, doc 04 section 2: leaving discards).
- If the day's stored plan changes underneath a dirty draft, the draft is kept as-is (no merge, no warning).

## Check (Sonnet)

**Verdict: FAIL** (1 real defect: draft changes mid-navigation after confirm; everything else conforms)

### ERRORS
1. `mobile/src/state/hooks/usePlanDraft.ts:45-69` (interaction with `actions/plan.ts:33` `bump('days')`) - expected: after Confirm on the Plan screen the rows do not change while `router.replace('/planned/<day>')` animates (contract: draft built once per dayKey; rebuild only on external change). Actual: `confirmDayPlan` bumps `'days'`, so `base` is rebuilt and:
   - confirming **today** (an unplanned today is plannable): `plannableDays` now excludes today, so `plannable` flips to false and `draft` becomes `null` -> PlanScreen would flash "You can plan tomorrow, or today if it has no plan yet." (clean or dirty draft alike).
   - confirming **tomorrow with a clean (unedited) draft**: the rebuilt base has every row `reason: 'saved'`, so all subtitles switch from "default"/"repeats..." to the minutes. A dirty draft is unaffected.
   Proof (scratch test, deleted): tomorrow clean `default -> plannable true, reason 'saved'`; today `-> plannable false, draft undefined`. Existing test "rebuilds when the stored plan changes underneath" asserts the clean-rebuild but nothing covers the confirming screen itself.
   Fix (either): (a) in `usePlanDraft`, keep the last non-null `{plannable, base}` for the same dayKey in a ref/state and ignore a rebuild that was caused by this hook's own confirm (e.g. expose `markConfirmed()` / have PlanScreen render its last draft while `useSubmitGuard().busy` is true, since busy stays true after success); or (b) require chunk 4 to snapshot the draft when Confirm is pressed and render the snapshot while busy. Add a test: confirm via the hook's own draft and assert `draft` is unchanged (and non-null for today) afterwards.

### Non-blocking notes
- Switching A -> B -> A without editing B revives A's old edits (`edited` is only replaced on an edit, `usePlanDraft.ts:67-68`). The screen normally unmounts so it is harmless; clearing `edited` when `dayKey` differs would be tidier.
- `edit` identity changes whenever `base` rebuilds (dep `[base, dayKey]`), so editor callbacks are not stable across a 'days' bump; they are stable otherwise. Closures are correct (functional `setEdited`, `db`/`edit` deps right).
- `useDayPlan` rows sorted by sortOrder, items include the planning marble (tested), re-reads on 'days'/'sessions'. `usePlannableDays` correct. Layering OK (state imports data+domain only; no UI).
- `confirmDayPlan` verified: re-checks plannable with today's Day and `getDayStartHour` at call time, loads existing rows + flattened sessions, passes day-start snapshot, bumps 'days', throws `ValidationError` when not plannable (tested for past day and for today after planning); re-confirm keeps progress rows and `planConfirmedAt` (tested). Totals: ticked count, minutes of ticked timed rows only (tested). Deleted-task input via `getTask` (tested). One-off colorKey from topic (tested); unknown topic ignored.
- Planned "Edit" for a day that is today (already planned) leads to a not-plannable Plan screen by contract (today only plannable while unplanned); chunk 5 should only offer Edit for tomorrow or accept that.
- useSubmitGuard vs M2: the topic routes' behaviour change is acceptable and arguably better. M2 reset only on ValidationError and left busy stuck after any other error or a failed Remove (M2 re-check explicitly called this "acceptable, note for later"); now every thrown error resets busy then rethrows, so the user can retry. ValidationError still re-enables Save (topicRoutes tests at :102 and the edit ValidationError test pass). Builder's claim "no tests exist for those routes" is wrong (topicRoutes.test.tsx and TopicForm.test.tsx exist) but the changed behaviour is not asserted by them; no test covers non-validation reset. Mutation: removing `if (running.current) return undefined;` from the hook makes 4 tests fail (guard unit test, new double Save, edit double Save, edit double Remove); restored byte-identical. Double-tap guarantee intact.
- The `run` generic signature `run<T>(fn: () => T): T | undefined` matches the contract.
- Unrelated: during the coverage run `src/ui/__tests__/PlanControls.test.tsx` (chunk 2, being built in parallel) failed 10 tests (PlanRow); it passed in the earlier `npm test`. Not in this chunk's scope.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npm test`: 34 suites, 344 tests passed. `jest topicRoutes + TopicForm`: 2 suites, 21 passed.
- `npm run test:coverage`: All files 98.29 % stmts / 98.05 % branch / 96.59 % funcs / 98.29 % lines; `domain` row 100 / 100 / 100 / 100, no threshold failure message (the run's only failure was the parallel PlanControls suite; the process exit was from that). `src/state` is outside `collectCoverageFrom`. `mobile/coverage` deleted.

## Fix (Opus)

### Error
Check ERROR 1: after Confirm, `confirmDayPlan`'s `bump('days')` (`actions/plan.ts:33`) rebuilt `usePlanDraft`'s base mid-navigation. Confirming today flipped `plannable` to false and `draft` to null (PlanScreen would flash "You can plan tomorrow..."); confirming a clean tomorrow draft flipped every row's `reason` to `'saved'` (subtitles flash).

### Root cause
The hook had no idea that a 'days' bump was caused by its own confirm, so it treated it as an external change: the plannable check and the clean-draft rebuild both follow the store by design.

### Change
- `mobile/src/state/hooks/usePlanDraft.ts`
  - `:36-40` `PlanDraftApi.confirm(): void` added (amended contract).
  - `:78-84` frozen snapshot `{ dayKey, draft, dirty }` in `useState`; while it matches `dayKey`, `draft`, `plannable` (true), `dirty` come from it, so `totals` and `canConfirm` (derived from `draft`) stay the same object/values.
  - `:86-92` `current` / `frozenRef` refs synced in an effect after each commit, so `confirm` can have `[]` deps (stable identity).
  - `:94-101` `confirm()`: calls `confirmDayPlan(dayKey, currentDraft)`; on success sets `frozenRef` + `setFrozen` (batched with the bump, so no render ever shows the rebuilt base); on error nothing is frozen and the error propagates (so `useSubmitGuard.run` resets busy). No draft -> throws `ValidationError`. A second call after a freeze is a no-op.
  - `:105` editors are no-ops once frozen.
- `actions/plan.ts`: unchanged; `confirmDayPlan` stays exported for other callers.

### Tests (`mobile/src/state/__tests__/plan.test.ts`, new `describe('usePlanDraft confirm()')`)
- today unplanned: confirm through the hook -> day written; draft deep-equal and non-null, `plannable` true, totals/canConfirm unchanged, `confirm` identity stable; a later unrelated 'days' write still does not rebuild it; a fresh mount sees today as not plannable.
- tomorrow clean: rows written; draft deep-equal, no row with reason `'saved'`, `plannable` true, `dirty` false; a fresh mount sees `'saved'` rows.
- failing confirm: today planned elsewhere first -> the hook follows the store (not plannable), `confirm()` throws `ValidationError`, still not frozen.
- dirty draft: frozen as edited (same object), later edits ignored.
- Mutation: making the hook ignore the frozen snapshot fails the today and tomorrow tests (2 failures); restored.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest src/state`: 5 suites, 47 tests passed.
- `npm test`: 34 suites, 349 tests passed.
- `mobile/coverage` deleted.

### Downstream effect
Chunk 4 PlanScreen must call `confirm()` from the hook (not `confirmDayPlan` directly) inside `useSubmitGuard().run(() => { plan.confirm(); router.replace('/planned/<dayKey>'); })`, catching `ValidationError` to show an error (the guard has already reset). Calling `confirmDayPlan` directly would bring the flash back.

## Re-check (Sonnet)

**Verdict: PASS** for the reported error (freeze works, scoped, rethrows, stable, editors no-op). One low-severity hardening note (stale snapshot when edit+confirm run in the same batch; not reachable from separate UI events).

### Verified (probe test, deleted; source untouched)
1. Freeze: today clean and tomorrow clean confirm -> draft/plannable/dirty/totals/canConfirm unchanged after the 'days' bump (also covered by the Opus tests; 47 state tests pass).
2. Failing confirm throws ValidationError and does not freeze (existing test passes).
3. dayKey scoping: confirm TOMORROW, rerender with TODAY on the same mount -> plannable true, draft.dayKey = TODAY, edits work (dirty true), confirm writes today; rerender back to TOMORROW shows the stored plan (reason 'saved'), i.e. unfrozen/follows the store.
4. Stable identity: asserted by existing test. Edit then confirm in SEPARATE acts (real taps): saved plan includes the edit (1 row). 
5. Editors (toggle, step) after freeze: draft same object, dirty false.

### Remaining error (low severity, robustness)
`mobile/src/state/hooks/usePlanDraft.ts:88-92` + `:94-101`: `current`/`frozenRef` are synced in a passive `useEffect`, so `toggle(k); confirm();` inside ONE act/batch confirms the pre-edit draft. Proof: probe saved 2 rows (edit lost) and the frozen draft still showed the row ticked. Real taps are separate discrete events (effects flush between them), and the separate-act probe saved the edit, so PlanScreen is not affected today.
Exact fix (optional): in `edit`, mirror the edit into a ref synchronously, e.g. keep `editedRef` updated inside the `setEdited` call site (`editedRef.current = {dayKey, draft: fn(editedRef.current?.dayKey===dayKey ? editedRef.current.draft : base)}; setEdited(editedRef.current)`) and have `confirm` build its snapshot from `editedRef.current ?? current.current`; or change `useEffect` to `useLayoutEffect` (does not fix same-batch).

### Command outputs
- `npm run typecheck`: only errors in builder file `src/screens/PlannedScreen.tsx` (57, 75: `/plan/[dayKey]` route type, parallel work); none in state.
- `npm run lint`: clean.
- `npx jest src/state`: 5 suites, 47 tests passed.
- `npm test`: 34 passed, 1 failed suite (3 tests) - in a parallel builder's area, not state; see below if listed. `mobile/coverage` deleted.

## Change (Opus) · ADR-009 today stays editable

### Change
User decision 2026-10-29 (ADR-009, doc 04 §2): today stays plannable while it is open (not closed), including
after its plan was confirmed. Tomorrow always; never a past day. Re-confirming keeps every row with sessions or
completedAt (confirmPlan, unchanged) and planConfirmedAt keeps its first value (verified: `saveConfirmedPlan`
sets it only `WHERE planConfirmedAt IS NULL`, mobile/src/data/repos/days.ts:136-137; covered by
data/__tests__/days.test.ts:58-62).

### Files
- mobile/src/domain/plan.ts:327-335 — `plannableDays` keys on `today?.closedAt != null` (was planConfirmedAt); doc comment updated. Signature unchanged.
- mobile/src/state/actions/plan.ts, mobile/src/state/hooks/usePlanDraft.ts — no code change; both call plannableDays, so re-confirming today now passes. Freeze-after-confirm unchanged.
- mobile/src/app/(tabs)/today.tsx:38 — "Plan today" only while today is plannable AND unplanned (Edit takes over once planned).
- mobile/src/app/(tabs)/today.tsx:44-50 — "Today is planned" card: Edit (a11y "Edit today's plan", push to /plan/[todayKey]) next to See, while today is plannable.
- mobile/src/screens/PlanScreen.tsx:27 — not-plannable text: "You can plan today until it closes, or tomorrow."
- mobile/src/screens/PlannedScreen.tsx — no change; its Edit already shows when plannable, so it now appears for an open today.
- docs/build-reports/M3/contract.md — Chunk 1 note added.

### Tests
- mobile/src/domain/__tests__/plan.test.ts:432-446 — closed today (confirmed or not) → [tomorrow]; confirmed-but-open today → [today, tomorrow].
- mobile/src/state/__tests__/plan.test.ts — `closeToday()` helper (applyOps closeDays/createDays, :50); usePlannableDays keeps today after confirm (:71) and drops it once closed; fresh mount after confirm is plannable with 'saved' rows (:231); failing confirm now caused by closing today; past-day confirm throws; closed-today confirm throws and writes nothing; re-plan today after confirming (:365): a row with a session is unticked and stays, a row with no progress is removed, planConfirmedAt unchanged at a later clock.
- mobile/src/screens/__tests__/PlannedScreen.test.tsx — Planned shows Edit for an open planned today (:130) and hides it for a closed today; Today shows "Edit today's plan" pushing /plan/[today] (:211); closed today shows See only, no Edit, no Plan today.
- mobile/src/screens/__tests__/PlanScreen.test.tsx — closed today shows the new message; re-opening a confirmed today shows "Plan today", Confirm keeps planConfirmedAt (:135).

### Command outputs (from mobile/)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npm test`: 37 suites, 382 tests passed.
- `npm run test:coverage`: All files 98.29 stmts / 98.6 branch / 96.59 funcs / 98.29 lines; domain 100/100/100/100 (gate passed). `mobile/coverage` deleted.
- Layering grep (`@/data|getDb` in src/app, src/screens, src/ui excl. __tests__ and _layout.tsx): no matches.

### Downstream notes
- M5: closing a day (by hand or auto) sets closedAt, which is now what makes today non-plannable; Edit disappears from Today and Planned and the Plan route shows the not-plannable message.
- M4: the real Today screen must offer Edit for today's plan while today is open (same `days.includes(todayKey)` check), plus See; "Plan today" only while today is unplanned.
- Honesty trade-off (ADR-009): unticking an unfinished task late in the day is allowed; the app does not police it.

## Re-check (Sonnet) · ADR-009

**Verdict: PASS. No remaining errors.**

Checked:
1. `plannableDays` (domain/plan.ts:332) returns `[tomorrow]` when `today.closedAt != null`, else `[today, tomorrow]`; never past. Matches ADR-009 and doc 04 §2. Domain coverage 100/100/100/100.
2. `confirmPlan` keeps rows with sessions/completedAt even when unticked (deleteIds excludes them), deletes untouched unticked rows, and the taskId guard turns would-be duplicate inserts into updates or drops them. `saveConfirmedPlan` (data/repos/days.ts:136-137) sets planConfirmedAt only `WHERE planConfirmedAt IS NULL`, so the first value stays.
3. Closed today: `confirmDayPlan` throws ValidationError (state/actions/plan.ts:20); PlanScreen shows the not-plannable message (:27, :57); Today and Planned show Edit only when `days.includes(...)`.
4. Today: "Plan today" only when plannable and unplanned (today.tsx:38); the planned card shows See + Edit (a11y "Edit today's plan") while plannable.
5. Freeze-after-confirm: usePlanDraft path unchanged and still tested (all suites green).
6. Layering grep (src/app, src/screens, src/ui excl. tests and _layout): no matches.
7. Commands (from mobile/): typecheck clean; lint clean; `npm test` 37 suites / 382 tests passed; `npm run test:coverage`: All files 98.29 stmts / 98.6 branch / 96.59 funcs / 98.29 lines; domain 100/100/100/100 (gate passed). mobile/coverage deleted.
