# M6 build run — Calendar + Profile

Started 2026-10-30. Done when (roadmap): the calendar reflects your real week.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors → Sonnet re-check.
Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Day-start change (today resolved from each day's own hour; setting applies from tomorrow) | M1–M5 | [chunk-01](chunk-01-daystart.md) | PASS after 1 Opus fix (a skipped yesterday could move today) |
| 2 | Calendar + Profile state (month grid, day card, stats) | 1 | [chunk-02](chunk-02-state.md) | PASS (no fix needed) |
| 3 | UI (MonthGrid, DayCard, StatTiles, SettingRow, HourPicker) | M2–M5 ui | [chunk-03](chunk-03-ui.md) | PASS (no fix needed) |
| 4 | Calendar screen | 2, 3 | [chunk-04](chunk-04-calendar.md) | PASS after 1 Opus fix (broken "·" byte) + lead change (selection follows month) |
| 5 | Profile + Day start screen | 1, 2, 3 | [chunk-05](chunk-05-profile.md) | PASS (no fix needed) |
| 6 | Phone-check changes: free month browsing + Today chip; confirm button for day start | 4, 5 | [chunk-06](chunk-06-phonecheck.md) | PASS (no fix needed) |
| 7 | Draft plans: data + domain + state (ADR-010) | 1–6 | [chunk-07](chunk-07-drafts-state.md) | PASS (no fix needed) |
| 8 | Draft plans: Calendar + Plan screen draft mode | 7 | [chunk-08](chunk-08-drafts-ui.md) | PASS (no fix needed) |

## Requirements carried in
- From M5: TaskRow/Checkbox real `disabled` prop; TopicsScreen debounce tests on fake timers; Jar `useLid` sync when
  `animateLid` is off (cosmetic pivot noted). Taken into chunk 3 (UI) where they touch the same files.
- M5 phone check 2 (Close: Move / Let go choices) is still open with the user.

## Run-level decision
- Day-start semantics made exact (contract chunk 1): a day ends at its own snapshotted hour; a change never moves
  today and applies from tomorrow's row on.

## Requirements carried forward
- `setDayStart`: reuse one `at` across `reconcile()` and the write (sub-millisecond boundary gap; chunk 1 re-check note).
- Day card: a test that planning tomorrow while Calendar is open flips "Plan" to "Edit" live; Profile tests for non-zero
  stats, "Custom" look, the "Today still ends…" line hiding on set-back. `router.back()` fallback on Day start when
  there is no history. Calendar cells < 44 pt wide below ~340 dp (phone check).

## Result (2026-10-30)
All 8 chunks PASS (6–8 from the user's phone check: free browsing, confirm day start, ADR-010 drafts); 2 errors found by checkers (chunk 1 skipped-yesterday rule, chunk 4 broken "·" byte), fixed by Opus
and re-checked; 1 lead change (calendar selection follows the month).
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 58 suites, 628 tests (after chunk 8), 98.4 % lines, domain 100 % lines.
No screen, route or ui file imports `src/data` or `getDb`. **Phone check: 15/16 passed, see below.**
- CalendarScreen tests can hit the 5 s timeout under full parallel load (pass alone); make them leaner or give the
  suite a modest timeout. Copy: NOT_PLANNABLE message should mention planning ahead; empty-draft hint on a never-saved
  draft; stale test title at CalendarScreen.test.tsx:180. No single end-to-end draft→finalize test (phone check / M8 E2E).

## Phone check
- **Checks 1–15 passed 2026-10-30** (after the Profile fix below).
- **Bug found (2026-10-30), lead fix:** Profile said "3 days you showed up" on day 2. `useProfileStats` read every days
  row, so tomorrow's confirmed plan (its planning marble) counted as a day and a marble before it arrived. Now it reads
  rows up to today only; test added. Re-ran: typecheck ✓, lint ✓, 58 suites / 629 tests ✓, domain 100 % lines.
- **Check 16 deferred to 2026-10-31** (needs a real evening-before): draft the day after tomorrow; the evening before,
  its card reads "Draft ready… Finalize it tonight."; Finalize opens the plan prefilled; confirming drops the marble.
