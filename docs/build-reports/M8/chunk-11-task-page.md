# Chunk 11 · Task page

## What it is for
Phone check (2026-10-31): a task on Today could not be opened to read the notes added earlier (checklist rows only ticked; the Run screen was timed-only and its note wrote to the library task, against ADR-011). Now every Today row opens a task page showing the cumulative notes (library note read-only, this day's note editable) and the action: Start / Pause / Resume / Stop for a timed task, Mark done / Mark not done for a checklist task. Also on Today the checklist tick box is gone; a checklist row reads like a timed row, with "checklist" after the name.

## Connections
- Contract: `contract.md` section "Chunk 11". ADR-011, doc 04 section 2 (Notes) and section 5, doc 05 (Today, task page).
- Data flow: `useToday` row -> `useRunTask(dayTaskId)` (row, library note via `useTaskNote`, day) -> `RunScreen`. Day note: `DayTask.note` / `setDayTaskNote(dayTaskId, text)` (chunk 10). Checklist action: `toggleCheckTask`.
- Route unchanged: `/run/[dayTaskId]` (`src/app/run/[dayTaskId].tsx` re-exports `RunRoute`).

## Files
- UI: `src/ui/CheckRow.tsx` (no Checkbox; Pressable row: dot, name, check mark + "done" / "checklist"; `onPress` replaces `onToggle`/`disabled`), `src/screens/RunScreen.tsx` (task page, both kinds, read-only when closed), `src/screens/TodayScreen.tsx` (toggle/haptic code, `noop` and `locked` removed; all rows call `openRun`).
- State: `src/state/actions/plan.ts` (`setTaskNoteFromPlan` removed). `useRunTask` unchanged (it already returned row, library note and day).
- Tests: new `src/screens/__tests__/taskPage.test.tsx`; changed `RunScreen.test.tsx`, `TodayScreen.test.tsx`, `movedOneOff.test.tsx`, `ui/__tests__/RunUi.test.tsx`, `state/__tests__/plan.test.ts`, `state/__tests__/run.test.ts`.
- Docs: `05-screens-and-navigation.md`, `04-domain-rules.md` (section 5), `contract.md`, `README.md`.
- `Checkbox` stays (still used by `PlanRow`). `.maestro/golden-path.yaml` needed no change (it taps `task-row` and `run-start`, both still exist).

## Build
- Task page: back button "‹ Today" (`run-back`, `dismissTo` today, flushes the note), state label, name, topic dot, cue, treat, "from <weekday>" for a moved-in row, "Library note" card (only when non-empty), "Note for <weekday>" card ("Tap to add a note" when empty). The editor keeps the raw typed text and the action/repo turns blank into null, so a leading space is not swallowed. Debounce 600 ms, flush on leave and unmount.
- Timed: clock, Start/Pause/Resume/Stop, keep-awake, celebration, gold as before. Checklist: no clock; footer "Mark done" (`task-mark-done`) or ghost "Mark not done"; done shows the celebration and collection, and the marble drops only for a completion seen on the page.
- Closed day: line "Today is closed. It is read-only now.", notes shown without editing (day note card hidden when empty), footer "Back to Today", no action.
- Not on today's list: "This task isn't on today's list" + Back.
- Today: `CheckRow` label "<name>, checklist, open" / "<name>, done"; closed-day rows are no longer disabled.

## Tests
- Written first in `taskPage.test.tsx` (7); all 7 failed before the implementation (no checklist row button, no `task-mark-done`, no "Library note", no "Note for Friday", checkbox still present, old not-found text). Path: plan Friday on Thursday (library note "general", day note "do chapter 3", one-off checklist with a note), advance the clock, then (a) checklist row -> page with its note and Mark done -> done -> back -> row "Sums, done"; Mark not done undoes it; (b) timed page shows both notes, Start then Pause; (c) editing the day note stores `day_tasks.note` (raw leading space kept), `tasks.note` unchanged; (d) closed day: rows open, pages read-only; (e) no checkbox, "checklist" shown; not-found message.
- Changed existing tests: `TodayScreen.test.tsx` (checkbox toggle test -> checklist row opens the page and does not tick; closed-day tests now expect enabled rows that open the page), `movedOneOff.test.tsx` (checkbox -> "A, checklist, open"), `RunUi.test.tsx` (CheckRow), `RunScreen.test.tsx` (note test now day note; one-off has a day note; checklist task opens a page instead of "not running"), `plan.test.ts` (`setTaskNoteFromPlan` test removed), `run.test.ts` (library `setTaskNote` used to seed the note).

## Errors
- First `Mark not done` test pressed inside the 500 ms button cooldown (same guard as Start/Pause); the test now waits. No product errors.

## Outputs
- `npx tsc --noEmit` clean; `npm run lint` clean; full `npx jest --silent`: 81 suites, 984 tests pass (was 80 / 978).
- Not run on a device.

## Check and lead fix
- Checker (Sonnet): PASS, no errors. Warnings: no note flush when the app backgrounds; a flush that fails after the day closes is silent. Nits: "Done for today" wording on one checklist task, not-found title wording, cooldown timer reassignment.
- Lead fix: `useNoteEditor` now flushes on `AppState` change to background/inactive (RunScreen.tsx). The silent-failure case stays as is (the day is closed, so the edit is refused by design).
- After the fix: tsc clean, lint clean, 81 suites / 984 tests pass.
