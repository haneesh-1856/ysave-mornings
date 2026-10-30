# M4 · Chunk 2 · Run UI

## Build (Sonnet)

### Purpose
Presentational components for Today and Run (chunks 3–4): task rows, the draining countdown bar, the big number, the celebration, and the bottom dock with the jar. No `src/state` or `src/data` imports.

### Files
New in `mobile/src/ui/`: `TaskRow.tsx`, `CheckRow.tsx`, `CountdownBar.tsx`, `BigNumber.tsx`, `Celebration.tsx`, `Dock.tsx`, `timeText.ts`.
Tests in `src/ui/__tests__/`: `RunUi.test.tsx` (TaskRow, CheckRow, CountdownBar, BigNumber, Celebration, Dock), `timeText.test.ts`.

### Connections now
- `timeText` uses `minutesLeftLabel` / `extraMinutesLabel` from `@/domain/timer`; `TaskRow` imports the `TimerState` type.
- `CheckRow` uses `Checkbox`; `Dock` uses `Collection` (scale 0.5, `animateLast`); `Celebration` uses `useMotion` and `expo-haptics`; everything else uses `T` and theme colors only.

### Future connections
- Chunk 3 (Today): `TaskRow` / `CheckRow` inside folds (a `useNow` per running row), `Dock` with `useToday().items`.
- Chunk 4 (Run): `BigNumber` + `CountdownBar` in one child that owns `useNow` (only the number and bar update); `Celebration` driven by completion.
- M5 Close summary reuses `BigNumber` and `Dock`.
- M7: bar variant from `t.look.bar`, other dock layouts (hero, corner), the 11 other collection looks (plug into `Collection`).

### Decisions
- `topicColor` is a `TopicColorKey` (resolved with `t.topic()`), not a hex string. `forwardedFrom` is an already-formatted weekday ("Thursday"); the row prepends "from ".
- `CountdownBar` widths are reanimated shared values with linear 1 s `withTiming`, so a 1 Hz prop change glides on the UI thread; instant under Reduce Motion. Overtime stripes are skewed alternating Views (no gradient dependency), width = overtime/budget, capped at full width. Seg gaps are bg-colored overlays at each 15-min boundary.
- `Celebration` fires the success haptic from an effect keyed on `visible` with a `was` ref guard (once per hidden-to-visible transition; replays after hiding again).
- `Dock` reads `SafeAreaInsetsContext` directly (null-safe) instead of `useSafeAreaInsets`, which throws without a provider in tests. It is a Pressable button only when `onPress` is given.
- Gold mark is a star next to the time text; done check only in `stopped`; overtime under 60 s shows "+0 min extra" (floor, per doc 04 §4).
- Exported `taskRowText` helper from `TaskRow.tsx` for reuse.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: 1 error, in the parallel builder's `src/state/hooks/useNow.ts` (react-hooks/set-state-in-effect); none in my files.
- `npm test`: 39 suites, 404 tests passed.
- `npm run test:coverage`: 39 suites, 404 tests passed, thresholds held. `mobile/coverage` deleted.

### Known limitations
- Needs phone checks: bar glide smoothness at 1 Hz, skewed stripe look, success haptic feel, dock safe-area padding on a notched device.
- `CountdownBar` stripes are not diagonal-clipped at the right edge beyond the parent's rounded clip; fine visually but unverified.
- Sound (chime) is not part of these components.

## Check (Sonnet)

### Verdict: FAIL (one small, real defect; everything else passes)

### ERRORS
1. `mobile/src/ui/Celebration.tsx:13` — expected: the success haptic fires only on a hidden-to-visible transition, so a Run screen opened on an already-done task does not celebrate again. Actual: `const was = useRef(false)` means a component that mounts with `visible={true}` runs the effect with `was.current === false` and fires the haptic (and shows the text) on mount. Proof: read of lines 13-19; `RunUi.test.tsx` never mounts with `visible` true, so it is uncovered. Fix: `const was = useRef(visible);` (no haptic on mount), plus a test: render `<Celebration visible />` and assert `notificationAsync` not called. Document that Run must keep `<Celebration>` mounted and flip `visible` when completion happens during the session.

### Non-blocking notes
- Prop deviations are acceptable. `topicColor: TopicColorKey` is consistent with M2/M3 (`t.topic(key)`). `forwardedFrom` is a pre-formatted weekday, which matches M3's single-source day-name rule; screens MUST pass `weekdayName(dayKey, locale)` (never an English literal). `a11yLabel`/`onPress` as per contract.
- Text per state matches the contract. Boundaries: 60_000 -> "1 min left", 60_001 -> "2 min left", 0 and negative -> "0 min left". Overtime 59_999 -> "+0 min extra". The prototype (line 621) also uses `Math.floor` and shows "+0", and the Run label carries "Done · still going", so this is consistent and acceptable.
- Prototype's overtime stripe width is extra/30 min; here it is overtime/budget (capped). Contract is silent. Fine.
- Dock: `SafeAreaInsetsContext` is `Context<EdgeInsets | null>` (checked in node_modules); expo-router's `ExpoRoot` wraps the tree in `SafeAreaProvider`, and the `?.bottom ?? 0` fallback is null-safe. OK.
- CountdownBar: widths are shared values with `withTiming` and `useAnimatedStyle`, so there is no per-frame JS. Seg gaps are at 15-min boundaries; fractions are clamped; progressbar `accessibilityValue` is present. Reduce Motion is respected (CountdownBar via `useReducedMotion`; Celebration via `useMotion`). No hex or rgb literals in scope (grep clean).
- Gold star and check are hidden from a11y; the caller's `a11yLabel` must mention gold/done.

### Command outputs
- `npm run typecheck`: clean.
- `npx expo lint`: no output (clean).
- `npx jest src/ui/__tests__`: 12 suites, 86 tests passed.
- `mobile/coverage` removed.

## Fix (Opus)

### Error
`Celebration.tsx:13` `const was = useRef(false)`: mounting with `visible={true}` fired the success haptic (and ran the show path) on mount, so a Run screen opened on an already-done task celebrated again.

### Root cause
The transition guard was seeded with a constant `false`, so the first effect run always looked like a hidden-to-visible change, whatever the initial prop was.

### Change
- `mobile/src/ui/Celebration.tsx:20` `const was = useRef(visible)`: the guard is seeded from the first `visible`.
- `mobile/src/ui/Celebration.tsx:24-27`: the effect returns early when `visible === was.current` (mount and same-value re-renders); on a real change it updates the ref, fires the haptic only when becoming visible, and sets the shared value (instant under Reduce Motion, `animate` otherwise; Reduce Motion behaviour unchanged).
- Mount-with-visible decision: renders the **static "Done for today" text** (shared value starts at 1, so no pop) with **no haptic**. Chosen over rendering nothing because the Run screen still needs the done label, and the contract's rule is that the *celebration* (pop + haptic) happens once and a re-render never replays it; showing the static label is not a replay.
- The component is transition-based: visible -> hidden -> visible celebrates again. For the same task this cannot happen in practice (completion is final), but the component itself makes no task-level assumption; documented in the component's doc comment (`Celebration.tsx:10-16`).

### Tests (`mobile/src/ui/__tests__/RunUi.test.tsx`, Celebration describe)
- Existing: false -> true fires once; true -> true (text change) does not refire; true -> false -> true fires again.
- New: mount with `visible` shows "Done for today", haptic not called; a re-render with true -> true still not called.
- New: mount visible -> hide (text gone, no haptic) -> show fires exactly once.

### Command outputs
- `npm run typecheck`: clean. (The first run hit TS6053 on a transient `src/state/__tests__/zzprobe.test.ts` from the parallel checker; a rerun was clean.)
- `npm run lint`: clean (no output).
- `npx jest src/ui/__tests__`: 12 suites, 88 tests passed.
- `npm test`: 41 suites, 422 tests passed.
- `mobile/coverage` deleted.

### Downstream
- Chunk 4 (Run): keep `Celebration` mounted for the whole session and flip `visible` from false to true when the task completes; that transition is what plays the pop and haptic. If the screen opens on a task that is already done, pass `visible` true from the first render: the static label shows and nothing replays. Do not conditionally mount it (`{done && <Celebration visible />}`), because mounting it already visible never celebrates.

## Re-check (Sonnet)

### Verdict: PASS (the fix is correct, no regressions, no remaining errors)

### Verified
1. Mount with visible=true: `useRef(visible)` and `useSharedValue(1)` mean the effect returns early. No haptic, no pop, and the static "Done for today" text shows. Covered by the new test, and by my StrictMode probe.
2. false -> true: the effect passes the guard, updates the ref, fires the haptic once, and sets `p.value`. That is `animate(1)` normally and `1` directly under Reduce Motion (instant). The Reduce Motion path was checked by reading the code only, because no test sets Reduce Motion.
3. true -> true rerenders (including a text change): `visible === was.current`, so nothing fires. Covered by tests.
4. StrictMode: I probed with a temporary test (deleted afterwards) that rendered inside `<React.StrictMode>`.
   - mount true: 0 haptics, text shown.
   - mount false: 0 haptics.
   - false -> true: exactly 1 haptic, and still 1 after a further true -> true rerender.
   - Reason it holds: StrictMode double-invokes effects only on mount, and on mount the guard returns early. On a real transition the first run sets `was.current = visible`, so any repeat run is a no-op.
   - The probe passed 3/3. It printed stack-trace console noise, which did not fail it.
5. Tests are meaningful: 3 Celebration tests. They cover mount-visible (no haptic, text present), false -> true once, true -> true no refire, and visible -> hidden -> visible replaying once. Nit, not a defect: no test sets Reduce Motion, and no test mounts inside StrictMode.
6. Commands:
   - `npm run typecheck`: clean.
   - `npm run lint`: clean (no output).
   - `npx jest src/ui/__tests__`: 12 suites, 88 tests passed.
   - `mobile/coverage` deleted. The temporary probe file was removed.

### Remaining errors
None.
