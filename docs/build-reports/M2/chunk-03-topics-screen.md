# M2 · Chunk 3 · Topics screen + flip card

## Build (Sonnet)

### Purpose
The Topics tab: topics as folds, tasks as rows that flip (rotateX) into an editor, all saved on change through the chunk 1 actions. This is where you build your real library.

### Files
New:
- `mobile/src/ui/TaskCard.tsx` — presentational. Front: name, `repeatText`, "45 min" / "checklist", "· default", flip glyph. Back: name TextField ("A task needs a name" once the user has touched it and it is blank), WeekRing, Timed/Checklist Segmented, TimeSlider (timed only), default Switch, cue and treat ChipSets, note TextField (multiline), "Delete task" -> ConfirmBox ("Delete <name>? Past days keep their marbles."), "Done". Exports `TaskCardValue`, `TaskCardPatch`.
- `mobile/src/ui/repeatText.ts`, `mobile/src/ui/formatMinutes.ts` (+ `ui/__tests__/formatText.test.ts`).
- `mobile/src/screens/TopicsScreen.tsx` — the screen (hooks, folds, dots, draft state, flipped-card state, keyboard room).
- `mobile/src/screens/TaskEditor.tsx` — glue between one `TaskCard` and the actions: debounce, flush, draft-to-real-task.
- Tests: `ui/__tests__/TaskCard.test.tsx` (8), `ui/__tests__/formatText.test.ts` (4), `screens/__tests__/TopicsScreen.test.tsx` (8).

Changed:
- `mobile/src/app/(tabs)/topics.tsx` — now one line: `export { TopicsScreen as default } from '@/screens/TopicsScreen'` (route stays thin; `src/app` may only hold routes).
- `mobile/src/ui/Screen.tsx` (M1 file, small): the ScrollView gets `keyboardShouldPersistTaps="handled"` and `automaticallyAdjustKeyboardInsets` (iOS lifts the focused field above the keyboard). Needed so taps on chips/buttons work while a field is focused and so the back side is not hidden by the keyboard. No chunk 2 file was modified.

### Connections now
- `TopicsScreen` -> `useTopicsLibrary` (read), `updateTopic` (fold open state), `router.push('/topic/new')` and `router.push({ pathname: '/topic/[id]', params: { id } })` (the object form is the typed-routes equivalent of `/topic/${id}`).
- `TaskEditor` -> `createTask`, `updateTask`, `setTaskNote`, `removeTask` (src/state/actions/library) and `DEFAULT_TASK`.
- `TaskCard` -> only `src/ui` primitives, `useTheme`, `useMotion`-style theme motion, domain `TaskKind` type. No state or data imports.
- Uses the single root `GestureHandlerRootView` from `_layout.tsx` (none added here).

### Future connections
- M3 Plan editor: shares note editing (`setTaskNote`, the same Notes TextField pattern) and can reuse `TaskCard`'s `Back` pieces / `TaskEditor`'s debounce-and-flush approach.
- M4 Today: reuses `repeatText` and `formatMinutes` (e.g. Today rows, topic totals).
- M7 looks: restyle `Fold` and `TaskCard` through theme tokens only (all colors, radii, fonts, motion come from `useTheme`); flip duration/easing follow `t.motion`.

### Decisions
- **Draft lifecycle.** "+ Add task" sets screen state `draft = { topicId, createdId }` and flips key `'draft'`. One `TaskEditor` (key `draft`, `task = null`) holds the draft fields from `DEFAULT_TASK` locally. The first non-blank name (after the 400 ms debounce, or at once on any other change/Done/unmount) calls `createTask` with the draft fields (and sets the note if one was typed); `onCreated(id)` records `createdId`, and from then on the same editor instance is fed the real task (the saved list skips `createdId`, so there is no remount and the typed text and focus survive). Done, flipping to another card, or closing the fold clears the draft state; a never-named draft therefore writes nothing.
- **Text saving.** TaskCard keeps its own text state and reports every keystroke; `TaskEditor` debounces ~400 ms and flushes on Done, when `flipped` turns false, and on unmount. Renaming to blank is never saved (the field shows the error, the db keeps the last name). Non-text controls save immediately (`flush()` first, so a named-but-unsaved draft becomes real before it is patched).
- **Flip.** Two faces, one at a time. On a `flipped` change: rotateX 0 -> 90 over half of `t.motion.duration`, swap faces, -90 -> 0 over the other half (perspective 900). Under Reduce Motion the face follows the prop immediately and nothing animates. Chosen over a two-sided backface trick because the faces have very different heights and the Fold measures content height.
- **One flipped at a time** = screen state `flipped` (task id or `'draft'`); closing a fold also un-flips.
- **Dots**: up to 6 `weekDots` as 8 pt circles in the topic color, one accessible group labeled "n marbles this week". "⋯" is a 44x44 button labeled "Edit <topic>".
- **Subtitle** "3 tasks · 4h 30m / week" via `formatMinutes` ("0m", "45m", "1h", "4h 30m"; exact hours drop "0m").
- **Keyboard.** iOS: `automaticallyAdjustKeyboardInsets` on Screen's ScrollView. Android: the screen listens to `keyboardDidShow/Hide` and adds a spacer of keyboard height at the end of the content (Android already scrolls a focused field into view natively). All inside the Screen's ScrollView, so the back side scrolls with the page.
- **Tests mock** `expo-router` (`router.push`), `@/state/ids` (expo-crypto returns null in jest), `react-native-safe-area-context` (insets) and `useMotion` (Reduce Motion true, so flips are instant; TaskCard also has one test with motion on that waits for the half-way swap).
- Pressable-not-nested rule kept: Fold's right slot hosts dots and "⋯".

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean. `npm run lint`: clean (no chunk 4 errors showed up at run time).
- `npm test`: 29 suites, 272 tests passed (20 new: 8 TaskCard, 4 text helpers, 8 TopicsScreen).
- `npm run test:coverage`: passed; All files 98.29% lines / 98.05% branches; domain gate holds. `mobile/coverage` deleted.

### Known limitations
- Not exercised in jest: the real flip animation (only the half-way face swap), TimeSlider pan inside the ScrollView, keyboard behavior, Android keyboard spacer, WeekRing slice taps (the day-letter row is tested).
- If Reduce Motion is toggled while a card stays mounted, the animated path's `shown` face can lag by one flip; a re-mount (leave and return) fixes it. Minor.
- A draft's name error shows only after the user types and blanks it (an untouched new draft is not shown as an error).
- The TopicsScreen holds the whole library via `useTopicsLibrary`; an edit re-renders the topic list (rows are cheap; the memo keeps the 7-day bundle load off non-data renders). No list virtualization (a handful of topics is expected).
- Deleting while a draft's debounce is pending drops the pending text (intended).
- The Android spacer stays until `keyboardDidHide`; if hardware keyboards report no event, no spacer is added.

### Manual phone checks (exact)
1. **Flip**: open Topics, tap a task row; it should turn over (rotateX) to the editor and tap Done to turn back. Then turn on OS "Reduce motion/animations": the same taps swap instantly. Only one card open at a time.
2. **Slider drag inside the scroll**: with a card flipped on a timed task, drag the minutes slider sideways: the value follows the finger in steps of 5 and the page does not scroll. Then drag vertically starting on the slider: the page scrolls. Tap on the track jumps to that value. Switch to Checklist: the slider disappears; switch back: the same minutes are there.
3. **Keyboard**: tap the Notes field at the bottom of an open card: the field and the text you type stay visible above the keyboard (iOS and Android); scroll works with the keyboard up; tapping a chip or the Done button with the keyboard open works on the first tap.
4. **Restart persistence**: add a topic, a task (type a name, set days, minutes, default, cue, treat, note), close one fold, force-quit and reopen. Fold open/closed state, the task fields and the note are all back. Also: "+ Add task", leave the name blank, tap Done: no empty task is left; blank out an existing name: the error shows and the old name returns after reopening.
5. Font scale 1.3 and a long task name: the front row truncates to one line, the back is still reachable by scrolling.

## Check (Sonnet)

**Verdict: PASS** (no blocking defects).

ERRORS: none.

Non-blocking notes
1. Layering: `ui/TaskCard` imports only ui, theme and `domain/types` (type) - no state/data. `screens/*` import state (actions, hook) and domain types, never `src/data`. `src/screens` is acceptable as a "route implementation" layer sitting above ui and state, below app (route files only re-export). Recommend amending the contract: add `src/screens/` (may import ui, state, domain types; not data; only `app/` imports it).
2. Unnamed-task rules verified with a scratch fake-timer probe (deleted): "a","ab" before debounce -> 0 rows at 300 ms, exactly 1 row ("ab") at 500 ms; further typing updates the same row (no second create); the TextInput instance and its value survive every save (no remount/focus loss; Back keeps its own text state, TaskEditor key is stable, the draft slot hands over to the real task without remount); blank draft discarded on Done/flip-away; blank rename shows "A task needs a name", never saved, last name kept; switching card and unmount both flush pending text; timers cleared, `onCreated` guarded by `mounted`.
3. Front row a11y label is "<name>, <repeat · length · default>" with hint "Flips the card to edit it" rather than "Edit <task>"; richer and has role/hint, acceptable.
4. Flip: reanimated rotateX, instant under Reduce Motion, one face rendered at a time (Back lives in Screen's ScrollView so it scrolls). Known minor: toggling Reduce Motion mid-card can lag one flip (builder noted). Not exercised: real animation, device keyboard.
5. Screen.tsx: `automaticallyAdjustKeyboardInsets` is iOS-only (ignored on Android); `keyboardShouldPersistTaps="handled"` is harmless on other screens. Android spacer: app.json sets no softwareKeyboardLayoutMode, so with the default resize mode and edge-to-edge the window may also shrink; the spacer then only adds extra scroll room at the end (cosmetic extra blank space possible). Verify on device (manual check 3).
6. Performance: each save bumps the version, `useTopicsLibrary` recomputes and all folds re-render; no lost focus (probe above). Acceptable at M2 scale; no virtualization needed for a handful of topics (add FlatList-style virtualization if >30 tasks per topic becomes real).
7. Empty-state hint line "Tap a task to flip it..." only shows when topics exist; fine.
8. repeatText/formatMinutes correct (Every day, Weekdays, Weekends, Mon..Sun order, 0 -> "No repeat days"; 0m, 45m, 4h, 4h 30m). Delete copy "Past days keep their marbles." present; dots capped at 6 in topic colour; "⋯" push to /topic/[id] with label "Edit <topic>"; "+ New topic" pushes /topic/new; fold isOpen persisted.

Command outputs
- typecheck: clean. lint: clean.
- npm test: 29 suites, 278 tests passed.
- test:coverage: passed, All files 98.29% lines / 98.05% branches. mobile/coverage deleted.
- expo export --platform android: succeeded (android bundle 5.2MB); output deleted.
