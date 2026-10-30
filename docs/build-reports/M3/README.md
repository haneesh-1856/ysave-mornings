# M3 build run — Planning

Started 2026-10-29. Done when (roadmap): you can plan tomorrow and today in under 3 minutes.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors (then a Sonnet re-check).
Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Plan state (hooks + confirm action) | M1, M2 | [chunk-01](chunk-01-state.md) | PASS after 1 Opus fix (draft frozen after confirm) |
| 2 | Plan controls | M2 ui | [chunk-02](chunk-02-controls.md) | PASS after 2 Opus fixes (day names from one helper + one locale) |
| 3 | Glass jar renderer | M0 theme | [chunk-03](chunk-03-jar.md) | PASS (no fix needed) |
| 4 | Plan screen | 1, 2 | [chunk-04](chunk-04-plan-screen.md) | PASS after 2 Opus fixes (screen via state hooks only; no lost one-off notes) |
| 5 | Planned screen + entry points | 1, 3 | [chunk-05](chunk-05-planned.md) | PASS after 2 Opus fixes (state hooks only; back-stack duplicates) |

## Requirements carried in
- buildPlan input includes deleted tasks that the day's rows reference (M1).
- Forms use a submit guard (M2), now a `useSubmitGuard` hook; screens import errors from `@/state/errors`.

## Requirements carried forward
- Jar: possible one-frame flash of the new marble at rest before it drops (shared value starts at 0). Watch for it
  in the M3 phone check; fix = start at -distance or useLayoutEffect. With 41+ items the newest marble is hidden
  (keep newest instead of oldest if that ever matters). (Chunk 3 check notes 1–2.)
- usePlanDraft: an edit and confirm() in the SAME React batch would confirm the pre-edit draft (refs sync in an
  effect). Unreachable from real taps; fix if a future flow calls both together (mirror edits into a ref
  synchronously). (Chunk 1 re-check.)
- Navigation: return to Today with `router.dismissTo('/(tabs)/today')`, never `replace` to a tabs route; hand off
  between Plan and Planned with `replace`. (Chunk 5 fix.)

## Result (2026-10-29)
All 5 chunks PASS; 7 errors found by checkers across chunks 1, 2, 4 and 5 (one promoted by the lead), all fixed by Opus and re-checked.
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 37 suites, 373 tests, 98.3 % lines, domain gate holds.
No screen, route or ui file imports `src/data` or `getDb`. **Phone check pending.**

## Phone check (2026-10-29): passed
All 10 checks OK in Expo Go: plan today, re-plan today after confirming (ADR-009), plan tomorrow with a per-day
minutes change and a one-off, first-marble drop, Topics unchanged by per-day edits, no duplicate screens,
Done → Today, Android back exits, plans survive a restart. **Planning tomorrow took about 1.5 minutes**
(goal: under 3). The check also found a gap (today's plan not shown on Today), fixed in chunk 5.
ADR-009 re-check passed (382 tests). **M3 is done.**
