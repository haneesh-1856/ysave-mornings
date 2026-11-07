# M14 build run · Insights

Started 2026-11-05. Picks (user, Insights Picker `picks/current`, saved 2026-11-05 23:36 UTC): all 12 insights, last
30 days. Contract: [contract.md](contract.md).

Done when: Profile > Insights shows the 12 insights for the last 30 days, every number traced to stored days, tasks
and sessions by a data trace test built with the app's own actions, and the wording only describes.

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Domain: the 12 calculations | existing rules | [chunk-01](chunk-01-domain.md) | PASS (A: 1 must-fix, fixed by lead + 6 edge tests incl. DST; B data audit: PASS) |
| 2 | State: load the window + data trace test | 1 | [chunk-02](chunk-02-state.md) | PASS (A: 1 must-fix, fixed by lead; B data audit: PASS) |
| 3 | Screen: Insights in Profile | 2 (interface) | [chunk-03](chunk-03-screen.md) | PASS (A: warnings; B: 2 display errors; all fixed by a fixer pass) |

## Lead verification (2026-11-05)
tsc clean, lint clean, no stray characters, no probe files left, `Test Suites: 117 passed, 117 total`,
`Tests: 1434 passed, 1434 total`. Decisions: deleted topics merge into one `Removed topics` row (grey); longer
picker spans become week by week inside the 30 days; records cover the 30 days; `listTopics` gained an
`includeDeleted` option (default unchanged). Nothing committed.

## Phone check (user)
Profile > Insights: the 12 cards with real numbers for the last 30 days, readable at phone width, light and dark looks,
empty cards say "Nothing in these 30 days yet.", nothing judges or suggests.
