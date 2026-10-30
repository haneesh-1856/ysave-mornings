# M4 · Chunk 1 · Run state

## Build (Sonnet)

### Purpose
The state layer for Today and Run: reconcile (rollover + completions), the run actions (start, pause, stop, tick) and the hooks screens read. Time comes only from stored session timestamps, so a task finishes even if the app was closed.

### Files
- `mobile/src/state/actions/reconcile.ts`: `reconcile()`.
- `mobile/src/state/actions/run.ts`: `startTask`, `pauseTask`, `stopTask`, `toggleCheckTask`.
- `mobile/src/state/hooks/useNow.ts`, `useToday.ts`, `useRunTask.ts` (also `useCompletionWatcher`), `useReconcileOnForeground.ts`.
- `mobile/src/app/_layout.tsx`: one hook call, `useReconcileOnForeground()`, inside `RootStack` (only rendered after migrations succeed, so `setDb` has already run).
- Tests: `src/state/__tests__/run.test.ts`, `reconcileForeground.test.ts`.

### Connections now
- reconcile: `loadOpenPastDays` + today bundle + `listTopics`/`listTasks` -> domain `rollover` -> `applyOps` (one transaction) -> `pendingCompletions(now)` -> `setCompletedAt`. Bumps `days` + `sessions` only if something was written; a second call writes and bumps nothing.
- Run actions call `reconcile()` first, reload today, then the domain decision (`startDecision`/`toggleCheck`) and the repos. Start closes the other running session at the same instant (`startSession`).
- `useToday` reads days/sessions/topics/tasks/settings versions; it never ticks. `useRunTask` = `useToday` row + `useTaskNote` + `useCompletionWatcher`.
- Notes from the Run screen reuse `setTaskNoteFromPlan(taskId, note)` (no new action).

### Future connections
- Chunk 3 (Today): `useToday`, `toggleCheckTask`, `startTask` errors shown via `ValidationError.message`; call `useCompletionWatcher(row)` once per running row component; `useNow` only inside a running row.
- Chunk 4 (Run): `useRunTask`, `startTask`/`pauseTask`/`stopTask`; BigNumber/CountdownBar in an isolated child with `useNow`.
- M5: Close screen uses `closeByHand` + `applyOps`; Morning screen uses `reconcile().autoClosed`.
- M6 calendar/stats read the same day/session rows.

### Decisions
- `useCompletionWatcher` uses one `setTimeout` for the remaining time instead of `useNow` polling: no per-second re-render, fires at ~0 and calls `reconcile()` once (guard ref keyed by task + session list). Backgrounded timers are covered by foreground reconcile.
- `useNow` has no synchronous setState in its effect (lint rule); first tick arrives after one interval.
- `stopTask` on a task without `completedAt` throws a ValidationError; with no open session it is a no-op. `pauseTask` without an open session is a no-op.
- Start errors: done "This task is done for today", day_closed "This day is closed", not_timed "Only timed tasks can be started", already_running "This task is already running"; a task not on today's list throws ValidationError.
- Rows of a removed topic sort after live topics and show "Removed topic".

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npm test`: 41 suites, 420 tests passed.
- `npm run test:coverage`: same 41/420 passed; all files 98.29% statements (gates hold). `mobile/coverage` deleted.

### Known limitations
- `useToday` computes `todayKey` at (re)read time; after midnight with the app open it updates on the next bump or foreground reconcile, not by timer.
- The completion timeout does not fire while the app is suspended; foreground reconcile writes the exact instant instead.
- Hooks are tested with fake timers and a fake clock; the real "lock phone for 5 minutes" check is the phone test.

## Check (Sonnet)

**Verdict: FAIL (1 real defect, small fix).**

### ERRORS
1. `mobile/src/state/hooks/useRunTask.ts` `useCompletionWatcher` (the setTimeout callback, ~lines 28-32): if the timeout fires even slightly early relative to `now()` (remaining still > 0), `reconcile()` writes nothing, `firedFor.current = key` is set, and nothing re-arms. The effect deps (`key`, `budgetSec`, `sessions`) are unchanged and no bump happens, so the task stays "running" with `completedAt` null until the next foreground or bump (the Run screen would show 0 / negative remaining without the celebration). Expected: re-arm or retry until completed. Proof (scratch test, fake timers, clock 1 ms behind the timer): after the timeout fired, `completedAt` null and state `running`; after 10 more seconds still `completedAt` null, state `running`. Fix: in the callback, do not set `firedFor` until it worked: `reconcile(); const left = remainingMs(budgetSec, sessions, now()); if (left > 0) { id = setTimeout(tick, left + 20) } else firedFor.current = key;` (or schedule `delay + 25` ms and loop while remaining > 0). Add a test with a clock 1 ms short.

### Verified OK
- reconcile: loadOpenPastDays has no day limit and the code passes all of them to rollover; library = `listTasks` (probe: deleted task and removed topic referenced by today's row do not break reconcile); rollover then applyOps (one tx) then today's pendingCompletions then setCompletedAt at the exact instant; bumps only on change; idempotent (store untouched on second call); works with no day (prefills). Day boundary probe (H=4, started 03:50, now 04:10 next day): session closed at exactly 04:00 (10 min counted for the old day), no open session left, old day closed 'auto', unticked check let_go. todayKey uses stored day-start hour.
- startTask: reconcile first, so a task already past 0 is completed (not restarted); startDecision; messages human; second start throws "already running"; start after done throws "done"; pause/resume works; stop after hit 0 ends the session at now; stop on not-done throws.
- useToday: sorts by topic order then sortOrder, removed topic last as "Removed topic"; no tick (existing test: render count unchanged after 5 s); memo keyed on store version.
- useNow: initial state is `now()` at mount (fresh, no stale display); first tick after one interval is fine; clears interval. Deviation accepted.
- setTimeout watcher design accepted (fires once at 0 normally, cleans up, re-arms after pause/resume because key changes); only the early-fire gap above.
- useReconcileOnForeground: runs in RootStack after migrations and setDb; mount + 'active'; `sub.remove()`; reconcile is idempotent so repeated calls are cheap. RN AppState.addEventListener returns a subscription with remove().
- Layering: state files import only domain/data/state; no UI imports.

### Non-blocking notes
- No test with two or more stale open past days in one reconcile (code is correct by inspection; add one for the M1 carried requirement).
- No test for the day-boundary session through reconcile (I verified by probe; worth adding).
- `useToday` todayKey stale past midnight without bump: already documented as a limitation; foreground reconcile bumps only if something changed, so an unchanged-state midnight rollover with the app open relies on Chunk 3.
- Delay for a very large budget is far below the 2^31 ms setTimeout cap.

### Command outputs
- typecheck: clean. lint: clean. npm test: 41 suites, 422 tests passed (builder reported 420; scratch test was deleted before the run, the +2 are other checkers or tests added since). test:coverage: All files 98.29% stmts / 98.6 branch / 96.59 funcs; domain 100%; gates hold. `mobile/coverage` deleted. Scratch test removed.

## Fix (Opus)

### Error
Check ERROR 1: `useCompletionWatcher`'s timeout callback set `firedFor.current = key` before knowing reconcile() had completed the task. If the JS timer fired a few ms early (now() still before the completion instant), reconcile() wrote nothing, nothing re-armed (deps unchanged, no bump) and the task stayed 'running' with `completedAt` null until a foreground event.

### Root cause
The guard was set unconditionally on fire. It assumed "timer fired" meant "budget reached", but setTimeout makes no such promise, and the injected clock (`now()`) and the timer clock can drift apart.

### Change
- `mobile/src/state/hooks/useRunTask.ts:10-11`: `REARM_MARGIN_MS = 25`.
- `mobile/src/state/hooks/useRunTask.ts:29-47` (effect): the callback `fire` calls `reconcile()`, then computes `left = remainingMs(budgetSec, sessions, now())`. If `left > 0` it re-arms `setTimeout(fire, left + REARM_MARGIN_MS)` and leaves `firedFor` unset. Otherwise it sets `firedFor.current = key`. The current timer id (initial or re-armed) lives in an effect-local `let id`, which serves as the per-effect ref. Cleanup sets `cancelled` and clears `id`, so re-armed timers are cleared on unmount, pause or key change. The callback also checks `cancelled` before and after reconcile() in case reconcile's bump tears the effect down. Every re-arm waits at least 25 ms, so there is no tight loop. I used a local variable instead of `useRef` so the exhaustive-deps lint rule does not warn about a ref read in cleanup.
- Doc comment updated.

### Tests (`mobile/src/state/__tests__/run.test.ts`)
- `reconcile: stale days and the day boundary` > closes two stale open past days in one reconcile: the 26th has a running session and an unticked check, and the 27th is open and empty. At the 29th, autoClosed is `['2026-10-26','2026-10-27']`, both are closed 'auto' at their own day end, the session ends at the 26th's end, the check is let_go, no open session is left, and a second call closes nothing.
- Same describe > session spanning the boundary (H=4, start 03:50, reconcile 04:10 next day): the session ends at exactly 04:00 (10 min counted for the 28th), autoClosed is `['2026-10-28']`, no open session is left and nothing leaks into today.
- `useRunTask` > re-arms when the timer fires early (clock 1 ms short): after the fire, completedAt is null and the row is 'running'. After 30 more ms, completedAt is `T0 + 5 min` exactly and the row is 'overtime'. I confirmed this test fails with the old unconditional guard.
- `useRunTask` > unmount after an early fire: advancing timers with the clock past the budget leaves completedAt null, so no reconcile runs after unmount.
- `useRunTask` > pause before fire: no completion after 10 more minutes.
- I dropped `jest.getTimerCount()` assertions because the testing library keeps unrelated timers. The tests assert on behavior instead.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest src/state`: 8 suites, 73 tests passed.
- `npm test`: 41 suites, 427 tests passed.
- `mobile/coverage` deleted (was not present after the run).

### Downstream
- Chunk 3 (Today) calls `useCompletionWatcher(row)` once per running row component, and Chunk 4 (Run) gets it through `useRunTask`. The signature is unchanged: `useCompletionWatcher(row: TodayRow | null): void`. Each mounted watcher keeps at most one pending timeout, and it is cleared when the row stops running or unmounts. Mount it only in components whose lifetime matches the row. Mounting it twice for the same row is harmless (reconcile is idempotent) but wasteful.
- When the timer fires early, completion shows up about 25 ms later and is stamped with the exact instant, so the celebration trigger (the row turning 'overtime' or done) can be trusted.

## Re-check (Sonnet)

**Verdict: PASS. No remaining errors in the fixed code.**

### Probes (scratch test `zprobe.test.ts` with `reconcile` spied; deleted afterward)
1. Early fire 1, 50 and 100 ms short: first fire = 1 reconcile, completedAt still null; after the clock catches up (+25 ms timer) completedAt = T0+5min exactly, state 'overtime', total 2 reconciles, none in the next 10 min. Pass.
2. On time: exactly 1 reconcile, row 'overtime', no further reconcile over 10 min (no leftover timers). Pass.
3. Cancellation during a pending re-arm: unmount leaves no late reconcile (count stays 1); pause leaves none for 10 min and completedAt stays null; resume re-arms from the key change and completes. Pass.
4. Same-key rerun: stale empty open past day (27th) made the firing reconcile() change state and bump while the row key stayed the same. The `cancelled` guard returns early, but the re-run effect arms its own timer: the day was auto-closed, then the task completed at exactly T0+5min and became 'overtime'. No skipped re-arm. Pass.
5. Frozen clock (now() never advances): 38 reconciles per simulated second, i.e. one per 25 ms, bounded and not a tight loop. It would continue while frozen, but real clocks advance so it ends after at most about one re-arm. Acceptable, tests only.
6. The 5 new tests are meaningful (early-fire re-arm, unmount after early fire, pause before fire, two stale days, day-boundary session). The re-arm test asserts the null-then-exact-instant sequence, and the fixer reported it fails against the old guard. Minor: the unmount test asserts via completedAt null rather than a reconcile spy, which is weaker but sufficient (my spy probe covers it).
7. Logic review of useRunTask.ts: effect-local `id`/`cancelled`, cleanup clears the current timer, `firedFor` is set only when left <= 0. Correct.

### Commands
- `npx jest src/state`: 8 suites, 73 tests passed.
- `npm run typecheck`: errors ONLY in builder-in-progress files (src/screens/__tests__/RunScreen.test.tsx, TodayScreen.test.tsx); none in src/state.
- `npm run lint`: 3 errors, all in src/screens/RunScreen.tsx:146 and TodayScreen.test.tsx (builder files); none in src/state.
- `npm test`: 41 suites pass; 2 failed (TodayScreen.test.tsx, RunScreen.test.tsx, the parallel builders); 433 passed, 12 failed in those two suites. All state suites pass.
- `mobile/coverage` deleted; probe file removed.
