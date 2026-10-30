# M6 · Chunk 8 · Draft plans: screens + ui

## Build (Sonnet)

### Purpose
Put ADR-010 on screen: plan a day after tomorrow as a draft, see drafts on the Calendar, finalize a drafted tomorrow. A draft is never called "planned".

### Files
- `src/ui/dayCardLine.ts` — optional `drafted`/`draftCount`; later: "Draft: N tasks. Finalize it the evening before."; tomorrow (drafted, not planned): "Draft ready: N tasks. Finalize it tonight."
- `src/ui/MonthGrid.tsx` — `MonthGridCell.drafted?`; small accent-outline dot (`testID="draft-dot"`, hidden from a11y); label adds "draft plan".
- `src/screens/CalendarScreen.tsx` — card button: `canDraft` -> "Plan ahead" / "Edit draft"; tomorrow drafted & unplanned -> "Finalize"; else Plan / Edit. All push `/plan/[dayKey]`.
- `src/ui/PlanFooter.tsx` — `draft` prop: label "Save draft", count line without "planned".
- `src/screens/PlanScreen.tsx` — draft mode: title "Plan ahead", subtitle "Wednesday, 4 November"; Save draft via `useSubmitGuard` -> `saveDraft()` -> `router.back()`; quiet "Discard draft" (only `mode==='draft' && hasDraft`) with `ConfirmBox` -> `discardDraft()` -> back. Plan mode untouched.
- Tests: `ui/__tests__/CalendarUi.test.tsx`, `screens/__tests__/{CalendarScreen,PlanScreen}.test.tsx`, plus one state test in `state/__tests__/drafts.test.ts` (chunk 7 file, test addition only, requested by the lead).

### Connections now
- `useDayCard` {drafted, draftCount, canDraft, canPlan, planned} -> `CalendarScreen` -> `dayCardLine` + button label.
- `useCalendarMonth` cells (`drafted`) -> `MonthGrid` dot + label.
- `usePlanDraft` {mode, hasDraft, saveDraft, discardDraft, canConfirm} -> `PlanScreen` -> `PlanFooter` / `ConfirmBox`.

### Future connections
- Chunk 9+ (if any): reminders for undrafted/unfinalized days could reuse `drafted`.

### Decisions
- "Save draft" is disabled while nothing is ticked (lead's note), with a visible hint "Tick at least one task, or discard the draft."; the ValidationError catch stays as a fallback and shows its message inline.
- Discard flushes pending note edits first (notes belong to the library task).
- `drafted`/`draftCount` on `DayCardLineInput` and `drafted` on `MonthGridCell` are optional so existing callers/tests are unchanged.
- Existing Calendar tests that expected no button on a later day now expect "Plan ahead". No chunk 7 source file was edited.
- Added state test: draft made at today+2, a day later close today moving two checks (one already in the draft): no duplicate, the other forwarded and ticked, confirm keeps all three.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npx jest` (touched files + src/ui): all passed.
- `npm run test:coverage`: 58/58 suites, 628 tests passed; global 98.28% statements. No timeouts this run (CalendarScreen tests untouched except additions; no timeout raised). `coverage/` deleted.
- Note: I briefly ran `git stash`/`git stash pop` once to compare a baseline; it was restored immediately (82 changed paths intact).

### Known limitations + phone checks
- Phone: tap a day 3+ days ahead -> "Plan ahead" -> tick, Save draft -> back on Calendar with an outline dot and "Draft: N tasks" + Edit draft. Reopen, Discard draft -> confirm -> dot gone.
- Phone: draft day becomes tomorrow -> "Draft ready... Finalize" opens the normal Plan screen; confirm drops the planning marble.
- TalkBack/VoiceOver: day cell reads "..., draft plan"; check dot contrast in dark theme.
- Discard draft sits under the primary button inside the footer; check it is not cramped on small phones with the keyboard open.

## Check (Sonnet)

**Verdict: PASS** (no errors). `npm run typecheck` clean, `npm run lint` clean. `npx jest src/screens src/ui src/state/__tests__/drafts.test.ts`: 27 of 28 suites passed on the first run; the only failures were 2 `CalendarScreen` swipe/arrow tests hitting the 5 s timeout under load (the known flake from chunk 7's notes, not a draft-related failure). `npx jest src/screens/__tests__/CalendarScreen` alone: 12/12 passed. No `coverage/` folder.

### ERRORS
None.

### NOTES
1. Card matrix verified in `CalendarScreen.tsx` (action label) and `dayCardLine.ts`: later none -> "Not planned yet." + "Plan ahead"; later draft -> "Draft: N task(s). Finalize it the evening before." + "Edit draft"; tomorrow unfinalized draft -> "Draft ready: N task(s). Finalize it tonight." + "Finalize"; tomorrow confirmed -> "Planned..." + "Edit"; tomorrow none -> "Plan it tonight..." + "Plan"; today -> Plan/Edit (a draft that arrived as today reads `drafted:false`); past -> no button. Singular/plural handled by `tasks()` and tested. No draft line contains "planned".
2. `MonthGrid`: 8 px outline dot in the accent colour, no fill, hidden from a11y; cell label gains ", draft plan". It is visibly distinct from filled marbles. Tested. Dark-theme contrast is still a phone check.
3. `PlanScreen` draft mode: title "Plan ahead" with a locale subtitle (weekday, day, month via `dayNames`); contract wrote "Plan ahead · date" in one title, split here, acceptable. Save draft: `useSubmitGuard`, flushes note edits, `saveDraft()`, one `router.back()`; button disabled when `!canConfirm`, hint "Tick at least one task, or discard the draft."; `ValidationError` fallback shown inline (imported from `@/state/errors`, other errors rethrown). Discard only when `mode==='draft' && hasDraft`, behind `ConfirmBox`, flushes notes, back once. No `/planned` navigation or marble in draft mode. Plan mode path (`confirm` -> `router.replace('/planned/[dayKey]')`) is unchanged.
4. Layering clean: no `src/data` or `getDb` in screens/ui. Navigation: Calendar `router.push` to the plan, draft save/discard `router.back()`, confirm `replace`, consistent with M1-M5.
5. Minor: the "Tick at least one task, or discard the draft." hint also shows on a never-saved empty draft (empty library), where there is no draft to discard. Cosmetic.
6. Minor: test title 'a future month shows "Not planned yet." with no button' (`CalendarScreen.test.tsx:180`) is now misleading, since a later day has "Plan ahead"; it only asserts no Plan/Edit. Rename suggested.
7. Minor: `NOT_PLANNABLE` copy ("today until it closes, or tomorrow") is stale for days beyond the 365-day horizon; the message should mention planning ahead.
8. End-to-end flow (later day -> Plan ahead -> Save draft -> card Draft -> next day Finalize -> prefilled Plan -> confirm -> Planned -> marble) is covered in pieces: Calendar test (draft + tomorrow Finalize), PlanScreen tests, the added `drafts.test.ts` case (confirm keeps draft rows incl. forwarded) and chunk 7 state tests. No single test runs the whole chain through the screens; the phone check remains the real proof.
