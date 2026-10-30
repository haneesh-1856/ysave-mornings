# M2 build run — Topics tab

Started 2026-10-29. Done when (roadmap): you can build your real topics and tasks on the phone; they survive an app restart.

Same process as M1: Sonnet builder → separate Sonnet checker → Opus fixer only on errors. Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | State plumbing + library actions | M1 | [chunk-01](chunk-01-state.md) | PASS (no fix needed) |
| 2 | UI primitives | M0 theme | [chunk-02](chunk-02-ui.md) | PASS after 2 Opus fixes (error-mapper realm bug, nested gesture root) |
| 3 | Topics screen + flip card | 1, 2 | [chunk-03](chunk-03-topics-screen.md) | PASS (no fix needed) |
| 4 | Topic new / edit | 1, 2 | [chunk-04](chunk-04-topic-form.md) | PASS after 2 Opus fixes (layer import, double-tap guard) |

## Requirements carried in from M1
- Build `weekDots` input from the current Mon–Sun bundles only.
- `listTasks` orders by topicId; group by topic order for display.

## Requirements carried forward
- M4: `useTopicsLibrary` captures `now()` inside its memo; if running sessions ever affect week dots, add a
  tick dependency. Add `src/state` to coverage collection when it grows. (Chunk 1 check notes.)
- Screens import error classes from `@/state/errors`, never `@/data`. Forms reuse the submit-guard pattern
  (ref + busy) from `src/app/topic/*`; consider a `useSubmitGuard` hook in M3. An unexpected (non-validation)
  error leaves the form busy; revisit with a friendly error state later. (Chunk 4 fix + re-check.)
- Contract amended after chunk 3: `src/screens/` holds route implementations (ui + state + domain types; never data).
- Every save re-renders all folds (fine now; virtualize if a topic exceeds ~30 tasks). Android keyboard spacer may
  add extra blank space if the window also resizes; check on device. (Chunk 3 check notes.)

## Result (2026-10-29)
All 4 chunks PASS; 4 errors found by checkers (chunks 2 and 4), all fixed by Opus and re-checked.
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 29 suites, 278 tests, 98.3 % lines, domain gate holds.
No screen or route imports `src/data`. **Phone check pending.**

## Phone check (2026-10-29): passed
The user confirmed all 8 checks in Expo Go: new topic with live preview; edit colour; add a task (a blank draft
is dropped); flip card; slider drag vs scroll; keyboard over the note; delete confirm; **everything survives a
full app restart**. **M2 is done.**
