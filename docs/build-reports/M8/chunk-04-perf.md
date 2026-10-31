# M8 chunk 4 · Performance pass

## What it is for
Keep the Run screen cheap at 1 Hz, check the long lists, and stop glass blur from hurting low-end Android phones, per docs/07 "Performance budgets".

## Connections
- `RunScreen` (`RunClock` > `LiveFace` owns `useNow`) already isolates the tick.
- `buildTheme` takes a new `lowEndDevice` option; `ThemeProvider` reads `isLowEndDevice()` once and the `blurChosen` flag from `useLookStore`.
- `saveLook` / `loadLook` (src/state/actions/look.ts) maintain `blurChosen`; `Card` already skips `BlurView` when `t.glass.blur` is false.

## Future connections
- A device check of the real cost of blur on a budget phone (decide whether the 3 GiB / 2019 thresholds are right).
- If Topics/Plan ever hold hundreds of rows, revisit FlatList (see Decisions).

## Files
- New: `src/state/device.ts`, `src/state/__tests__/device.test.ts`, `src/theme/__tests__/lowEndBlur.test.tsx`.
- Changed: `src/theme/buildTheme.ts`, `src/theme/ThemeProvider.tsx`, `src/state/actions/look.ts`, tests in `RunScreen.test.tsx`, `theme.test.ts`, `look.test.ts`.
- No change to `RunScreen.tsx` (nothing to fix).

## Build
**1. Run tick.** Measured first. The existing test already proved `useRunTask` (the screen) does not re-render per tick; I added probes on `Header` (a heavy sibling of the clock) and `BigNumber`. Result over 10 one-second ticks: `Header` +0 renders, `RunScreen` +0, `BigNumber` +10 (it ticks). Before = after, because `LiveFace` already owns the tick subscription, so no code change. One finding: pressing Start re-renders the body once, when the button cooldown resets 500 ms later (`guard.reset`); the test settles that first. The bar uses plain props, not Reanimated shared values; only `ClockFace` re-renders, which is cheap, so I did not rewrite it.

**2. Lists.** No conversion. Topics renders one `TopicFold` per topic, and the folds are collapsed accordion bodies with animated height (measured natural height); Plan renders rows grouped per topic inside a Screen ScrollView with a draft form. A virtualized list would break the fold height measurement and the card flip, and a realistic count is well under 30 visible rows (a handful of topics, dozens of tasks at most). Revisit only if a real user has several hundred tasks.

**3. Low-end glass.** `isLowEndDevice()`: Android only; true if `totalMemory < 3 GiB`, or `deviceYearClass < 2019` when available; false on iOS, web, or unknown (null). Both fields exist in expo-device 58 (checked its types).
"Never chosen" rule, without changing the saved look: the saved `look` always holds a full mix (including `gblur: 'medium'`), so "absent gblur" cannot work. Instead a separate setting `gblurChosen` (boolean) plus store field `blurChosen`. `saveLook` sets it when the save actually changes `gblur` (so GlassScreen/Look confirms count, applying a favourite with the same level does not). `loadLook` sets it from the flag, or when the saved level differs from the default (covers anyone who chose a level before this flag existed). Theme: `lowEndDevice = isLowEnd && !blurChosen` => `glass.blur = false` (frost colour kept; also off under Reduce Transparency as before). Limitation: on a low-end phone the only way to get blur back is to pick a different level than the current one; re-picking "Medium" alone is not possible (GlassScreen only saves changed fields).

**4. Cold start.** Reviewed `src/app/_layout.tsx`: fonts load via `useFonts`, migrations via `useMigrations` (sync), `loadLook` is one settings read; splash stays until all are done. Nothing obviously wasteful; no change. Real timing needs a device.

Needs a real low-end phone: whether blur-off is enough (and whether Medium blur is acceptable on 3-4 GiB phones), cold start < 2 s, Run tick smoothness.

## Outputs
tsc clean; lint clean. Full jest: 859 passed, 3 failed (CalendarScreen swipe test timeouts and one other timeout in the parallel load; both CalendarScreen and GlassScreen pass when rerun alone together with the theme/state/Run suites: 95/96 then 14/14 Run after fixing my probe loop).

## Errors
- My first tick probe advanced 10 s in one `act`, which batches to one render; fixed by 1 s steps.
- Lint rule `react-hooks/use-memo` rejected `useMemo(isLowEndDevice, [])`; now `useState(isLowEndDevice)`.
- Test used a non-existent blur key `strong`; the keys are thin/soft/medium/heavy/deep.

## Check

## Check
**Verdict: FAIL** (one UX/contract error, item 1; everything else passes).

### Errors
1. `src/screens/GlassScreen.tsx:52,118` + `src/theme/ThemeProvider.tsx` (lowEndDevice rule): on a low-end phone with no blur choice, the Glass screen shows "Medium" selected while the effective blur is OFF, and the GlassPreview (inner `ThemeProvider look={draft}`) also renders without blur, since `blurChosen` is read from the store. DEFAULT_LOOK is `surf: 'glass'`, `gblur: 'medium'`, so every low-end phone is in this state by default. Selecting Medium and confirming does nothing (`confirm` only patches changed fields; `saveLook` counts a choice only when `gblur` changes). This is a misleading UI state and breaks the contract's intent ("user has not chosen" must be a reachable state change: any explicit choice should count). Fix: (a) GlassScreen shows effective state on low-end/unchosen, e.g. value "Off (low-end default)" and a tappable Medium that counts; (b) make an explicit Confirm on the Glass screen always count: `confirmLook` passes `gblur` (or sets `blurChosen`) even when unchanged and the Confirm button enables when `!blurChosen && lowEnd`; (c) the preview should reflect the draft blur (let the preview provider treat a draft gblur differing from default, or any selection tap, as chosen). Needs a small way to expose `isLowEnd` to the screen (e.g. theme `glass.blur` plus a `lowEndDefault` flag).

### Passes
- Full jest: this run 73/74 suites, 860 passed, 2 failed, both `src/screens/__tests__/CalendarScreen.test.tsx` ("arrows move to any past or future month, across the year boundary, both ways"; "swipe moves through months both ways, across the year boundary"), 5000 ms timeouts under full parallel load (97 s file time). The builder's "third" failure did not reproduce this run (GlassScreen passed); it is presumably the GlassScreen known flake. Rerun alone `--runInBand` Calendar+Glass: 2 suites, 20/20 pass. So only the known load flake (chunk 5 item). No other failure.
- tsc --noEmit: clean (exit 0). `npm run lint`: clean (no output beyond the command banner).
- Tick probe: Header and BigNumber are wrapped with test-only `jest.mock` wrappers (no production hooks); production RunScreen diff is only the unrelated `color="danger"` change from earlier chunks. BigNumber delta >= 9 over ten 1 s ticks proves the probe mechanism and that the clock ticks; RunScreen `mockRenders` unchanged. Minor note: Header count is only asserted unchanged, never asserted >0 initially, so that single assertion could in theory pass vacuously; the BigNumber assertion uses the same mock pattern so risk is low. Optional hardening: `expect(mockHeaderRenders.n).toBeGreaterThan(0)` before the loop.
- `isLowEndDevice` (src/state/device.ts): `totalMemory` and `deviceYearClass` are `number | null` in node_modules/expo-device/build/Device.d.ts (lines 89, 100); Android-only; null/unknown -> false; iOS/web false; ThemeProvider reads once via `useState(isLowEndDevice)`. Tests cover it. Note: Platform.OS is checked at call time; fine.
- `gblurChosen` compatibility: old installs with default level and no flag on low-end -> blur off (matches "default off"); old installs with a non-default saved level -> inferred chosen -> blur stays on (correct, only the user could set it). Inference misses the case of an old user who deliberately picked Medium (blur turns off for them once on low-end; acceptable but note it). Favourites: applying a favourite with a different level counts as a choice, same level does not (documented, tested). Reset (look back to defaults): `saveLook` never clears `blurChosen`, so once chosen it stays chosen; fine. Saved `look` shape unchanged, matches "no change to saved looks".
- Lists decision (no FlatList; collapsible folds with measured height, small counts) is documented and reasonable. Cold start review is honest (static review only, device timing flagged as needed).
- Layering: no screens/ui imports of src/data; `ThemeProvider` imports `../state/device` (state -> theme direction already exists via look store); no `any`; style consistent.

### Command outputs
- `timeout 900 npx jest --silent`: Test Suites: 1 failed, 73 passed, 74 total; Tests: 2 failed, 860 passed, 862 total; failing = the two CalendarScreen tests above.
- `npx jest --silent --runInBand CalendarScreen GlassScreen`: Test Suites: 2 passed; Tests: 20 passed.
- `npx tsc --noEmit`: exit 0, no output. `npm run lint`: no findings.

## Fix (Opus)
Error 1 (low-end phone shows "Medium" while blur is off; confirming Medium did nothing).

### Changes
- `src/theme/buildTheme.ts`: theme gets `lowEndDefault: boolean` (true while the low-end default is in effect, i.e. the `lowEndDevice` option was passed). Top-level, not under `glass`, so the Glass screen sees it even when the saved surface is not glass.
- `src/theme/ThemeProvider.tsx`: new optional `blurChosen` prop overrides the store flag for its subtree (like `look`), so the Glass preview can show the draft pick.
- `src/state/actions/look.ts`: `saveLook(patch, { chooseBlur })` / `confirmLook(patch, { chooseBlur })`. `chooseBlur: true` is a deliberate blur choice: it sets `blurChosen` and saves `gblurChosen` even when the level does not change. Without the option, behaviour is unchanged, so applying a favourite keeps its current rule (it counts only when the level changes).
- `src/screens/GlassScreen.tsx`: when `t.lowEndDefault` is true and no blur chip has been tapped yet, no blur level shows as selected and a sub line under BLUR reads **"Off, to save battery on this phone. Pick a level to turn it on."** Tapping any level selects it, the preview draws with blur (`GlassPreview` passes `blurChosen` from the draft), and Confirm becomes enabled. Confirm calls `confirmLook(patch, { chooseBlur: true })`, so confirming Medium (the same level) turns blur on. On other phones, or once a choice exists, nothing changes. The screen only reads the theme flag: no import of `src/state/device`.
- Tests: `GlassScreen.test.tsx` mocks `@/state/device` and `expo-blur` (a testID stand-in, the same as CardBlur.test) and adds 4 tests: low-end + not chosen shows the off copy, no level selected, no blur drawn, Confirm disabled; picking Medium previews blur (1 BlurView), Confirm sets `blurChosen` and saves `gblurChosen` with the look unchanged, then blur is on in the screen theme (2 BlurViews); low-end + already chosen behaves normally; on a normal phone, re-picking Medium keeps Confirm disabled and is not a choice. The existing "back goes back" test's sync `act(() => handler())` became `await act(async ...)`, because the unawaited sync act left later renders in the file unflushed (the new tests failed only when they ran after it). `lowEndBlur.test.tsx`: the probe also prints `lowEndDefault`, plus a test of the `blurChosen` override. `look.test.ts`: `confirmLook({})` is not a choice; `confirmLook({}, { chooseBlur: true })` is, and is saved.
- Hardening: `RunScreen.test.tsx` tick test asserts `mockHeaderRenders.n > 0` before the tick loop.

### Results
- `npx tsc --noEmit`: clean. `npm run lint`: clean.
- `npx jest src/theme src/state src/screens/__tests__/GlassScreen.test.tsx src/screens/__tests__/RunScreen.test.tsx --runInBand --silent`: 22 suites, 228/228 pass.
- Full `npx jest --silent`: 73/74 suites, 866 passed, 2 failed: the two known CalendarScreen load-timeout tests ("arrows move to any past or future month…", "swipe moves through months…"). No other failures; GlassScreen passed.
- Rerun alone `npx jest --silent --runInBand CalendarScreen GlassScreen`: 2 suites, 24/24 pass.

## Re-check
**Verdict: PASS**

### Errors
None.

### Notes
- Low-end + not chosen: `lowEndDefault` (theme, top level) true -> no chip selected (`value=null`), off copy "Off, to save battery on this phone. Pick a level to turn it on." shows, preview blur off (`blurChosen` = blurPicked = false). Tap a level -> `blurPicked`, preview gets `blurChosen=true` so it blurs, `changed` true so Confirm enables. Confirm -> `confirmLook(patch, {chooseBlur: true})` -> `saveLook` sets store `blurChosen` and persists `gblurChosen` even at the same level; live theme then blurs (test covers 1 -> 2 BlurViews).
- Normal phone: `lowEndDefault` false, `blurPending` false, `value` unchanged, `chooseBlur: false`; `saveLook` rule `blurChosen || chooseBlur || gblur changed` leaves favourites (`applyFavourite` passes no opts) on the old rule. Saved look shape unchanged (flag is a separate setting). Reduce Transparency still ANDs into `glass.blur` in buildTheme, so it wins.
- Override scope: `blurChosen` prop applies only inside that `ThemeProvider` instance (the preview subtree); it is not written to the store, so no leak. Preview passes `undefined` when not low-end.
- Layering: GlassScreen imports only `@/state/actions/look` and theme/ui; no src/data or state/device import in screens/ui (grep clean). Only ThemeProvider (theme) imports state/device, as before.
- act() change: the unawaited sync `act` around the back handler left pending work that bled into later tests; awaiting an async act flushes it. It is a test-hygiene fix, not hiding a product bug (the new tests failed only when ordered after it, consistent with leaked act state).
- Copy is calm and accurate. Minor: after a tap on a level the draft value shows, and Cancel drops it; fine.
- RunScreen hardening (`mockHeaderRenders.n > 0`) present.

### Command outputs
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: clean.
- `npx jest --silent` full: 73/74 suites; 867 passed, 1 failed: CalendarScreen "arrows move to any past or future month, across the year boundary, both ways" (known parallel-load timeout).
- `--runInBand CalendarScreen GlassScreen lowEndBlur look.test`: 4 suites, 41/41 pass.
