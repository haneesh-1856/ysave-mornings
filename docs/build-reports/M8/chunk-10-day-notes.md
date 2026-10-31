# Chunk 10 · Day notes

## What it is for
Phone check (2026-10-31): the Plan screen's Note field and the Run screen's note both wrote to the LIBRARY task note, and one-off rows had no note at all. The user wants a note addable anywhere, always reflected in Today: the library note is the task's general note, a note in tomorrow's plan says what to do tomorrow, a note in today's edit is an action for that task, and none of the last two may land in the library. Now every day row (library task or one-off) has its own `note`; Plan edits that, shows the library note read-only above it, and the day note travels when a task is moved to the next day.

## Connections
- Contract: `contract.md` section "Chunk 10". ADR-011 (docs/10-decisions.md), doc 04 section 2 (Notes), doc 03 (`day_tasks.note`).
- Data: `day_tasks.note` -> `DayTask.note` -> `PlanRow.note` (buildPlan) -> `confirmPlan` insert/update -> repo `applyPlanResult`. `closeByHand` -> `Ops.forwardDayTasks[].note` / `insertDayTasks[].note` -> `applyOps`.
- Future (chunk 11, the task page on Today): read `DayTask.note` from the day bundle, show `tasks.note` (via `useTaskNote(taskId)`) read-only, edit with `setDayTaskNote(dayTaskId, note)` from `@/state/actions/plan`. RunScreen still uses `setTaskNoteFromPlan` (library write); chunk 11 should switch it to `setDayTaskNote` and then delete `setTaskNoteFromPlan` and its tests (`state/__tests__/plan.test.ts`, `run.test.ts`).

## Files
- Data: `src/data/schema.ts` (`day_tasks.note text NULL`), `src/data/migrations/20261031202001_naive_rocket_raccoon/` (`ALTER TABLE day_tasks ADD note text;` + snapshot, from `npx drizzle-kit generate`), `migrations.js` (m0004), `repos/mappers.ts`, `repos/days.ts` (`validDayNote`, note on insert/update, new `getDayTask`, `setDayTaskNote`), `repos/ops.ts` (forward writes `note` when present).
- Domain: `types.ts` (`DayTask.note`), `plan.ts` (`PlanRow.note`, `setNote`, buildPlan, confirmPlan, addOneOff), `rollover.ts` (`forwardDayTasks[].note?`, inserted next-day rows carry `note`).
- State: `state/hooks/usePlanDraft.ts` (`setNote(key, text)`), `state/actions/plan.ts` (`setDayTaskNote(dayTaskId, note)`; `setTaskNoteFromPlan` kept for RunScreen).
- UI: `ui/PlanRow.tsx` (field "Note for <weekday>", `libraryNote` prop, `noteEditable` removed), `screens/PlanScreen.tsx` (debounce and library writes removed).
- Docs: `03-data-model.md`, `04-domain-rules.md` (section 2), `10-decisions.md` (ADR-011), `contract.md`, `README.md`.

## Build
- Length limit 1000 (`NOTE_MAX` from the tasks repo); blank or whitespace-only stores as null. `domain.setNote` also turns blank into null, so the screen never holds a whitespace note; the repo validates length (ValidationError) on confirm/draft inserts and updates and on `setDayTaskNote`.
- The library note is never copied into a day note: new library rows start `note: null`; rows built from an existing day row take that row's note.
- Forwarding: a moved task inserted as a new next-day row carries `note`. If the next day already has a row for the task (bug-01 path): when that row has no note it receives the moved note (`forwardDayTasks[].note`, field present only then); when it has its own note it is kept. One-offs (null taskId) travel with their note.
- `setDayTaskNote` works on any stored row whose day is open (today or a planned tomorrow); refuses with ValidationError for an unknown row, a closed day, or a note over 1000 characters. Bumps `days`.
- Plan screen: Note field always shown (one-offs included), label "Note for Saturday" (`weekdayName(dayKey)`), saved with Confirm / Save draft; "Library note: <text>" (variant sub) above it when the expanded row's library task has a non-empty note.

## Tests
- Written first against the rule; the existing note tests were changed to the new behaviour and then run together.
- Domain `plan.test.ts` (new describe "day notes"): default null, setNote blank -> null and immutability, confirm writes note on insert (library row + one-off), update keeps/edits/clears, prefilled attach. `rollover.test.ts` (new describe): note on new row, fills an empty next-day note, keeps an existing one.
- State new `src/state/__tests__/dayNotes.test.ts` (9): the user's path (note on library row and one-off, confirm tomorrow, `day_tasks.note` set, `tasks.note` unchanged), library note not copied, editing today's plan keeps/edits/clears the same row's note, a later-day draft saves it, forwarding (new row / empty existing / own note kept), `setDayTaskNote` (edit, blank clears, refuses closed day / unknown row / over-long).
- Screen `PlanScreen.test.tsx`: the three old library-write tests replaced by four (Confirm stores the day note and the library note is untouched, with the read-only "Library note" line; one-off has the field; reopen shows the stored note and an edit replaces it; library note shown read-only).
- Existing tests that asserted the old behaviour and were changed: `PlanScreen.test.tsx` ("saves a note to the library task after the debounce", "a one-off row has no Note field", "shows the library note when a row expands" which read the library note into the field, "flushes a pending note when the row collapses"); `ui/__tests__/PlanControls.test.tsx` (label "Note" -> "Note for Friday"; the `noteEditable={false}` test replaced by one-off and library-note tests). `state/__tests__/plan.test.ts` `setTaskNoteFromPlan` test is unchanged (the action stays for RunScreen).
- Fixtures: `note: null` added to DayTask and PlanRow literals in 14 existing test files; `schema.test.ts` column list; `migrations.test.ts` (fresh db has `day_tasks.note`; new upgrade test: an old day row keeps its data and reads `note` NULL).

## Errors
- Heredoc/CRLF slips while editing (mixed line endings; fixed). One stray stale helper script in the temp dir appended a duplicate to `ui/collection/__tests__/renderers.test.tsx`; removed immediately, file identical to HEAD. No product errors.

## Outputs
- `npx tsc --noEmit` clean; `npm run lint` clean; full `npx jest --silent`: 80 suites, 978 tests pass (was 79 / 959).
- Not run on a device.
