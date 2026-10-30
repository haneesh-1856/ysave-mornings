# M2 · Chunk 2 · UI primitives

## Build (Sonnet)

> **Note (lead):** parts of this section were superseded by the Fix below: the gesture root now lives once in `src/app/_layout.tsx` (not in TimeSlider), the "flaky" note was a real bug (fixed), and final counts are 21 new / 237 total tests. See Fix and Re-check.

### Purpose
The reusable, themed, accessible controls the Topics screen (chunk 3) and Topic form (chunk 4) are built from. All are presentational: props in, callbacks out. No imports from `src/state` or `src/data`. Every color comes from the theme (`t.c.*`, `t.topic(k)`), except the existing danger red (`#d4574e`, reused from `Button`) for the TextField error.

### Files
New in `mobile/src/ui/`:
- `Fold.tsx`, `WeekRing.tsx`, `TimeSlider.tsx`, `Switch.tsx`, `Segmented.tsx`, `ChipSet.tsx`, `ConfirmBox.tsx`, `ColorSwatches.tsx`, `TextField.tsx`, `presets.ts` (CUES, TREATS) — the contract set.
- `useMotion.ts` — small helper (not in the contract): `{ reduce, animate(to) }` using `t.motion` and reanimated's `useReducedMotion`; under Reduce Motion `animate` returns the target (instant). Used by Fold and Switch.
- `testing.tsx` — `renderThemed` (RNTL render with `ThemeProvider` as a `wrapper`, so `rerender` keeps the theme).
- `__tests__/`: `WeekRing`, `TimeSlider`, `Controls` (Switch, Segmented, ChipSet, ConfirmBox, ColorSwatches), `TextField`, `Fold` tests (19 tests).

Changed in `mobile/`:
- `package.json` jest config: `setupFiles: ['react-native-gesture-handler/jestSetup', '<rootDir>/jest.setup.js']` and `resolver: 'react-native-reanimated/jest/resolver'`.
- New `jest.setup.js`: mocks gesture-handler's `installUIRuntimeBindings` (lib/module path).

### Connections now
- Only to the theme (`useTheme`, `buildTheme` `TOPIC_COLOR_KEYS`, `colorMix.luminance`), `T`, `Button`, and the `ColorKey` type from `@/domain/types`. Nothing consumes the new components yet (chunks 3 and 4 do).

### Future connections
- Chunk 3: `TaskCard` back face uses TextField (name, note), WeekRing, Segmented (Timed/Checklist), TimeSlider, Switch (default), ChipSet x2 (`CUES`, `TREATS`), ConfirmBox (delete). `Fold` is the topic row; `right` takes dots + the "⋯" button. WeekRing `readOnly` can render the front-row repeat summary if wanted.
- Chunk 4: TopicForm uses TextField (max 24, `error`), ColorSwatches, a preview Fold (`open={false}`), ConfirmBox for "Remove topic".
- M3 Plan editor: reuses ChipSet and Switch; may need a stepper/number control (not built here). M6 day-start hour could use Segmented or ChipSet.

### Decisions
- **WeekRing touch targets.** At the default 96 pt a slice is about 40 pt wide, under the 44 pt rule. So slices (SVG `Path onPress`) are a visual/direct-tap convenience, hidden from the accessibility tree, and the real targets are a row of seven 44x44 day-letter buttons under the ring (wraps on very narrow widths). Labels: "Monday, repeats" / "Monday, off", role `checkbox` with `checked`. `readOnly` omits the row; the ring then carries one label ("Repeats Monday, Wednesday" / "No repeat days").
- **TimeSlider** uses gesture-handler 3.x `usePanGesture({ runOnJS: true, activeOffsetX: [-6, 6], failOffsetY: [-14, 14] })` inside `GestureDetector`, so vertical page scrolling is not hijacked. Tap-to-position is a `Pressable` over the track (`locationX`). Value mapping is the exported pure `valueFromX` (snap to step from min, clamp). The control is `accessibilityRole="adjustable"` with `increment`/`decrement` actions and `accessibilityValue {min,max,now,text}`. It wraps itself in `GestureHandlerRootView` because the app's root layout has none and gesture-handler 3 throws in dev without one.
- **Fold**: height animates as `natural * progress` (content measured in an absolutely-positioned inner view), so content growth (card flips) follows instantly while open/close is animated with `t.motion`. Closed body is hidden from accessibility (`accessibilityElementsHidden`, `no-hide-descendants`) and ignores touches. The right slot is a sibling of the header Pressable (no nested pressables). Header label: "Title, subtitle", `accessibilityState.expanded`.
- **Segmented / ChipSet / ColorSwatches** use `radiogroup` + `radio` roles with `selected`/`checked`; selection is never color only (ChipSet adds a check mark, ColorSwatches a ring + check, Segmented is filled + state). ColorSwatches labels are "Color 1..6" because hue names differ per palette. ChipSet selected chip hints "Double tap to clear".
- **TextField**: counter `n/max` appears when `length >= max - 5`; `maxLength` set on the input and `onChangeText` also truncates (paste safety); `error` text shown below with a thicker border.
- **ConfirmBox** reuses `Button` (confirm = primary or danger, plus a ghost "Cancel").
- **Jest**: reanimated/worklets resolve to JS-only builds via reanimated's jest resolver (the `mock` export still loads the native worklets module and fails). RNTL 14 is async: `render`, `fireEvent`, `rerender` are awaited.

### Command outputs
Run from `mobile/`:
- `npm run typecheck`: clean.
- `npm run lint`: exit 0, no findings.
- `npm test`: 24 suites, 235 tests passed (19 of them new, in `src/ui/__tests__`). One earlier full run showed 2 failures in `src/data/__tests__/sessions.test.ts` (UNIQUE constraint expectation); it passed in isolation and on two re-runs, so it looks flaky under load (not touched by this chunk).
- `npm run test:coverage`: all passed; domain gate 100% (thresholds hold); overall 98.1% lines for the collected set (ui is not in `collectCoverageFrom`). `mobile/coverage` deleted.
- No errors from the parallel builder's `src/state` files appeared in typecheck or lint at the time of the run.

### Known limitations (need a real phone)
- Gesture feel of the TimeSlider drag (activation offsets, thumb tracking, tap vs scroll inside the Topics ScrollView), and that nesting its `GestureHandlerRootView` inside a screen ScrollView behaves on both platforms.
- The pan gesture and slice taps on the SVG ring are not exercised by jest (only the accessibility actions, `valueFromX`, and the day-letter row are).
- Fold open/close animation, Switch knob motion, and Reduce Motion behavior are only checked structurally in jest (the reanimated JS build runs them); verify the real animation and the Reduce Motion OS toggle.
- Glass surface look (blur is in `Card`, not these controls; Fold/ConfirmBox use flat tinted/`t.c` fills, so check them on the glass look) and contrast of `t.c.on` / ink check marks on every palette.
- Font scale 1.3: no fixed heights (only `minHeight`), but check WeekRing row wrapping, Segmented labels, ChipSet wrapping and the TimeSlider header at 1.3 on a small phone.

## Check (Sonnet)

### Verdict: FAIL (2 errors; both small fixes)

### ERRORS
1. **Test flake root cause: `mobile/src/data/errors.ts:31-39` (`sqliteMessage`), shown by `src/data/__tests__/sessions.test.ts:60,66`.**
   Expected: `startSession` maps a UNIQUE violation to `ConflictError` on every run. Actual: with `npx jest --runInBand` it fails in about 2 of 3 full runs with `DrizzleQueryError` (reproduced 3 times; it passes alone and in parallel mode, 3/3).
   Cause: `sqliteMessage` walks the cause chain with `cur instanceof Error`. better-sqlite3 is a native addon cached across test files in the same process, so its `SqliteError` extends the `Error` of whichever jest vm realm loaded it first. In any later test file `e.cause instanceof Error` is false. Probe (temporary test, deleted): `PROBE instanceof=true` in one run, `instanceof=false` in two others. The loop then stops at the Drizzle wrapper, whose message has no "UNIQUE constraint failed", so `ConflictError` is never thrown. Which file loads the addon first depends on scheduling, hence "flaky under load". It is not caused by the new `jest.setup.js` or by createTestDb cleanup. It is older than chunk 2 (src/data), and production (expo-sqlite, single realm) is unaffected.
   Fix: make the walk realm-independent. Replace `cur instanceof Error` with `typeof cur === 'object' && cur !== null && typeof (cur as {message?: unknown}).message === 'string'`, and keep reading `.cause`. Re-run `npx jest --runInBand` 3 times.
2. **`mobile/src/ui/TimeSlider.tsx:51,83` (GestureHandlerRootView nested inside the component) — defect; belongs once at the app root in `mobile/src/app/_layout.tsx`.**
   Expected (gesture-handler 3 install docs / source): one `GestureHandlerRootView` wrapping the app. Actual: each slider creates its own native root (a Topics list can have many cards). Its default style is `flex: 1` (`GestureHandlerRootView.tsx:28`), which can collapse or stretch the track in auto-height parents. On Android a separate root view per slider also gets its own gesture orchestrator, so it does not coordinate with the ScrollView or other detectors. Builder's reason (no root in layout, dev throws in `useEnsureGestureHandlerRootView.ts`) is real but the fix is not nesting.
   Fix: (a) in `_layout.tsx` wrap the `ThemeProvider` subtree (and the migration-error branch) in `<GestureHandlerRootView style={{ flex: 1 }}>`; (b) remove the wrapper and import from `TimeSlider.tsx`, leaving `<GestureDetector>` directly; (c) because jest runs with `__DEV__` and `Platform.OS=ios`, the detector then throws in tests, so make `renderThemed` in `src/ui/testing.tsx` wrap in `GestureHandlerRootView` (wrapper becomes `({children}) => <GestureHandlerRootView><ThemeProvider>{children}</ThemeProvider></GestureHandlerRootView>`). Update the builder notes (known limitation about nesting) accordingly.

### Non-blocking notes
- Props: all match the contract. `readonly string[]` for `ChipSet.options` is fine (needed for `as const` CUES). `TimeSlider` fixed "Minutes"/"Time" labels are fine (not in contract props, matches usage). `TextField` extra `error` prop is a reasonable, documented addition. `useMotion.ts` is an acceptable helper.
- Presentational only: no `src/state` or `src/data` imports. Hex literals: only `DANGER` in TextField (allowed by the contract). Note `#d4574e` on `t.c.surface` is about 3.9:1 for small error text, under 4.5:1; the text (not color) carries the error, so non-blocking, but consider a darker/lighter danger token later.
- WeekRing: hidden slices plus a 44x44 letter row is acceptable and a correct a11y approach. Bit 0 = Monday is correct in the ring (slice 0 at 12 o'clock), the row (`DAY_NAMES[i]`, `mask ^ (1 << i)`) and the readOnly summary ("Repeats Monday, Wednesday, Friday" for 0b10101; "No repeat days" for 0). Hiding the ring while editable keeps SR users on the row. The tests prove the row, not the SVG slices.
- TimeSlider: `emit` only calls `onChange` when the snapped value differs from the `value` prop, so frames inside the same step do not fire it. With a slow parent update (props lag a frame) the same new value can fire twice; harmless for idempotent save. Pan `onUpdate` uses `e.x` relative to the detector view, same box as the Pressable `locationX`; consistent. Increment/decrement are clamped. Gesture (pan/tap) itself is untested in jest (declared limitation).
- Reduce Motion: `useMotion` returns the target instantly when `useReducedMotion()`; Fold and Switch both use it. No jest test covers the reduce path.
- Fold: height = measured natural height x progress, so content growth and font scale 1.3 do not clip; no fixed heights. Title uses `numberOfLines={1}`, so long names truncate at large font scale (acceptable, subtitle still shown). `pointerEvents`/hidden-from-a11y when closed is correct.
- Jest config: `setupFiles` (gesture-handler jestSetup + `jest.setup.js` mock of `installUIRuntimeBindings`) and the reanimated resolver are minimal and necessary; no other suite is affected.
- testing.tsx: nothing under `src/` (outside `__tests__`) imports it (grep). `expo export` for android succeeded; no new UI is imported by app code yet, so nothing from it is bundled.
- Tests assert real behaviour (state, labels, callbacks, clamping, truncation); weakest spots are Fold animation, Reduce Motion, and gestures.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npx jest` x3 (parallel): 24 suites, 235 tests passed each time. `npx jest --runInBand`: sessions.test.ts failed 2 tests (3 of 4 in-band runs failed, 1 passed).
- `npm test`: 24 suites, 235 passed. `npm run test:coverage`: passed, All files 98.11% lines; domain thresholds hold. `mobile/coverage` deleted.
- `npx expo export --platform android`: succeeded; export dir deleted. Scratch tests removed.

## Fix (Opus)

### Error 1: flaky `ConflictError` mapping under `--runInBand`
- **Root cause:** `sqliteMessage` walked `.cause` only while `cur instanceof Error`. better-sqlite3's `SqliteError` is created by a native addon cached across jest test files, so it extends the `Error` of whichever vm realm loaded it first; in later files `instanceof Error` is false, the walk stopped at the Drizzle wrapper, the "UNIQUE constraint failed" text was never seen, and `DrizzleQueryError` escaped instead of `ConflictError`. Production (expo-sqlite, one realm) was not affected, but the check was fragile there too.
- **Change:** `mobile/src/data/errors.ts:30-45`: new private type guard `hasMessage(v): v is { message: string; cause?: unknown }` (non-null object with a string `message`); `sqliteMessage` uses it in place of `instanceof Error`, still follows `.cause`, and keeps the 4-level depth limit. No `any`, no casts in the loop.
- **Tests added:** `mobile/src/data/__tests__/sessions.test.ts:85-104` `describe('sqliteMessage')`: (1) a plain-object chain (`wrapper.cause = { message: 'UNIQUE constraint failed: ...' }`, asserted `instanceof Error === false`) yields the UNIQUE message, also when wrapped in a real `Error` with `cause`; (2) non-object input returns `''`, a non-object `cause` stops the walk, and a 5-deep chain is cut at 4.
- The M1 chunk 7 intent ("any error whose chain contains 'UNIQUE constraint failed' becomes `ConflictError`") now holds whatever realm the driver error came from.

### Error 2: `GestureHandlerRootView` nested inside `TimeSlider`
- **Root cause:** gesture-handler 3.3.0 `GestureDetector` calls `useEnsureGestureHandlerRootView` (`node_modules/react-native-gesture-handler/src/v3/detectors/useEnsureGestureHandlerRootView.ts`), which throws in `__DEV__` on non-web platforms when no `GestureHandlerRootViewContext` is present. The app root had none, so the builder wrapped each slider in its own root view (default style `flex: 1`, `components/GestureHandlerRootView.tsx`), giving one native root and gesture orchestrator per slider. The package's `jestSetup.js` only mocks `HostGestureDetector`, so the root check still runs in jest (iOS, `__DEV__`).
- **Change:**
  - `mobile/src/app/_layout.tsx:7` imports `GestureHandlerRootView`; `:62-69` wrap the whole rendered tree (`ThemeProvider` with both the `MigrationError` branch and `RootStack`) in `<GestureHandlerRootView style={{ flex: 1 }}>`. The `setDb` line, `useFonts`/`useMigrations`, splash hide effect and `if (!ready) return null` are unchanged.
  - `mobile/src/ui/TimeSlider.tsx:3` import is now `{ GestureDetector, usePanGesture }`; `:25` doc comment says the root comes from the app layout; `:51-81` `GestureDetector` is now a direct child of the outer `View` (wrapper removed, block de-indented; no style or prop changes).
  - `mobile/src/ui/testing.tsx:1-17`: `renderThemed` uses a `Providers` wrapper = `GestureHandlerRootView style={{ flex: 1 }}` > `ThemeProvider`, still passed as RNTL `wrapper` so `rerender` keeps it.
- **Tests:** no new tests. The existing 5 `TimeSlider` tests pass through the new `renderThemed` (they would throw without a root, since the slider no longer brings its own). All other ui suites use the same wrapper and pass.
- Build notes above (line 29 "wraps itself in `GestureHandlerRootView`" and the line 45 manual-check item about nested roots) are out of date: the slider has no root of its own now. The manual check becomes "TimeSlider drag vs vertical scroll inside the Topics ScrollView under the single app root, on both platforms."

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npm test`: 24 suites, 237 tests passed (235 before + 2 new).
- `npx jest --runInBand` x3: 24 suites / 237 passed each time (before the fix, 3 of 4 in-band runs failed in sessions.test.ts).
- `npm run test:coverage`: passed; All files 98.12% stmts / 98.29% lines; `errors.ts` 100%. Thresholds hold. `mobile/coverage` deleted.
- `npx expo export --platform android` (scratchpad output dir): succeeded (android hbc bundle 4.8 MB); export dir deleted.

### Downstream effects
- Chunks 3-4 screens (Topics, settings, etc.) get gestures from the single root in `_layout.tsx`; they must not add their own `GestureHandlerRootView`. Any `GestureDetector` (TimeSlider in Topics cards, future swipe rows) works under it and coordinates with ScrollViews through one orchestrator.
- M4 Run screen gestures (timer controls, any pan/swipe) also rely on this root; nothing extra is needed per screen.
- Modal/portal content rendered outside the root tree (e.g. a native `Modal`) would need its own root if it uses gestures; none exists yet.
- UI tests that render gesture components must use `renderThemed` (or wrap in `GestureHandlerRootView` themselves).
- `sqliteMessage` now accepts any `{ message }` object; callers (`startSession`) are unchanged.

## Re-check (Sonnet)

### Verdict: PASS (both fixes verified; no regressions attributable to chunk 2)

### Remaining errors
None in the fixed files. Failures seen come only from the parallel builders' in-progress files (ignored as instructed): `src/ui/__tests__/TopicForm.test.tsx` (5 tests failed in run 3 of 3), lint errors in `src/ui/TaskCard.tsx:73` (react-hooks/set-state-in-effect) and `src/screens/TopicsScreen.tsx`.

### Verification
1. `src/data/errors.ts`: `hasMessage` guard (non-null object with string `message`), no `instanceof`, no `any`; the only cast is inside the guard itself, typed `{message?: unknown}`. `sqliteMessage` loop is depth-limited (`i < 4`). New tests in `sessions.test.ts:85-104` are meaningful: they use plain-object chains asserted `instanceof Error === false`, check the exact joined string, the non-object and non-object-cause stops, and the 4-level cut.
2. `GestureHandlerRootView`: grep of `src/` finds it only in `src/app/_layout.tsx` (import, lines 64-68) and `src/ui/testing.tsx`; `TimeSlider.tsx` only mentions it in a comment. `_layout.tsx` wraps both the `MigrationError` branch and `RootStack` (inside `ThemeProvider`); `setDb`, `useFonts`/`useMigrations`, the splash-hide effect and `if (!ready) return null` are intact.
3. Commands (from `mobile/`):
   - `npx jest --runInBand src/data src/state src/domain src/ui/__tests__` x3: run 1 and 2: 23 suites, 226 tests passed. Run 3: 24 suites after a builder added TopicForm.test.tsx; 5 failures, all in TopicForm.test.tsx (parallel builder). All other suites, including sessions.test.ts, passed every time.
   - `npm run typecheck`: clean.
   - `npm run lint`: 2 errors, both in the builders' files (TaskCard.tsx, TopicsScreen.tsx); none in chunk-2 files.

### Stale Build-section lines (not edited)
- Line 29 (TimeSlider decision): "It wraps itself in `GestureHandlerRootView` because the app's root layout has none..." is stale. The root is now in `_layout.tsx` only.
- Line 45 (Known limitations): the "nesting its `GestureHandlerRootView` inside a screen ScrollView" item is stale. It should read "TimeSlider drag vs vertical scroll inside the Topics ScrollView under the single app root".
- Line 40 (flaky sessions.test.ts note, "looks flaky under load") is stale: the root cause was the cross-realm `instanceof Error` check, now fixed.
- Lines 13 and 40-41 ("19 new tests", "24 suites, 235 tests") are stale: 237 tests after the fix (2 new sqliteMessage tests).
- Line 14-ish `testing.tsx` description ("RNTL render with ThemeProvider as a wrapper") is incomplete: the wrapper now also includes `GestureHandlerRootView`.
