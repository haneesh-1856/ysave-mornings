# M1 build run — Data + domain

Started 2026-10-29. Goal (roadmap): `npm test` covers every rule in doc 04, with ≥ 95 % coverage on `src/domain/`.

**Process per chunk:** a Sonnet builder writes the code, tests and the report's *Build* section. A separate
Sonnet checker verifies it against docs 03/04 + [contract.md](contract.md), runs the checks, and writes
the *Check* section. If the checker finds errors, an Opus fixer resolves only those and writes the *Fix* section.

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Domain types + day boundary | — | [chunk-01](chunk-01-types-daykey.md) | PASS (no fix needed) |
| 2 | Timer + checklist rules | 1 | [chunk-02](chunk-02-timer.md) | PASS (no fix needed) |
| 3 | Plan generation + confirm | 1 | [chunk-03](chunk-03-plan.md) | PASS after 1 Opus fix (duplicate insert on pre-filled day) |
| 4 | Close + rollover | 1, 2, 3 | [chunk-04](chunk-04-rollover.md) | PASS (no fix needed) |
| 5 | Collection, calendar, stats | 1, 2 | [chunk-05](chunk-05-collection-calendar-stats.md) | PASS (no fix needed) |
| 6 | SQLite schema + migrations + db | 1 | [chunk-06](chunk-06-schema.md) | PASS (no fix needed) |
| 7 | Repositories + applyOps | 4, 6 | [chunk-07](chunk-07-repos.md) | PASS (no fix needed) |
| 8 | Clock, DB startup wiring, coverage gate | 6, 7 | [chunk-08](chunk-08-wiring.md) | PASS (no fix needed) |

## Run-level decisions
- Forwarded checklist tasks are stored as `day_tasks` rows in the next day. If that day has no `days`
  row yet, one is created with `planConfirmedAt = null` (doc 03 updated to match).

## Requirements carried forward (for later milestones)
- M4 start/resume action: run rollover + `pendingCompletions` **before** `startDecision`, so a stale open
  session from a past day is closed at that day's end (not at `now`), and a task that already reached its
  budget isn't restarted. (Chunk 2 check notes 1–2.)
- State layer (M2+): build `itemCountByDay` from `collectionItems(...).length`; pass only the current
  Mon–Sun bundles to `weekDots`. (Chunk 5 check note 3.)
- State layer (M5): pass **every** past day with `closedAt` null to `rollover` (via `loadOpenPastDays`);
  rollover never touches an open session whose day isn't in that list. (Chunk 4 check note 1.)
- State layer (M3): pass `listTasks()` **plus** `getTask(id)` for any deleted task that a day's rows reference
  into `buildPlan` (§11). `listTasks` orders by topicId, so group by topic order for display. (Chunk 7 notes.)
- Contract amended after chunk 7: `src/data` may make type-only imports from domain files; `applyOps` takes `now`.
- Future migrations (M2+): drizzle-kit table rebuilds emit `PRAGMA foreign_keys=OFF`, which does nothing
  inside the migrator's transaction. Review every generated migration that rebuilds a table. (Chunk 8 note.)

## Result (2026-10-29)
All 8 chunks PASS. 1 error found by checkers (chunk 3), fixed by Opus and re-checked.
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 17 suites, 200 tests; `src/domain` 100 %
on all four metrics (gate ≥ 95 %); all files 97.8 % statements. Every doc 04 rule (§1–§11) maps to a test
(see the chunk 8 Check section). **Still to do before M1 counts as done on the roadmap:** the manual phone
check (chunk 8 report) and the pending M0 phone check.

## Phone check (2026-10-29): passed
The user confirmed in Expo Go: first open with no error screen; splash goes straight to the tabs;
cold restart works (migration correctly skipped); lock and unlock is fine; 4 themed tabs; look switching works.
**M0 and M1 are done.**
