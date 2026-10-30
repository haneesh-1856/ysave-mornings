# M5 · Chunk 4 · Morning screen

## Build (Sonnet)

### Purpose
The "A fresh page" Morning screen, shown on the first open of a new day: weekday, Day N, the soft chain, the sunrise card, and today's jar if today is already planned. It replaces the chunk 1 placeholder.

### Files
- `src/app/morning.tsx` — thin route: `export default MorningScreen`. Path stays `/morning`.
- `src/screens/MorningScreen.tsx` — the screen.
- `src/screens/__tests__/MorningScreen.test.tsx` — 7 tests (5 screen, 2 `Index` redirect).

### Connections now
- Reads `useMorning()` (todayKey, dayNumber, plannedToday, items), `useChain()`, `usePlannableDays()` (to decide whether "Plan today" is allowed).
- UI: `Screen` (no `tabs`, so no tab bar space), `Header` (weekday title, "Day N" note), `Chain`, `SunriseCard` (dayName via `weekdayName(todayKey)`), `Collection` (`animateLast`, scale 2), `Button`, `T`.
- `markMorningSeen()` in a mount effect. This makes `useMorning().due` false, which re-arms `useMorningRedirect` (mounted once in RootStack; not called again here).
- Footer button: "See today's plan" (planned) or "Go to Today" (unplanned) → `router.dismissTo('/(tabs)/today')`.
- Unplanned: "Today isn't planned yet" + "Plan today" → `router.replace({ pathname: '/plan/[dayKey]', params: { dayKey: todayKey } })`.
- `src/app/index.tsx` unchanged (due → `/morning`, else `/today`); now covered by tests.

### Future connections
- M8 onboarding hands over to the first real Morning on day 2 (first-ever use is never "due").
- M7 sunrise art and the other collection styles follow the palette; `SunriseCard` and `Collection` are the swap points.

### Decisions
- Back button: the cold-launch `<Redirect>` replaces `/`, so Morning can be the only route and a plain back would exit the app. A `BackHandler` `hardwareBackPress` listener calls `dismissTo('/(tabs)/today')` and returns true. `dismissTo` pops to an existing (tabs) entry, or replaces the current screen with it when none exists (same pattern as PlannedScreen, per AGENTS.md notes). It also applies when Morning was pushed by `useMorningRedirect`, where it pops to Today, which is what back would do anyway. (Based on the existing `dismissTo` usage and AGENTS.md; not re-verified against the web docs.)
- "Plan today" is hidden if today can no longer be planned (closed day) via `usePlannableDays`; "Go to Today" remains.
- Weekday is the header title; "Day N" is the header note, so the sunrise card's "Thursday · Day N" does not duplicate it as exact text.
- No changes to `src/state` or `src/ui`.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (one earlier warning in `TodayScreen.test.tsx`, chunk 3's file; gone/not shown on the final run).
- `timeout 900 npm test`: first full run had a failure in `TopicsScreen.test.tsx` (not touched here, passed in the next run — looks like load flake) and `CloseScreen.test.tsx` (chunk 3 file mid-edit, syntax error at the time). Targeted `MorningScreen.test.tsx`: 7/7.
- `timeout 900 npm run test:coverage`: 49 suites passed, 493 tests passed. `mobile/coverage` deleted.

### Known limitations + phone checks
- Not run on a device. The Android back-button path is tested through the `BackHandler` listener, not a real back press.
- Check 1 (overnight): finish a day, leave the app open or backgrounded overnight. Next morning, opening it should show Morning with the new weekday and Day N+1. Tap "See today's plan"/"Go to Today": Today appears, and no second Morning appears when you reopen it the same day.
- Check 2 (cold launch): kill the app after the night; open it. It should land on Morning, and pressing Android back should go to Today, not exit.
- Check 3: unplanned morning shows "Today isn't planned yet" and "Plan today" opens the plan screen; its back does not return to Morning. Planned morning drops one marble into the jar once.
- Check 4: no tab bar is visible on Morning.

## Check (Sonnet)

### Verdict: PASS

### ERRORS
None.

### Verified
1. Layering: route is `export default MorningScreen`; screen uses only state hooks/actions and ui; `useMorningRedirect` is mounted once in `_layout.tsx` RootStack and not called here. Placeholder replaced.
2. Content: weekday Header title via `weekdayName`, "Day N" note, Chain, SunriseCard, Collection `animateLast` (Jar `useDrop` keys on last item and a `played` ref, so a re-render does not replay). Unplanned shows "Today isn't planned yet" and "Plan today" (`router.replace` to `/plan/[dayKey]`, hidden if the day is not plannable). Footer label is "See today's plan" or "Go to Today", both calling `dismissTo('/(tabs)/today')`.
3. `markMorningSeen()` runs on mount and writes `morningShownFor` and bumps 'settings', so `due` goes false. `useMorningRedirect` only pushes on a false-to-true edge, and a second StrictMode run just rewrites the same value.
4. BackHandler: RN 0.88 `addEventListener` returns `{remove}`, and cleanup calls `sub.remove()`. The handler returns true. `POP_TO` in expo-router's StackRouter (build/react-navigation/routers/StackRouter.js:382-430): if `(tabs)` is not in the stack it builds the route and returns `activeRoutes.slice(0,currentIndex).concat(route)`, which replaces the current route. It does not no-op or exit, so cold-launch Morning (only route) and the button both reach Today. If `(tabs)` is already in the stack, it pops back to it.
5. `index.tsx`: `<Redirect>` is rendered only once `ready`, and `setDb` is called before that in the same render. `useMorning` is synchronous, so the redirect target is correct on first render and there is no Today-then-Morning flash.
6. Day N: `dayNumber` returns 1 when there is no earlier day or the first day is not before today. Morning is never due on day 1 anyway.
7. Tests assert real behaviour against a real DB: due flips false after mount, the redirect targets, the back handler returns true and calls dismissTo, the jar a11y label is "Jar with 1 marble", and the Plan today call arguments.

### Non-blocking notes
- Not tested: BackHandler subscription removal on unmount; marble not replaying on re-render (covered by Jar's own tests, if any); the "Plan today" hidden case.
- Test mocks `expo-router`, so the real POP_TO behaviour was verified by reading the source, not by running it.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: no errors or warnings.
- `npx jest MorningScreen useMorningRedirect src/state --runInBand`: 12 suites, 96 tests passed.
- `mobile/coverage`: not present (nothing to delete).
