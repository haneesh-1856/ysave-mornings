# Chunk 17 · Today: one tomorrow control

## What it is for
Phone check (2026-10-31): "Once some tasks are already planned for tomorrow, we don't need that Plan tomorrow button again. It's only needed when nothing is yet selected for tomorrow; if yes, then only that 'Tomorrow is planned' tab-like structure is needed. So at a time only one is required."

## Connections
- Contract: `contract.md` section "Chunk 17". Doc 05 (Today row).
- Data flow: `TodayScreen` (`useDayPlan(tomorrow).day.planConfirmedAt`) -> card (See / Edit) or `today-plan-tomorrow` button -> `router.push`.

## Files
- Changed: `src/screens/TodayScreen.tsx`, `src/screens/__tests__/TodayScreen.test.tsx`, `docs/05-screens-and-navigation.md`, `contract.md`, `README.md` (M8).
- No new files besides this report.

## Build
- Tomorrow confirmed: the "Tomorrow is planned · N tasks" card only (See, Edit, and the closed-day task list). Otherwise (nothing confirmed, a draft alone included): the primary "Plan tomorrow" button only. It is now a ternary, so the two can never show together; the ghost variant is gone.
- Untouched: Edit by the title, Plan today, closed card, Close, folds, Dock, Collection, Close screen's own "Plan tomorrow".
- Dependents checked: `CloseScreen` tests and `movedOneOff.test.tsx` use Close's button or the card, not Today's button. Maestro `golden-path.yaml` uses `close-plan-tomorrow` only (never `today-plan-tomorrow`). Onboarding text is copy only. Morning does not reference it. No change needed.

## Tests
- Written first, run against the old code: 3 of the new/changed tests failed (tomorrow confirmed -> no button; confirming while mounted swaps button for card; closed day with tomorrow confirmed -> no button). The "not planned" and "draft only" tests passed already (they guard the unchanged side).
- Updated: "shows the tomorrow card with See and Edit, and a ghost Plan tomorrow" -> now asserts no Plan tomorrow. Added: not planned -> button and no card; draft only (drafted two days ahead, then the day rolls over) -> button; swap while mounted; closed day with tomorrow confirmed.

## Errors / open
- A draft for tomorrow can only exist after a roll-over (drafts are for day-after-tomorrow and later), so the draft test advances the clock.
- Not run on a device.

## Outputs
tsc clean, lint clean, jest 86 suites / 1039 tests pass (was 86 / 1035).

## Check
- Checker (Sonnet): PASS, no errors. Nits: a zero-task confirmed tomorrow cannot be produced from the UI (canConfirm needs a ticked row); the draft-only test relies on the fixed date constants. No fix needed.
