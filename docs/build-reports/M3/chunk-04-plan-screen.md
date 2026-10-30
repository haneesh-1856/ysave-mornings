# M3 · Chunk 4 · Plan screen

## Build (Sonnet)

### Purpose
The screen where the user plans a day (tomorrow, or today when it has no plan yet): tick the day's tasks, tune
length/cue/treat/note, add a one-off, then confirm with one tap. This is the "plan tomorrow in under 3 minutes" screen.

### Files
- `mobile/src/app/plan/[dayKey].tsx` — thin re-export of `PlanScreen`.
- `mobile/src/screens/PlanScreen.tsx` — the screen (outer `PlanScreen` validates the param; inner `PlanBody` holds the hooks).
- `mobile/src/screens/__tests__/PlanScreen.test.tsx` — 9 tests.

### Connections now
- Reads `usePlanDraft(dayKey)` (draft, totals, toggle/step/setCue/setTreat/addOneOff, canConfirm, `confirm()`), `usePlannableDays` (todayKey for the "Plan today" title), `useSubmitGuard`.
- Confirm: `guard.run(() => { flush notes; plan.confirm(); router.replace({ pathname: '/planned/[dayKey]', params: { dayKey } }) })`. Only `plan.confirm()` is called, never `confirmDayPlan`. A `ValidationError` shows inline (role alert) above the footer and the guard resets.
- Notes: `setTaskNoteFromPlan(taskId, text)`, debounced 400 ms, flushed on collapse, on switching rows, before confirm and on unmount.
- UI: `PlanRow` (with `dayKey`), `OneOffForm`, `PlanFooter` (inside `Screen`'s `footer`, so it is sticky), `Screen`, `Header`, `Button`.
- `/planned/[dayKey]` is chunk 5's route (parallel build); the typed-route push relies on it existing.

### Future connections
- M5 Close → "Plan tomorrow" will `router.push({ pathname: '/plan/[dayKey]', params: { dayKey: tomorrowKey } })`.
- M6 Calendar: tapping tomorrow opens this screen.
- M8 onboarding → "Plan today" for the first day.
- Chunk 5's Planned screen "Edit" returns here via `/plan/<dayKey>`; the draft is rebuilt from the confirmed plan (rows `saved`).

### Decisions
- Invalid param (`isDayKey`) and not-plannable day share one message view ("You can plan tomorrow, or today if it has no plan yet.") with "‹ Back". The plannable check uses `plan.plannable` (frozen after confirm), not `usePlannableDays().days`, otherwise confirming today would flash the message before `replace`.
- Title: "Plan today" when `dayKey === todayKey`, else "Plan <weekday>".
- Topic group header: a tinted bar in the topic colour (`t.topic(colorKey).fold`) with the topic name, not the animated `Fold` (groups are not collapsible). Topics deleted but still owning forwarded rows get a "Removed topic" group instead of hiding ticked rows.
- Note field: `PlanRow` always renders it. The value is kept in local screen state (seeded from the library task when the row expands); rows with a `taskId` save to the library, one-off rows (no `taskId`) keep it on screen only and it is lost when leaving. Not changed in `src/ui` per the brief.
- OneOffForm cannot take a default topic without editing it, so the user taps a topic (left as is).
- Leaving the screen discards unconfirmed edits with no prompt (draft is in memory).
- Android keyboard spacer copied from `TopicsScreen`.
- Footer error colour: no danger token exists in the theme, so the error is bold text with `accessibilityRole="alert"`.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npm test`: 36 suites, 365 tests; 363 pass. The 2 failures are both in `src/screens/__tests__/PlannedScreen.test.tsx` (chunk 5's in-progress file), not in this chunk. PlanScreen: 9/9 pass.
- `npm run test:coverage`: same 2 failures from PlannedScreen only; All files 98.29% statements / 98.32% branches / 96.59% functions; no threshold error reported.
- `mobile/coverage` deleted.

### Known limitations and phone checks
- One-off task notes are not persisted (see Decisions).
- The note's local state is keyed by row key; it is not re-seeded if the library note changes elsewhere while the screen is open.
- Phone checks (not run here):
  1. Plan tomorrow from a fresh seed in under 3 minutes: open, untick one, add a one-off (name, topic, length), step a length, confirm; count the time.
  2. Keyboard: expand a row, tap Note and the one-off Task name; the field must stay visible above the keyboard on both iOS and Android, and the footer must not float over it awkwardly.
  3. Sticky footer: with many rows, the count/minutes line and "Friday looks like this ✓" stay pinned while scrolling; totals update on each tick and stepper change.
  4. Double-tap "looks like this": lands on Planned once, no flash of the not-plannable message; Back from Planned then Edit shows the saved plan.
  5. Note typed then immediately tapping Back or Confirm is still saved to the library task.
  6. Android back / header "‹ Back" discards edits without a prompt.

## Check (Sonnet)

### Verdict: FAIL (2 real defects: layering, one-off note silent data loss)

### ERRORS
1. `mobile/src/screens/PlanScreen.tsx:5-6,11` (used at :97, :106) imports `@/data/repos/tasks`, `@/data/repos/topics` and `@/state/dbRef` (`getDb`). Expected: screens reach data only through `src/state` (docs/02-architecture.md: "dependencies point downward", data is "the only code that touches SQLite"; contract: no src/data imports in the screen). Actual: the screen reads the DB directly on every render (`listTopics(getDb())`, `getTask(getDb(), ...)`). Only PlannedScreen (chunk 5) does the same; TopicsScreen does not. Fix: add state hooks, e.g. `usePlanTopics()` (live topics, `useDataVersion(['topics'])`, returns `Topic[]` not deleted) and `useTaskNote(taskId)` or have `usePlanDraft` expose `noteOf(taskId)`; delete the three imports from the screen. Errors already come from `@/state/errors` (OK).
2. `mobile/src/screens/PlanScreen.tsx:107-110` (+ `src/ui/PlanRow.tsx:78` always renders the Note field). Expected: no control that silently discards user input. Actual: on a one-off row (no `taskId`) the user can type a note, it is kept only in screen state, and it is lost on confirm/leave with no hint. This is user-visible silent data loss (the builder's limitation 1 is a real defect, not a note). Minimal correct fix (recommended): contract amendment adding optional `noteEditable?: boolean` (default `true`) to `PlanRow`; when `false`, render nothing in place of the Note TextField (hide it; a disabled field would still invite typing/needs copy). Screen passes `noteEditable={row.taskId != null}`. Then drop the local `notes` state fallback for one-offs. Add a PlanRow test (note hidden when false) and a PlanScreen test (expand a one-off row: `queryByLabelText('Note')` is null).

### Non-blocking notes
- Limitation 2 (no default topic in OneOffForm): not a defect. Add stays disabled until a topic chip is tapped; one extra tap, no data loss, within the 3-minute goal. Optional later: preselect the first topic.
- Limitation 3 ("Removed topic" group): correct per doc 04 §11 ("a deleted task in an open plan: its row stays for that day"); the row remains visible and untickable-by-accident. Keep. Untested, add one test if cheap.
- Verified OK: route is a one-line re-export; confirm is `guard.run(() => { flush(); plan.confirm(); router.replace(...) })` with `ValidationError` caught inline (role alert) and rethrow otherwise; only `plan.confirm()` used, never `confirmDayPlan`; double tap test shows one replace and one write, and the frozen draft means no not-plannable flash (asserted); groups in `draft.groups` order with `t.topic(colorKey).fold` headers; `dayKey` passed to PlanRow; single `expanded` key; "Not on <Fridays> · tap to add once"; one-off via OneOffForm -> `plan.addOneOff`; totals in sticky `Screen footer`; "Plan today"/"Plan Friday"; invalid/non-plannable message; notes debounced 400 ms, flushed on toggle (collapse/switch), before confirm and on unmount, only for rows with taskId; no writes before confirm other than notes (leaving discards the in-memory draft); Android keyboard spacer matches M2 pattern; back button has role button, label "Back", 48pt-class Button.
- Test gaps (non-blocking): no test that only one row is expanded at a time, no test of flush-before-confirm / unmount flush, no ValidationError display test (unreachable via UI since the button is disabled when `canConfirm` is false), no Removed-topic test. Existing 9 tests assert real behaviour (DB writes, replace args, footer totals), not just rendering.
- Flash-free confirm relies on `usePlanDraft` freeze (chunk 1); fine.

### Command outputs (mobile/)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest PlanScreen.test.tsx src/state src/ui/__tests__`: 16 suites, 119 tests, all pass.
- `npx expo export --platform android` (scratchpad m3c4-export): success, Hermes bundle 5.3MB; output dir deleted. `mobile/coverage` deleted.

## Fix (Opus)

### Errors fixed
1. Layering: `PlanScreen.tsx` imported `@/data/repos/tasks`, `@/data/repos/topics` and `getDb` from `@/state/dbRef`, reading SQLite on every render.
2. Silent data loss: `PlanRow` always rendered the Note field, so a note typed on a one-off row (no `taskId`) was kept only in screen state and dropped.

### Root cause
1. No state hook existed for "live topics" or "one task's note", so the screen reached past `src/state` to get them.
2. `PlanRow` had no way to say "this row has nowhere to keep a note"; the screen papered over it with a local-only fallback.

### Changes
- New `mobile/src/state/hooks/usePlanTopics.ts`: `usePlanTopics(): Topic[]`, `listTopics(getDb())` filtered to not deleted (sortOrder from the repo), memoised on `useDataVersion(['topics'])`.
- New `mobile/src/state/hooks/useTaskNote.ts`: `useTaskNote(taskId: string | null): string`, `getTask(...)?.note ?? ''` ('' for null/unknown), memoised on `useDataVersion(['tasks'])`.
- `mobile/src/ui/PlanRow.tsx:31-32` new prop `noteEditable?: boolean`; `:55` default `true`; `:80-82` the Note `TextField` renders only when `noteEditable`.
- `mobile/src/screens/PlanScreen.tsx`: removed the `@/data/repos/tasks`, `@/data/repos/topics`, `@/state/dbRef` imports and the now-unused `useDataVersion` import; `:12,:14` import the new hooks; `:68` `findRow(draft, key)` helper; `:79` `const topics = usePlanTopics()`; `:85-86` one unconditional `useTaskNote(expandedTaskId)` call for the single expanded row (taskId of the expanded row, or null); `:111` `noteOf` = local edit ?? library note; `:113` `onNote` ignores rows without a taskId (no local fallback for one-offs any more); `:132-133` passes `note` only for library rows and `noteEditable={row.taskId != null}`.

### Tests
- `mobile/src/state/__tests__/planHooks.test.ts` (new, 3 tests): `usePlanTopics` re-reads after `createTopic` and drops a removed topic; `useTaskNote` is '' for null and unknown ids; re-reads after `setTaskNote`.
- `mobile/src/ui/__tests__/PlanControls.test.tsx:129` PlanRow hides the Note when `noteEditable={false}` (other controls still shown).
- `mobile/src/screens/__tests__/PlanScreen.test.tsx:135` expanding a one-off row: `queryByLabelText('Note')` is null (row confirmed expanded via the "After class" chip); `:147` the library note is shown on expand via `useTaskNote`, and a topic created while the screen is open appears in the one-off form (live `usePlanTopics`). Existing "saves a note to the library task after the debounce" and "flushes a pending note when the row collapses" still pass.

### Command outputs (mobile/)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest src/screens/__tests__/PlanScreen.test.tsx src/ui/__tests__ src/state`: 17 suites, 125 tests, all pass.
- `npm test`: 37 suites, 372 tests, all pass (chunk 5 files included; no failures).
- `grep -nE "@/data|getDb|dbRef" src/screens/PlanScreen.tsx`: no matches.
- `mobile/coverage` deleted (was not present).

### Downstream effect
- Chunk 5 `PlannedScreen` must also read through state hooks only (no `@/data` or `getDb` in `src/screens`). `usePlanTopics()` is available for topic names and colours; `useTaskNote(taskId)` for a library note.
- Any other caller of `PlanRow` gets the old behaviour (Note shown) unless it passes `noteEditable={false}`; pass it for rows without a `taskId`.

## Re-check (Sonnet)

### Verdict
PASS. Both fixes verified, no regressions found. No remaining errors in chunk 4.

### Verified
1. `PlanScreen.tsx`: no `@/data`, `getDb` or `dbRef` imports (grep empty). `usePlanTopics` (useDataVersion(['topics'])) and `useTaskNote` (useDataVersion(['tasks'])) follow the pattern, memo keyed on version; both are called before the `!plan.plannable` early return, so unconditionally.
2. Row A -> row B switch: scratch test (created and deleted, not left in repo) typed a note on Read, pressed Edit on Notes; Read's library note was `for-read` and B's Note field was empty. `pending` stores `{taskId,text}` per row key, so flush writes to A's task regardless of `useTaskNote`'s changed id.
3. One-off rows: `noteEditable={row.taskId != null}`, Note field absent (test at PlanScreen.test.tsx:135); library rows still save (existing debounce and collapse-flush tests pass).
4. `PlanRow` `noteEditable = true` default (PlanRow.tsx:55); only caller passing it is PlanScreen.

### Commands (mobile/)
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npx jest src/screens src/ui/__tests__ src/state`: 18 suites pass, 1 fails: `PlannedScreen.test.tsx` "shows live topic names ... Removed topic" (2 tests failed). This is chunk 5 (being edited in parallel), not chunk 4; PlanScreen tests pass.
- `npm test` (run a moment later): 37 suites, 373 tests, all pass, so the PlannedScreen failure was transient/in-progress chunk 5 work.
- `mobile/coverage`: not present (deleted).
