# Chunk 16 · Today: one Edit button instead of the "Today is planned" card

## What it is for
Phone check (2026-10-31): "In today's page, we don't need a tab-like structure to say 'Today is planned', See and Edit buttons. That tab is unnecessary and we only need some edit button somewhere in the page."

## Connections
- Contract: `contract.md` section "Chunk 16". ADR-009 (today editable while open). Doc 05 (Today row).
- Data flow: `TodayScreen` (`useDayPlan(todayKey)`, `usePlannableDays`, `useToday().closed`) -> `Header right` -> Button -> `router.push('/plan/[dayKey]')`.

## Files
- Changed: `src/screens/TodayScreen.tsx`, `src/ui/Header.tsx`, `src/screens/__tests__/TodayScreen.test.tsx`, `docs/05-screens-and-navigation.md`, `contract.md`, `README.md` (M8).
- No new files besides this report.

## Build
- Removed the "Today is planned · N tasks" Card and its See / Edit buttons.
- `Header` has an optional `right?: ReactNode`, shown after the note in the right-hand group; other callers are unchanged.
- Today passes a ghost Button "Edit" (testID `today-edit`, accessibilityLabel "Edit today's plan") as `right`, only when today is planned and `canEditToday` (plannable and not closed, the old Edit condition). It pushes `/plan/<todayKey>`.
- Untouched: Plan today, tomorrow card, Plan tomorrow, closed card, Close, folds, Dock, Collection. `/planned/[dayKey]` route kept; Today no longer links to it for today (Morning and Plan confirm still do).

## Tests
- Written first and run against the old code: 3 of 22 in `TodayScreen.test.tsx` failed: new "no card, one Edit beside the title opens the plan", "updates a mounted Today when today gets planned" (now expects `today-edit`), and the closed-day test (now expects no See and no Edit).
- Replaced the old "offers See and Edit" test; added "no Edit when not planned, Plan today still shown". Tomorrow card test unchanged and passing. Maestro flows use neither the old labels nor testIDs, so no change.

## Errors / open
- Not run on a device; the Edit button's fit next to "n of m done" on narrow phones is unchecked.

## Outputs
tsc clean, lint clean, jest 86 suites / 1035 tests pass (was 86 / 1034).

## Check and lead fix
- Checker (Sonnet): PASS, no errors. Nits: header row could overflow at large font scale on a narrow phone; no test for planned-but-not-plannable; LICENSE untracked (kept out of commits).
- Lead fix: Header right-hand group and note shrink (note on one line) so the Edit button stays on screen.
