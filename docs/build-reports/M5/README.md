# M5 build run — Close + rollover

Started 2026-10-29. Done when (roadmap): leave the app overnight; the morning shows a fresh page and yesterday is closed correctly.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors → Sonnet re-check.
Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Close + morning state (close action, summary, chain, morning, day boundary) | M1–M4 | [chunk-01](chunk-01-state.md) | PASS after 2 Opus fixes (Morning when open overnight; closed days final) |
| 2 | Close + morning UI (lid animation, outcome picker, summary, sunrise card) | M3–M4 ui | [chunk-02](chunk-02-ui.md) | PASS (no fix needed) |
| 3 | Close screen + Today chain and Close button | 1, 2 | [chunk-03](chunk-03-close.md) | PASS (no fix needed) |
| 4 | Morning screen + launch redirect | 1, 2 | [chunk-04](chunk-04-morning.md) | PASS (no fix needed) |

## Requirements carried in
- Day-boundary timer while the app stays open (M4 check). Closed-day rows announce as disabled (M4 check).
- Close → Plan tomorrow hands off with `replace`; return to Today with `dismissTo` (M3).
- Fake-timer tests crossing a completion use `doNotFake: ['queueMicrotask']` (M4).
- ADR-009: closing ends editing for today.

## Run-level decision
- The Maestro end-to-end path moves to M8 (needs Maestro + an emulator/device).

## Requirements carried forward
- TopicsScreen debounce tests (lines ~81, ~110) rely on real 400 ms timers and can flake under load; switch them to
  fake timers (test-only). Jar `useLid`: sync `p.value` when `animateLid` is off so toggling the prop later can't
  show an open lid on a closed jar. Open-pose pivot is ~3 units off mid-swing (cosmetic). (Chunk 2 check notes.)
- Give TaskRow and Checkbox a real `disabled` prop (closed-day rows are no-ops already, but inner controls
  don't announce disabled); add a test that presses a closed row. (Chunk 3 check notes.)

## Result (2026-10-29)
All 4 chunks PASS; 2 errors found by checkers (chunk 1), fixed by Opus and re-checked.
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 49 suites, 493 tests, 98.3 % lines, domain gate holds.
No screen, route or ui file imports `src/data` or `getDb`.

## Phone check (2026-10-30)
8 of 9 passed (overnight close → Morning → Today, shown once per day). **Check 2 not yet done:** on Close, each
unticked checklist task offers "Move to <tomorrow>" / "Let it go" with neither preselected. To check this evening.
