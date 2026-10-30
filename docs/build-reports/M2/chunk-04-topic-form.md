# M2 · Chunk 4 · Topic new / edit

## Build (Sonnet)

### Purpose
Let the user add a topic and edit or remove one, from the Topics screen's "New topic" / Edit row. Two thin routes on the root stack share one presentational form.

### Files
- `mobile/src/ui/TopicForm.tsx` (new): name `TextField` (max 24; blank shows "A topic needs a name" and disables Save), `ColorSwatches`, live preview `Fold` (name or "New topic", chosen color, non-interactive), Save, and when `onRemove` is passed a "Remove topic" button that turns into the danger `ConfirmBox` ("Remove <name>? Removes its tasks from your library. Past days keep their marbles."). Takes `error` to show a save problem under the name. No state or data imports.
- `mobile/src/ui/TopicScreen.tsx` (new): pushed-screen frame (`Screen`, "‹ Topics" ghost button with a11y label "Back to Topics", `Header`) plus `MissingTopic` ("This topic no longer exists" + back button).
- `mobile/src/app/topic/new.tsx` (new): default color = first of the six not used by an existing topic, else `study`; `createTopic` then `router.back()`.
- `mobile/src/app/topic/[id].tsx` (new): `useLocalSearchParams`, `useTopic`; save calls `updateTopic` then back; remove calls `removeTopic` then back; unknown or removed id shows `MissingTopic`.
- Tests: `mobile/src/ui/__tests__/TopicForm.test.tsx` (5), `mobile/src/__tests__/topicRoutes.test.tsx` (9; kept outside `src/app` so they are not routes).
- Chunk 2 files and `_layout.tsx`: not modified.

### Connections now
- Uses `createTopic`/`updateTopic`/`removeTopic` (`state/actions/library.ts`), `useTopic`/`useTopicsLibrary` hooks, UI kit (`TextField`, `ColorSwatches`, `Fold`, `ConfirmBox`, `Button`, `Screen`, `Header`, `T`).
- `_layout.tsx` root `Stack` auto-registers file routes `topic/new` and `topic/[id]` with the look's transition, `headerShown:false`, and no tab bar. No `Stack.Screen` registration needed, no edits. Chunk 3's Topics screen should push `/topic/new` and `/topic/<id>`.
- `removeTopic` bumps `topics` and `tasks`, so Topics refreshes by itself. A topic removed while its edit screen is open flips to the "no longer exists" view.

### Future connections
- M8 onboarding's first-topic step reuses `TopicForm` (give it its own onSave; no router inside the form).
- M7 palettes change the swatch colors (swatches/preview read the theme, labels are "Color 1..6" so nothing breaks).

### Decisions
- Back is a ghost `Button` rather than a native header (headers are hidden app-wide); Android hardware back works through the stack.
- ValidationError is caught in the routes and passed to the form as `error`; other errors rethrow (tested).
- The blank-name message and the action error share the name field's error slot (blank wins).
- Remove confirm uses the saved name, not the in-progress edit.
- Form keeps its own `TOPIC_NAME_MAX = 24` constant to stay free of data-layer imports (repo enforces the same limit).
- Preview Fold wrapped in `pointerEvents="none"` so it is not a dead button; its a11y label reads "<name>, Preview".
- Tests: RNTL here is async (await render/fireEvent/act); routes tests mock `expo-router` and `react-native-safe-area-context` (`Screen` needs insets).

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean.
- `npm run lint`: clean at my last run (an earlier run showed one `react-hooks/set-state-in-effect` error in chunk 3's in-progress `TaskCard.tsx:74`, not mine).
- `npm test`: 27 suites, 256 tests passed (14 new: 5 TopicForm, 9 routes).
- `npm run test:coverage`: passed, 27 suites / 256 tests; `mobile/coverage` deleted.

### Known limitations + manual phone checks
- Not covered by jest: real stack transition, Android hardware back, keyboard behavior, and the swatch/preview visuals.
- On the phone: (1) Topics > New topic: ring on first unused color, Save disabled until you type, preview updates with name and color; Save returns to Topics with the topic added. (2) Press Android back and the "‹ Topics" button: both return without saving. (3) Edit a topic: change name and color, Save, Topics reflects it. (4) Remove topic > Cancel keeps the screen; Remove returns to Topics, topic and its tasks gone, past days still show their marbles. (5) Type 24 chars: counter shows, no more accepted. (6) Largest font scale and each look: transition matches the look, no tab bar, nothing clipped. (7) Screen reader: swatches announce "Color N" selected; "A topic needs a name" is announced.

## Check (Sonnet)

**Verdict: FAIL** (2 real defects; everything else verified)

### ERRORS
1. `mobile/src/app/topic/new.tsx:4` and `mobile/src/app/topic/[id].tsx:4` - `import { ValidationError } from '@/data/errors'`. Contract layering (contract.md:14) says routes "Never import src/data directly". Proof: grep shows these are the only route imports of src/data besides the pre-existing `_layout.tsx` db bootstrap. Fix: re-export `ValidationError` from a state module (e.g. `export { ValidationError } from '../data/errors'` in `src/state/actions/library.ts`) and import it from `@/state/actions/library` in both routes.
2. `new.tsx:19-22`, `[id].tsx:27-33` and `onRemove` (`[id].tsx:34-37`) - no double-tap guard. Save/Remove stay enabled while the screen animates out after `router.back()`. A second press on new.tsx runs `createTopic` again (duplicate topic, since names aren't unique) and calls `back()` twice; on edit, a double Save/Remove calls `back()` twice, popping past Topics (can exit the app on the root stack). Proof: by code inspection, nothing sets a "done" flag; tests press once only. Fix: add `const done = useRef(false)` in each route (or in TopicForm: `submitted` state that disables Save/Remove); in each handler `if (done.current) return; done.current = true;` before the action, reset it to false in the ValidationError catch branch. Add a test pressing Save twice (new: expect exactly 1 topic and `mockBack` called once).

### Non-blocking notes
- Rethrowing non-Validation errors happens inside an event handler, not render, so there is no error boundary/red-screen-in-render; in release it goes to the global JS handler (fatal crash). Acceptable for unexpected DB failures in M2; consider a generic inline "Couldn't save" later.
- Inline `error` from a failed save is never cleared when the user edits the name (it only clears on next successful press); minor.
- Keyboard: `Screen` uses `automaticallyAdjustKeyboardInsets` (iOS only) inside a ScrollView with `keyboardShouldPersistTaps="handled"`. On Android relies on the window resize mode; with SDK 58 edge-to-edge this may not resize. Verify on a device; Save sits below Color/Preview so it is likely scrollable anyway.
- Hard-coded `#d4574e` is only the allowed danger red (TextField/Button); TopicForm/TopicScreen have none.
- Tests are good: cover blank/disabled, live preview, color pick, remove confirm/cancel, default colour and fallback, ValidationError inline, rethrow, soft-delete of tasks, unknown id, removed-while-open. They lack the double-tap case.

### Verified OK
- Layering for TopicForm/TopicScreen (no state/data imports); routes otherwise use `@/state` hooks/actions + `@/ui`.
- Name: TextField maxLength 24 + slice, repo `validName` trims and enforces 1-24; Save disabled when blank (accessibilityState disabled asserted); preview Fold reflects trimmed name + colour; default colour first unused else `study`.
- create/edit/remove call actions then `router.back()`; `softDeleteTopic` cascades to tasks; `useTopic` returns null for deleted -> MissingTopic.
- Routing: `topic/*` auto-registered under the root `Stack` (no tab bar), headerShown false with custom back; `useLocalSearchParams<{id: string}>`; Router context scans only `EXPO_ROUTER_APP_ROOT` (src/app), so `src/__tests__` is not a route. Stack animation comes from `look.trans`; Android hardware back is the Stack default. Back button: role button, label "Back to Topics", minHeight 48.
- A11y: roles/labels present, swatches 48x48, Text uses themed `T` (font scaling).

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean (no output).
- `npx jest TopicForm topicRoutes src/state src/data`: 13 suites, 74 tests passed.
- `npx expo export --platform android`: succeeded (android bundle 5.2MB); export dir and `mobile/coverage` deleted.

## Fix (Opus)

### Errors
1. **Layering break.** `src/app/topic/new.tsx:4` and `src/app/topic/[id].tsx:4` imported `ValidationError` from `@/data/errors`. The contract says routes never import `src/data`.
2. **No double-submit guard.** Save (New and Edit) and the Remove confirm stayed live after the first press. A second tap while the screen animated out called `createTopic` again (a duplicate topic) and/or `router.back()` twice, which can pop past Topics.

### Root cause
1. Routes need to catch repo errors by class, and the state layer offered nothing to import them from, so the route reached into `src/data`.
2. The route ran the action and then `router.back()`, but nothing marked the form as "already submitting". Navigation is async, so the screen stays mounted and pressable for the length of the transition. A state flag alone is not enough: two presses can land before React re-renders, so a synchronous ref is needed as well.

### Changes
- `src/state/errors.ts` (new, 2 lines): `export { ValidationError } from '@/data/errors';`, with a comment saying it exists so routes can catch repo errors without importing `src/data`.
- `src/app/topic/new.tsx:6`: imports from `@/state/errors`. `:17-18` adds `submitting` ref + `busy` state. `:28-30` returns early if already submitting, then sets both before `createTopic`. `:35-38` the ValidationError branch resets both, then shows the message. Non-validation errors still rethrow.
- `src/app/topic/[id].tsx:5`: imports from `@/state/errors`. `:15-23` adds ref + state and a `start()` helper shared by Save and Remove. `:34` guards Save. `:39-42` resets on ValidationError. `:46` guards Remove.
- `src/ui/TopicForm.tsx:24,30`: new optional `busy` prop (default false). `:56` Save is `disabled={blank || busy}`. `:63` passes `disabled={busy}` to the Remove confirm. `:68` "Remove topic" is disabled while busy.
- `src/ui/ConfirmBox.tsx:10,14,20`: new optional `disabled` prop on the confirm button. It is additive, so existing callers are unchanged.

### Tests
- `src/ui/__tests__/TopicForm.test.tsx:56`: busy disables Save and the Remove confirm, and pressing them does nothing. `:69`: busy disables "Remove topic".
- `src/__tests__/topicRoutes.test.tsx:86`: New, two presses inside one `act` (before any re-render) plus a press after the re-render give exactly 1 topic and 1 `back()`, and Save is left disabled. `:102`: after a ValidationError, Save is re-enabled and a retry creates the topic and goes back once. `:145`: Edit, double Save gives 1 `updateTopic` and 1 `back()`. `:160`: double Remove confirm gives 1 `softDeleteTopic` and 1 `back()`. The existing edit ValidationError test now also asserts that Save is re-enabled.
- Mutation check: with the ref guard deleted from `new.tsx`, test `:86` fails with 2 topics created. The guard was restored afterwards.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest src/ui/__tests__/TopicForm.test.tsx src/__tests__/topicRoutes.test.tsx src/state src/data`: 13 suites, 80 tests passed.
- `npm test`: 29 suites, 278 tests passed (no chunk-3 failures at the time of the run). `mobile/coverage` deleted.

### Downstream effects
- Future screens import error classes from `@/state/errors`, never `@/data/errors`. Add `ConflictError` and `NotFoundError` there only when a route actually needs them.
- Other form screens in M3 and M8 (task form, settings, and so on) should reuse this submit-guard pattern: a ref for synchronous protection, plus state passed down as `busy`/`disabled`. Set both before the action, and reset them only on the recoverable (ValidationError) branch. If it repeats, consider pulling it into a `useSubmitGuard` hook in `src/state/hooks`.
- `ConfirmBox` now takes `disabled`. Other destructive confirms should pass it while their action is in flight.

## Re-check (Sonnet)

**Verdict: PASS** (no remaining errors)

- Layering: no `@/data` imports in src/app except pre-existing `_layout.tsx` db bootstrap; src/screens only in a test file (TopicsScreen.test). `src/state/errors.ts` is a 2-line re-export.
- Guard: ref set synchronously before the action in new.tsx and [id].tsx (shared `start()`); busy disables Save, Remove, and the confirm button; reset only on ValidationError. Non-validation error is rethrown with busy=true (screen stuck non-retryable) - judged acceptable: it is an unexpected DB failure that already crashes via the global handler, so a retry is moot. Note for later.
- ConfirmBox `disabled` is optional and passes through Button's `disabled` (Pressable sets a11y disabled); other callers (TaskCard, Controls test) unaffected.
- Mutation: removing the ref guard in new.tsx makes topicRoutes fail (1 failed, 13 passed); restored exactly.
- Commands: typecheck clean; lint clean; npm test 29 suites, 278 tests passed. mobile/coverage deleted.
