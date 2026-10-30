# Chunk 2 · Timer + checklist rules

## Build (Sonnet)

### Purpose
Pure rules for timed-task focus accounting (doc 04 §4) and checklist ticking (§5): focused/remaining/overtime, the exact completion instant, gold, timer state, start eligibility, pending completions, and display labels.

### Files
- `mobile/src/domain/timer.ts` (exports exactly the contract surface, plus the `TimerState` and `StartDecision` types)
- `mobile/src/domain/__tests__/timer.test.ts` (31 tests)

### Connections now
- Imports: `./types` only (`GOLD_OVERTIME_MS` and types). No `dayKey`, no date-fns, no `Date.now()`.
- Importers: none yet.

### Future connections
- Chunk 4 (rollover): `pendingCompletions` / `completionTime` to settle completions at close or when the app reopens.
- Chunk 5 (collection): `isGold` / `overtimeMs` for the gold flag on items.
- M4 Run screen: `timerState`, `minutesLeftLabel`, `extraMinutesLabel`, `startDecision`.
- M4 Today: `toggleCheck`.

### Decisions & contract/doc conflicts
- No conflicts between contract and docs.
- `completionTime`: sessions sorted by `startedAt` (copy, input not mutated). Returns `startedAt + (budget - accumulated)` for the session where the total reaches the budget, only if that instant is <= `now`. Reaching the budget exactly at `now` counts as complete.
- Budget <= 0 completes at the first session's start (null if there are no sessions, or that start is after `now`). Documented in the code.
- Negative session durations clamp to 0 (`lengthOf`).
- `timerState` trusts `completedAt`; callers must reconcile it from `pendingCompletions` (documented in the code).
- `startDecision`: check order is not_timed, done, day_closed, already_running; otherwise ok.
- `isGold` is evaluated at `now`; for a stopped task pass the stop time as `now`.

### Command outputs summary
- `npx tsc --noEmit`: clean.
- `npx expo lint`: clean.
- `npx jest src/domain`: 2 suites, 62 tests passed (31 timer + 31 dayKey).
- Coverage on `timer.ts`: 100% statements / branches / functions / lines. `mobile/coverage` deleted.

### Known limitations
- Overlapping sessions would be double-counted; the DB's one-open-session invariant and rollover are what prevent them.
- `completionTime` assumes session `startedAt` values are not in the future relative to `now` for closed sessions; an open session that starts after `now` counts as 0.
- Day-boundary clipping of sessions is rollover's job (chunk 4), not handled here.

## Check (Sonnet)

**Verdict: PASS**

### ERRORS
None.

### Verified
- Exports and signatures match contract.md exactly (plus the `TimerState`/`StartDecision` types). Only import is `./types`. No `Date.now()` or argless `new Date()` (grep clean).
- `completionTime`: sorts a copy, walks sessions, returns `startedAt + (budget - acc)`; open session bounded by `now`; `at <= now` guard; exact boundary at a session end and exactly at `now` counts. Unsorted input, mid-session, kill-and-reopen all tested with real assertions.
- Thresholds: gold uses `>= GOLD_OVERTIME_MS` (60_000), tested at 59_999/60_000. `minutesLeftLabel` ceil (540_000 -> 9, 540_001 -> 10, negatives -> 0); `extraMinutesLabel` floor.
- `timerState` covers all 5 states. It trusts `completedAt`, consistent with doc 02's data flow (reconcile writes `completedAt`, then state derives from it).
- `startDecision` order: not_timed, done, day_closed, already_running, ok (with closeSessionId). `pendingCompletions` skips check, completed, and missing session list.
- Chunk 4 rollover: with open sessions closed at dayEndOf (or left open and `now = dayEnd`), `pendingCompletions(dayTasks, sessions, dayEnd)` gives the correct instants. Chunk 5: `isGold(budget, sessions, now)` works for closed sessions (now irrelevant). M4: all labels/state/decision available.

### Non-blocking notes
1. `startDecision` returns `closeSessionId` for an open session belonging to a different DAY (stale, un-rolled-over). The caller would close it at `now`, leaking time into today. Safe only if rollover always runs before any Start (architecture says it runs on start/foreground). The M4 action should run rollover first; no contract change needed.
2. `startDecision` can return ok for a task whose budget was reached but not yet reconciled (completedAt null). Harmless: the caller reconciles first.
3. `isGold` on a still-open session in overtime is evaluated live at `now`; doc says "when the session stops". Callers wanting final gold must pass stop time or only evaluate after stop (chunk 5 days are closed, so fine).
4. Tests do not cover: completion falling exactly at the boundary between two sessions (covered implicitly by the single-session exact-end case; same code path), overlapping sessions (documented limitation).

### Command outputs
- `npx tsc --noEmit`: clean (no output).
- `npx expo lint`: clean (no output).
- `npx jest src/domain`: 3 suites, 97 tests passed (other suites were from parallel builders).
- Coverage timer.ts: 100% statements / 100% branches / 100% functions / 100% lines. `mobile/coverage` deleted.
