# Bug 02: a moved one-off did not show for tomorrow

## Bug
Phone check, done after the bug-01 fix: a one-off checklist task "A" was added to TODAY's plan with the add-one-off form. Tomorrow was planned and confirmed. Today was closed with "Move to Saturday" for A. Afterwards the user looked for tomorrow's plan on the **Today tab**, which is read-only after a close, and A was not there.

## Reproduction
Screen-level test `src/screens/__tests__/movedOneOff.test.tsx` goes through the real screens. PlanScreen(today): "+ Add a one-off task", name A, topic Study, length Checklist, Add, confirm. PlanScreen(tomorrow): confirm. CloseScreen: "A: Move to Saturday", then close the jar. After that the test checks each place that shows tomorrow:
- stored `day_tasks` for tomorrow: one A row, `taskId null`, `forwardedFromDayKey = Friday`. **Passed before the fix.** closeByHand inserts a one-off because its taskId is null.
- PlanScreen(tomorrow), the route that Close's "Plan tomorrow" opens: "Include A" is ticked and the row says "from Friday". **Passed before.**
- PlannedScreen(tomorrow): "A", "Study · from Friday". **Passed before.**
- Calendar card (useDayCard + dayCardLine): "Planned: 2 tasks". **Passed before.**
- TodayScreen after the close: `getByLabelText('Tomorrow: A, from Friday')` **FAILED before**: "Unable to find an element with accessibility label: Tomorrow: A, from Friday". The Today tab showed only "Tomorrow is planned · 2 tasks" (See / Edit). The list under it was TODAY's closed rows, and there A was an ordinary unticked row with no sign that it had been moved.

## Root cause
No data was lost. Every layer stores and builds A correctly. The loss is in what the Today tab shows. In `src/screens/TodayScreen.tsx` (the tomorrow card, about line 207 before the fix), a closed day showed tomorrow only as a count. The only task list on the screen is `useToday()`, which is today's closed day. So the screen where the user looks for tomorrow after a close never showed tomorrow's tasks. The A row in today's list had `closeOutcome = 'moved'`, but `CheckTaskRow` did not show that, so the list read as though nothing had moved.

## Fix
- `TodayScreen`: when today is closed and tomorrow is planned, the "Tomorrow is planned" card lists tomorrow's stored rows (`useDayPlan(tomorrow)`). Each row has a topic dot, the name, and the topic plus "from <weekday>" for a moved task. The accessible label is "Tomorrow: <name>[, from <weekday>]". The list is not shown while today is open, so the screen does not change then.
- `CheckRow` takes a new optional prop, `movedTo`. Today's closed rows with `closeOutcome 'moved'` now show "moved to <next weekday>".
- `docs/05-screens-and-navigation.md` Today row updated to match.
- Domain, data and close logic are unchanged. Bug-01 behaviour is unchanged.

## Files
- src/screens/TodayScreen.tsx, src/ui/CheckRow.tsx, docs/05-screens-and-navigation.md
- tests: src/screens/__tests__/movedOneOff.test.tsx (new, 7 tests: storage, Plan, Planned, Calendar card, Today after close, Today before close shows no list, Today once Saturday starts shows A "from Friday")

## Outputs
- `npx tsc --noEmit`: clean. `npm run lint`: clean.
- `npx jest --silent` (with domain coverage): 77 suites, 924 tests, all pass, no failures. Domain line coverage is 100% in every file (dayKey.ts has one branch at line 89 that is not covered, which was already the case before this fix).

## Check
