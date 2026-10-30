# M4 build run — Today + Run

Started 2026-10-29. Done when (roadmap): a real 5-minute task completes even if you lock the phone midway.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors → Sonnet re-check.
Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Run state (actions, reconcile, hooks) | M1–M3 | [chunk-01](chunk-01-state.md) | PASS after 1 Opus fix (early timer re-arms) |
| 2 | Run UI (rows, bar, big number, celebration, dock) | M2–M3 ui | [chunk-02](chunk-02-ui.md) | PASS after 1 Opus fix (no celebration replay on a done task) |
| 3 | Today screen | 1, 2 | [chunk-03](chunk-03-today.md) | PASS (no fix needed) |
| 4 | Run screen | 1, 2 | [chunk-04](chunk-04-run.md) | PASS (no fix needed) |

## Requirements carried in
- Start/resume runs rollover + pendingCompletions before startDecision (M1).
- Today keeps Edit while today is open (ADR-009); return to Today with dismissTo (M3).
- Pass every past open day to rollover (M1). Jar one-frame-flash watch item (M3).

## Run-level decision
- Auto-close (rollover on start and foreground) is wired in M4 because starting a task needs it; M5 adds the
  Close screen, the Morning screen and the chain on top.

## Requirements carried forward
- Run screen keeps `Celebration` mounted and flips `visible` false→true on completion; never mount it already
  visible. Screens pass `weekdayName(dayKey, locale)` to CheckRow `forwardedFrom`; the TaskRow `a11yLabel` must
  mention gold/done, since those marks are hidden from screen readers. (Chunk 2 fix + check notes.)
- Theme: the danger red `#d4574e` is repeated in Button, TextField and RunScreen; add a theme danger token
  (M7). Note-save delay is 600 ms on Run and 400 ms elsewhere; unify it later. (Chunk 4 check notes.)
- Tests that fast-forward past a completion must use `jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })`;
  reanimated's queueMicrotask chain spins under fake timers (test-only, proven by the chunk 3 check).
- M5: if the app stays open across the day start, Today keeps the old day; add a day-boundary timer that
  reconciles and bumps. Overtime rows on Today don't tick their "+N min extra" (Run does).
- Closed-day rows should announce as disabled (a11y). weekdayName is called without an explicit locale in
  screens (device default); decide a locale source in M7.

## Result (2026-10-29)
All 4 chunks PASS; 3 errors found by checkers (chunks 1, 2; plus none in 3–4), all fixed by Opus and re-checked.
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 43 suites, 445 tests, 98.3 % lines, domain gate holds.
No screen, route or ui file imports `src/data` or `getDb`. **Phone check pending.**

## Phone check (2026-10-29): passed
The user confirmed M4 on the phone: Today counts and checklist ticking, Start/Pause/Resume, leaving Run doesn't
pause, **a 5-minute task completed while the phone was locked**, no celebration replay on reopening, overtime
and gold ring at Stop. **M4 is done.**
