# Chunk 20 · Close: the moments player

## What it is for
After a close by hand, `closeToday` returns the moments due (chunk 19). This chunk plays them as a full-screen overlay in the "Through the sun" look the user approved (`drafts/celebrations/close-moments-v1.html`). Two moments are drawn in full (Longest task, Day complete); the other four show a plain card until chunk 21.

## Connections
- Contract: `contract.md` section "Chunk 20". Docs: 04 (section 12), 05 (Close screen), 10 (ADR-015).
- Data flow: `CloseScreen` -> `closeToday(outcomes)` -> `Moment[]` kept in state -> `MomentsPlayer` (a `Modal`) -> `onDone` clears the state, leaving the Close screen's closed state.
- Longest bars: `useCloseSummary` now also returns `timedFocus` (today's timed tasks with focus, most first). The `longest` moment carries only the winner, so the other bars come from this small selector in `src/state` (screens and ui never read the db).
- Future: chunk 21 draws best, streak, week, month in place of `Placeholder`, and adds the Settings controls.

## Files
- Player: `src/ui/moments/MomentsPlayer.tsx` (shell, animated stage, reduced-motion stage, ending, Skip and Continue), `SunMarkAnimated.tsx`, `timeline.ts` (worklets), `parts.tsx` (Chrome, Headline, Typed, Mono), `Longest.tsx`, `Day.tsx`, `Placeholder.tsx`, `colors.ts`.
- Text: `src/ui/momentText.ts` (H:MM, clock, spoken durations, headlines, telemetry, detail lines, announcements, ending text).
- Changed: `src/screens/CloseScreen.tsx`, `src/state/hooks/useCloseSummary.ts` (`timedFocus`), `src/ui/SunMark.tsx` (geometry constants exported, `RING_END`, `RING_OPENING`), `src/theme/fonts.ts` (Barlow Condensed 800, `MOMENT_FONTS`), `package.json` (`@expo-google-fonts/barlow-condensed`).
- Tests: `src/ui/__tests__/momentText.test.ts`, `momentsTimeline.test.ts`, `MomentsPlayer.test.tsx`; `src/screens/__tests__/CloseScreen.test.tsx` (new describe).
- Docs: 05, this report, `contract.md`, M8 `README.md`.

## Build
- **Animation approach.** One shared clock `t` (seconds, `withTiming` linear, kept running an hour past the end so "tap to continue" keeps pulsing). Everything is a pure function of `t` (`timeline.ts`), read inside `useAnimatedStyle` / `useAnimatedProps` on the UI thread. The only React state is the moment index and an "ended" flag, each set once per moment through `scheduleOnRN`; no per-frame re-render.
- **The mark** is react-native-svg drawn at full screen size (so it can scale through the camera and stay sharp): a ring `Circle` using `strokeDasharray` (the arc length) with a start rotation of 40 degrees, six `Line` rays, a pulse ring and a dot, all animated props. Geometry comes from `SunMark.tsx` constants. The ring "closes" by growing the arc from 275 to 360 degrees (the 85 degree opening).
- **The fly through**: a circular mask (`overflow: hidden`, animated width, height, radius) centred on the screen; the moment is drawn at full screen size inside it, offset so it stays put while the hole grows. It is hidden before the fly and after the pull back.
- **Moments**: headline = text in a clipped box sliding up from its baseline; typed line = a clipped box whose width grows one monospace character at a time plus a yellow cursor block; odometer = per digit a clipped box holding a 0-9-0-9 column that slides to the digit; bars = animated widths. Grid is a static SVG.
- **Wipe** between moments: a yellow view sliding off to the right, inside the mask.
- **Reduced motion** (`useMotion().reduce`, which is Reanimated's `useReducedMotion`): no fly through, no rolls, no typing. Each moment's final frame fades in (250 ms) and stays 2.2 s, then the ending's final frame. Tap and Skip work the same.
- **Ending**: a `day` moment present -> ring closes, pulse, light haptic (`impactAsync`), "YSAVE MORNINGS" and "N MOMENTS · DAY FINISHED". Otherwise the quiet ending: mark at 50%, ring open, "DAY CLOSED" and "THE DAY CLOSES QUIETLY", no haptic.
- **Accessibility**: `AccessibilityInfo.announceForAccessibility` with a sentence per moment and one for the ending; "Continue" (the whole screen) and "Skip" (44 pt, top right) are buttons with labels.
- **Fonts**: Barlow Condensed 800 added the same way as the others (`FONT_ASSETS`, loaded by `useFonts` at startup). It is a font-asset package (JS and a .ttf), so no new native build.

## Deviations from the prototype
- Longest bars show the three timed tasks with the most focus (the prototype always has three); the row values do not count up, they fade in with their bar growing.
- Each moment lasts 3.6 s (the prototype gives best and week 3.8 and month 4; irrelevant until chunk 21).
- Odometer digit cells use fixed widths (0.5 and 0.32 of the font size) rather than measured glyphs; the headline fits with `adjustsFontSizeToFit`. Both need an eye on a real phone.
- The prototype's quiet card for "no moments" is skipped, as asked.

## Placeholder
`best`, `streak`, `week`, `month`: headline (PERSONAL BEST. / n-DAY STREAK. / WEEK COMPLETE. / MONTHLY GOAL.) and a typed detail line on the same frame. The streak headline uses the real run length (7-DAY, 14-DAY...).

## Tests
- `momentText`: H:MM, clock, spoken durations, every announcement, headlines, telemetry, detail lines, ending text.
- `momentsTimeline`: phases, mark states (draw, fly, pull back, close, quiet), rays.
- `MomentsPlayer`: the four placeholder kinds in order then the quiet ending, Longest with and without extra bars (max three), the animated path mounts with Skip and Continue.
- `CloseScreen`: all tasks done plays LONGEST TASK. then DAY COMPLETE. then the finished ending with its announcements and haptic; a task left plays Longest and the quiet ending with no DAY COMPLETE. and no haptic; moments off and nothing due show no player; Skip and Continue dismiss and leave "Jar closed" with Plan tomorrow.
- Test note: Reanimated's JS build drives timings with `requestAnimationFrame`, which loops forever under jest fake timers (a `FadeIn` layout animation did exactly that). The fade is a `withTiming` shared value instead, and the two test files mock `withTiming` to land on its target. The fake timers leave `requestAnimationFrame` unfaked.

## Errors / open
- Not run on a device. Things to look at on the phone: headline baseline and fit, odometer spacing, fly-through smoothness, status bar colour on Android inside the modal.
- Settings controls (chunk 21) are not here, so Moments off can only be tested through the database for now.

## Check
Checker: independent review, 2026-11-01. Read-only except this section.

**Verdict: PASS** (no must-fix errors; several warnings worth a look before the phone check).

Command tails (app root):
- `npx tsc --noEmit`: no output (clean).
- `npx expo lint`: no output (clean).
- `npx jest`: Test Suites 91 passed, 91 total; Tests 1122 passed, 1122 total; 161 s. Jest also printed "A worker process has failed to exit gracefully ... tests leaking due to improper teardown". Not traced to this chunk (no open handle found by reading; the 1 h clock is cancelled on unmount and `withTiming` is mocked in the two files that mount the player), but it is a new message worth a `--detectOpenHandles` run.
- `npx expo install --check`: lists 8 packages slightly behind SDK 58 patch versions (expo-linking, expo-router, expo-splash-screen, expo-sqlite, expo-system-ui, jest-expo, react-native, react-native-screens). `@expo-google-fonts/barlow-condensed` is not flagged; `^0.4.1` (lock 0.4.1) matches bricolage/fraunces/plex entries. All pre-existing, none from this chunk.

### ERRORS (must fix)
None found.

### WARNINGS
1. The animated (non-reduced) path is almost untested. Every `CloseScreen` player test runs the reduced-motion path (they advance `REDUCED_STEP_MS`). The one animated test (`MomentsPlayer.test.tsx:79`) only mounts and presses Skip. Nothing asserts, on the animated path, that `scheduleOnRN(onIndex)` advances the moment, that `onEnded` fires, that the haptic fires once and only when `day` is present, or that the quiet ending has no haptic. The haptic assertions in `CloseScreen.test.tsx` therefore only cover the reduced path (where, note, there is no ring-closing animation, so a haptic with no visual closing is arguably off-spec; see nit 3). `momentsTimeline.test.ts` covers the pure functions, but not the wiring in `MomentsPlayer.tsx:106-117`. Suggest a test that sets the mocked `withTiming` to land mid-sequence, or drives `useAnimatedReaction` via Reanimated's jest utilities.
2. The clock runs for an hour (`MomentsPlayer.tsx:30,102`). It is cancelled on unmount (`cancelAnimation` in cleanup, line 103) and on dismiss (the Modal unmounts), so no leak. But while the user sits on "TAP TO CONTINUE" every animated style, props and derived value (ring, 6 rays, pulse, dot, `radius`, `mask`, `content`, `wipe`, hint, bar, plus all hidden moment text/bars) is re-evaluated on the UI thread every frame for up to an hour for a pulse that only needs two views. Cheaper: stop the clock at the end and drive the hint pulse from its own looping value. Not a correctness bug; a battery/thermal risk if left open.
3. Screen-reader structure (`MomentsPlayer.tsx:223-238`): the "Continue" button is a full-screen overlay placed before "Skip", so focus order is Continue, then Skip, and "Continue" is announced from the first frame (during the intro it dismisses the whole player). The stage views are `pointerEvents="none"` but are not hidden from accessibility, so VoiceOver/TalkBack can still swipe to underlying texts ("TAP TO CONTINUE", digits, telemetry), which duplicates the announcements. Consider `importantForAccessibility="no-hide-descendants"` / `accessibilityElementsHidden` on the stage, Skip first in focus order, and Continue labelled "Continue" only once `ended`.
4. A tap anywhere during the intro or a moment dismisses everything (Continue is active from t=0). That matches "tap anywhere ... dismisses" literally, but an accidental tap mid-sequence loses the moments, with no replay. Confirm this is wanted (spec text suggests taps are for the "TAP TO CONTINUE" stage; Skip covers "any time").
5. `jest.setTimeout(30_000)` in two files (`CloseScreen.test.tsx:57`, `MomentsPlayer.test.tsx:26`). It hides a real cost: the player mounts a big tree (Chrome with a grid of Svg `Line`s, per-digit `Text` columns of 20 lines, many `useAnimatedStyle`s). In jest that is slow mostly because of RNTL host-tree size and parallel load, but the same tree on a low-end Android device will also cost on first mount (the Modal mounts the full stage at once). The `Day` roll with `moment.total` segments and a 20-line `Text` per digit is the biggest part. Worth a device profile; consider memoising `MomentFrame`/`Grid` and not mounting hidden frames.
6. The `withTiming` mock (`(to) => to`) is a test-only shortcut: it makes the animated stage jump to `t = total + 3600` immediately, so the animated-path tests can never observe an intermediate frame. Together with warning 1 it means the animated sequence is verified only by pure-function tests. `requestAnimationFrame` left unfaked is a reasonable workaround for Reanimated's JS driver, but it also means timers from `rAF` can run after `useRealTimers`; this may relate to the "worker failed to exit" message.
7. Fonts: `BarlowCondensed_800ExtraBold` joins `FONT_ASSETS`, which `src/app/_layout.tsx:57` passes to a single `useFonts` that gates the first render. So loading is not blocked differently, but the startup gate now waits on one more .ttf for a font used only after a close. Acceptable (same pattern as the others); noting for startup-time budget.

### NITS
1. Spec checks that passed on reading: ending choice is `endingText(moments).quiet` from the presence of `day` (`MomentsPlayer.tsx:201,216`); haptic is in an effect on `[ended, ending]` guarded by `!ending.quiet`, `ended` goes true once, so exactly once (a dev-only StrictMode double effect would fire it twice); announcements are effects on `[moments, index]` (once per moment) plus one for the ending; Skip is the last sibling so it sits above Continue and is reachable at any time, `onDone` is idempotent (`setMoments([])`) so double taps are harmless; dismiss clears the `CloseScreen` state, nothing re-sets it (the guard keeps `closeToday` from running twice, and a remount starts with `[]`), so no replay without a new close; unmount cancels the clock, reactions and the reduced-motion timeout, and a late `scheduleOnRN` into a `setState` on an unmounted component is a no-op in React 19.
2. `CloseScreen.tsx:51` `played` is `Moment[] | undefined`; `[]` is truthy, so the closed state is still entered when nothing is due, and `undefined` (blocked double-submit) skips it. Correct, but it relies on array truthiness; a short comment would help.
3. In reduced motion the ending (when `day` is present) still fires the light haptic, though no ring closes visually. Arguably fine (haptic is not movement); spec says haptic belongs to the closing-ring path, so confirm.
4. `MomentsPlayer.test.tsx:39` uses double quotes inside `doNotFake` while the rest of the file is single quoted (prettier/lint did not flag it).
5. Line endings: no mixed endings introduced. HEAD is LF; the working copy of every modified and new file is uniformly CRLF (git warns "LF will be replaced by CRLF"). `git diff --stat` and `git diff --ignore-cr-at-eol --stat` are identical (10 files, 176 insertions, 18 deletions), so no existing doc was rewritten; only the intended single-row/section additions in docs 05, M8 README and contract.md.
6. Untracked `LICENSE` (dated Oct 27) appears in `git status` but is not part of this chunk; do not stage it with the chunk.
7. Docs match code: report text (Modal, shared clock, one hour, 3.6 s, 2.2 s reduced, labels Continue/Skip, `timedFocus`) matches the source. `contract.md` says "a pulse ring"; implemented. The report's claim "no per-frame re-render" holds: the only React state is `index` and `ended` (plus `atEnding` in the reduced stage).
8. SVG sizes: `SunMarkAnimated` draws one full-screen `Svg` (w x h) with 9 elements, and `Grid` another static one per frame-mount; fine on size, but the full-screen Svg re-rasterises on each animated prop change.

## Lead fix (after the check)

- **Warning 4 fixed: an accidental tap lost the moments.** The full-screen Continue button is now rendered only once the sequence has ended, so a tap mid-sequence does nothing. Skip still works at any time. The animated-path test now checks that Continue is not offered mid-sequence and that Skip ends the player.
- **Warning 2 fixed: the idle clock.** `EXTRA_S` dropped from 3600 s to 60 s, so "TAP TO CONTINUE" pulses for a minute and then holds steady at 0.8. Nothing runs per frame after that.
- **Warning 3 fixed: screen-reader structure.**
  - The drawn stage is now hidden from screen readers (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`), so only the announcements speak.
  - Skip comes first.
  - Continue exists only at the end.
  - The two player test files set `configure({ defaultIncludeHiddenElements: true })` so their text queries still find the drawn text.
- **Left as is:**
  - Warning 1 (animated-path coverage). It goes to chunk 21 along with the four remaining moments.
  - Warning 5 (heavy first mount). It needs a check on a real device.
  - Warning 6 (test workarounds).
  - Warning 7 (one more font at startup).
  - Reduced motion still gives the light haptic when every task is done. It marks the finished day even without the ring animation.
- **Re-run by the lead:** `npx tsc --noEmit` clean, `npx expo lint` clean, `npx jest` 91 suites / 1122 tests passed.

## Phone check fix (Expo Go, 2026-11-02)

**Error on the phone:** `[Worklets] Tried to synchronously call a Remote Function. Called "holeRadius" on the UI Runtime.`
The fly-through mask (`MomentsPlayer.tsx`) and the ring pulse (`SunMarkAnimated.tsx`) call `holeRadius` inside animated
callbacks, but `holeRadius` had no `'worklet'` directive. Jest runs worklets as plain JS, so no test could see it.

**Repro test first:** `src/ui/__tests__/momentsWorklets.test.ts` compiles every file in `src/ui/moments/` with the
worklets Babel plugin (as the app bundle does), reads what each worklet captures (`this.__closure`), and fails when a
captured function of ours is not a worklet. It failed with `holeRadius` in both files, matching the phone.

**Fix:** `holeRadius` is now a worklet (still callable from plain JS, e.g. `zoomToCover`).

**Result:** tsc clean, lint clean, 92 suites / 1130 tests pass.
