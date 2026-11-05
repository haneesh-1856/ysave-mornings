# M13 fix 1 · Pixel 9a close: missing digits, Skip overlap, crash lab (2026-11-05)

**Reported (user, Expo Go, Pixel 9a):** closes on 2 Nov and 4 Nov (01:39, all 4 tasks done) quit Expo Go right after
"2 / 3 DAY COMPLETE", as the 3rd moment started. Moments always play longest, day, best, streak, week, month, so the
3rd is always a 3D scene: both crashes happened when the first 3D scene mounted. Screenshots also showed the DAY
COMPLETE counters without digits (only "/" and ":") and SKIP drawn over the "01:39" stamp. No device log (user
declined adb), so the crash cause is narrowed down on the phone with a dev-only lab first, then fixed.

## Changed
- `parts.tsx` DigitCell: each rolling digit column is 20 one-line texts in fs-high boxes (was one 20-line text,
  which Android did not draw inside the clipped cell). Same timing and look.
- `MomentsPlayer.tsx`: Skip moved to the bottom right (`insets.bottom + 12`); it sat on the telemetry stamp.
  Plus the temporary `DEV_MOMENTS_SPEED` (0.25 in dev) from 2026-11-03, still to be removed after the crash fix.
- Moments lab (dev only): `ui/moments/lab.ts` (switches + step reporter, no data access), `state/devLab.ts`
  (trail, last close, switches in the settings table; synchronous writes survive a native crash), Scene3D and
  Label3D follow the switches and report mount, half-second frames and unmount; the player reports open, each
  moment mounted, ending, close. `_layout.tsx` plugs the sink in under `__DEV__`; CloseScreen saves the last close
  under `__DEV__`. Screen `screens/MomentsLabScreen.tsx`, route `app/dev/moments-lab.tsx`, Profile row (dev only).
- Switches: draw the 3D scene; colours as designed / never the string "none" / one fixed grey; animated dashes;
  floating labels. Defaults draw exactly as before.
- Worklet guard test: a function passed to `scheduleOnRN` is allowed to be a plain JS function (it runs back on
  the JS thread), as `onIndex` already was.

## Not changed
- Font scaling: briefly turned off in the player, reverted. Doc 07 requires text to follow the phone's font size
  up to 1.3x and the accessibility audit enforces it.

## Tests
`momentsLab.test.tsx` (digits as one-line texts, each switch, trail), `state/__tests__/devLab.test.ts` (trail order
and cap, last close, switches). tsc clean, lint clean, `Test Suites: 112 passed`, `Tests: 1364 passed`.
Nothing committed.

## Phone check (user)
See the steps given in chat on 2026-11-05: Profile > Moments lab, play example moments with different switches, read
the crash trail after each crash.

## Cause found (2026-11-05, Moments lab on the Pixel 9a)
Playing "best" in the lab showed a red box instead of quitting: `[Reanimated] Invalid color value: "none"` in
`processColor` <- `updatePropsNative`. The trail ended at "3D frame at 0.0 s: 0 shapes". Every 3D slot animates
`fill`/`stroke`, and the prims use the SVG paint `'none'` for "no fill"/"no outline"; Reanimated converts animated
colours with processColor on Android, which throws for `'none'`. Longest and Day have no 3D shapes, so they worked;
the web build accepts `'none'`, so the sandbox never showed it.

**Fix:** `slotProps` (pure worklet in Scene3D.tsx) sends `'transparent'` with opacity 0 wherever a prim says
`'none'`; it draws the same nothing. The lab's temporary 'noNone' colour mode was removed (it is now the default).
**Test:** `scene3dColors.test.ts` runs best, streak, week and month (goal and no goal) frame by frame (0-4 s) and
passes every slot's colours through Reanimated's own processColor (jest throws the same "Invalid color value" for
'none'). Checked that it fails (6 of 7) with the old behaviour. `Test Suites: 113 passed`, `Tests: 1370 passed`;
tsc and lint clean. Still temporary: DEV_MOMENTS_SPEED (0.25 in dev) until the user has watched the scenes.

## Second cause (2026-11-05, same session, after the colour fix)
Lab "best": the sun mark drew and circled, then Expo Go closed with no red box (native). The colour error had been
stopping every frame before it reached native drawing. Solid lines sent `strokeDasharray: []`; react-native-svg's
Android `RenderableView.setStrokeDasharray` keeps an empty (non-null) array and `setupStrokePaint` then builds
`new DashPathEffect(new float[0], offset)`, which Android rejects (fewer than 2 intervals): a native exception on
the draw, app closed. Read in `node_modules/react-native-svg/android/.../RenderableView.java` (lines ~296-306, ~622-628).

**Fix:** `SOLID = [100000, 0]` (one dash longer than any line, no gap: still solid, valid for DashPathEffect).
**Test:** `scene3dColors.test.ts` also applies Android's dash rule (>= 2 values after odd-doubling, all >= 0, total
> 0) and checks no path `d` has NaN/Infinity, on every slot of every frame of every scene; fails 6 of 8 with `[]`.
`Test Suites: 113 passed`, `Tests: 1371 passed`; tsc, lint clean. Not committed.
