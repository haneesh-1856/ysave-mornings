# M8 chunk 2 - Welcome flow UI

## What it is for
The first-run welcome flow: five steps on one screen (Welcome, Day start, First topic, First task, Ready), the app-icon mark (`SunMark`), and the launch redirect that sends a fresh install there.

## Connections
- `src/state/actions/onboarding` (`finishOnboarding`, `skipOnboarding`), `src/state/hooks/useOnboarding` (`needsOnboarding`), `src/state/errors` (`ValidationError`), `src/state/hooks/useSubmitGuard`
- UI parts reused: `HourPicker`, `TextField`, `ColorSwatches`, `ChipSet`, `Card`, `Screen`, `Button`, `T`
- `react-native-svg` for `SunMark`; routes `/plan/[dayKey]` and `/today`

## Future connections
Chunk 6 (Maestro golden path) drives these testIDs:
- `onboarding-start`, `onboarding-skip` (step 1)
- `onboarding-next` (steps 2 to 4), `onboarding-finish` (step 5, label "Plan today")
- `onboarding-back`, `onboarding-step` (text "N of 5")
- Inputs are found by accessibility label: "Topic name", "Task name"; radios by label ("6:00 AM", "Color 2", "Checklist", "45").
- `sun-mark`, `sun-ring`, `sun-ray` on the SVG parts.

## Files
- src/ui/SunMark.tsx (new)
- src/screens/OnboardingScreen.tsx (new)
- src/app/onboarding.tsx (new)
- src/app/index.tsx (changed: `launchHref` helper + once-per-mount `needsOnboarding`)
- src/ui/__tests__/SunMark.test.tsx (new)
- src/screens/__tests__/OnboardingScreen.test.tsx (new)

## Build
- SunMark computes the ring endpoints and ray ends from the angles (centre 50,50, clockwise from top). The ring path is `M61.83 35.90 A18.4 18.4 0 1 1 36.99 36.99`, identical to `assets/brand/unfinished-sun.svg`. Butt caps, widths 8.5 / 5, hidden from screen readers.
- `index.tsx` reads `needsOnboarding()` in a `useState` initializer (once per mount), so the flow's own writes cannot re-route. `useMorning()` is still called unconditionally (rules of hooks). The decision is the exported pure helper `launchHref(onboarding, morningDue)`, which the tests use.
- `useMorningRedirect` confirmed safe: it only pushes on a `due` false-to-true edge, and `due` needs an earlier `days` row. A fresh install (and the flow's own plan-today day row) has none. No change made.
- Navigation to Plan uses `router.replace({ pathname: '/plan/[dayKey]', params })`, the repo's typed-route form (the template-string form fails tsc typed routes).
- Step state is kept in the screen; nothing is written until "Plan today". Next is disabled until topic or task name is non-blank (trimmed). Length chips use `clearable={false}` so a length is always chosen.
- Android hardware back goes to the previous step; on step 1 it falls through to the system default.
- No danger-colour theme token exists, so the inline `ValidationError` message is bold `ink` text with `accessibilityRole="alert"` (TextField/Button/DayStart hard-code the red; I did not add another).
- Ambiguity: the contract says checklist "Next" semantic only for steps 2 to 4; step 5 uses its own button.
- SVG test queries need `{ hidden: true }` (the mark is hidden from the accessibility tree) and stroke props arrive processed as ARGB ints.

## Outputs
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- `npx jest src/screens src/ui src/state --silent`: 50 suites, 547 tests; 49 suites passed. CalendarScreen had 2 timing failures under full parallel load (56 s, known); rerun alone: 12 of 12 passed.
- New tests: SunMark 3, OnboardingScreen 8 (6 flow + 2 launch decision), all passing.

## Errors
- Test db: `Crypto.randomUUID` returns nothing under jest, so the first run failed with `NOT NULL constraint failed: tasks.topicId`; fixed by mocking `@/state/ids` as the state tests do.
- tsc: `/plan/${key}` string not assignable to typed routes; switched to the object form.

## Check

### Verdict: PASS (no blocking errors)

Errors: none.

Verified
- Fresh install -> `finishOnboarding` -> `/plan/<todayKey>`: with no days row, `plannableDays(todayKey, null)` = [today, tomorrow], so the screen opens in plan mode (title "Plan today", no "not plannable"). The new task (isDefault, repeatMask 127) is pre-ticked. Confirming calls `router.replace('/planned/[dayKey]')`, writes the day row (planConfirmedAt set, 1 dayTask), and `needsOnboarding()` is false afterwards. Proven by a check test I added: `src/screens/__tests__/OnboardingToPlan.check.test.tsx` (timed and checklist variants, 2 tests, passing). Keep or delete as you prefer.
- Skip: `skipOnboarding()` then `replace('/today')`; Today with an empty db shows "Nothing planned for today" (existing TodayScreen test covers it).
- `index.tsx`: `useState(needsOnboarding)` runs once; `useMorning()` called unconditionally; `launchHref` correct. The onboarding route is auto-registered by the root Stack.
- Back: step Back, Android hardware back (step 0 falls through), Next disabled on blank trimmed names, inline ValidationError (role alert), nothing written before "Plan today" (state only in component).
- SunMark geometry matches `assets/brand/unfinished-sun.svg` (ring path identical; ray angles/inner radii/outer 32/width 5, butt caps), hidden from screen readers.
- Layering: no `src/data`/`getDb` imports (ValidationError via `@/state/errors`), no `any`, only hard-coded colour is the SunMark default `#f7d45e`. Privacy line exact. Buttons use role + label, Back minHeight 44, Button minHeight 48; Screen scrolls.
- testIDs listed in the report all exist.

Non-blocking notes
1. After `router.replace` to Plan, Plan's "Back" button calls `router.back()` with no history behind it (onboarding was replaced), so it may do nothing on first run. Same family as the Day start fallback in chunk 5; consider a `router.canGoBack()` fallback to `/today`.
2. Error text uses `ink` rather than a danger colour (builder noted; no token exists).
3. Hour step Next is always enabled (a default of 4 is always valid), as intended.

Command outputs
- `npx tsc --noEmit`: clean (exit 0)
- `npm run lint`: clean
- `npx jest src/screens src/ui src/state --silent` (before my added test): 51 suites, 549 tests, 2 failed (CalendarScreen timeouts under load), rest passed
- Full `npx jest --silent`: 70 suites, 818 tests; 69 suites passed; only CalendarScreen failed (2 timeouts, 54 s). CalendarScreen rerun alone together with my test: 2 suites, 14 tests, all passed.

## Lead changes (after the check)
- Kept the checker's proof test, renamed to `src/screens/__tests__/OnboardingToPlan.test.tsx`.
- Preview mode for the phone check: `/onboarding?preview=1` walks every step but saves nothing; Skip and "Plan today"
  call `router.back()`. Reached from a `__DEV__`-only Profile row "Preview welcome flow" (never in a release build).
  2 tests added. tsc ✓, lint ✓, Onboarding + Profile + OnboardingToPlan suites 19/19 ✓.
- Checker note 1 (Plan's Back after the replace from onboarding has no history) moved to chunk 5.
