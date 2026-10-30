# M3 · Chunk 5 · Planned screen + entry points

## Build (Sonnet)

### Purpose
Show a confirmed day's plan (jar with the planning marble dropping in, task list, total) and give the Today tab
temporary entry points into planning, so M3 is usable end to end before M4/M5.

### Files
- `mobile/src/app/planned/[dayKey].tsx` (thin, default-exports `PlannedRoute`).
- `mobile/src/screens/PlannedScreen.tsx` (`PlannedRoute`, `PlannedScreen`, internal `PlannedBody`).
- `mobile/src/app/(tabs)/today.tsx` (edited: entry points added above the M0 demo; comment marks it temporary, replaced in M4).
- `mobile/src/screens/__tests__/PlannedScreen.test.tsx` (8 tests: Planned screen and Today entry points).
- No change to `src/state` or `src/ui`.

### Connections now
- Reads `useDayPlan(dayKey)` (rows + jar items), `usePlannableDays()` (Edit / Plan it gating), `getTopic` for the topic name (re-renders on the `topics` data version), `weekdayName`, `Collection`, `Button`, `Card`, `Screen`, `Header`, `T`.
- Navigates with typed routes: Edit / Plan it / Plan today / Plan tomorrow -> `router.push({ pathname: '/plan/[dayKey]', params })`; See -> `/planned/[dayKey]`; Done and Back -> `router.replace('/(tabs)/today')`.
- Planned has no tab bar (root stack screen, `Screen` without `tabs`); Done/Edit sit in the pinned footer.

### Future connections
- M4 replaces the Today body but keeps the entry points (Plan tomorrow, Plan today while plannable, "Tomorrow is planned · n tasks" + See/Edit).
- M5 Close day -> Plan tomorrow -> Planned (Done returns to Today).

### Decisions
- Title: "Today is planned" when `dayKey === todayKey`, else the weekday ("Friday is planned"). No-plan: "Nothing planned for <Friday> yet" + "Plan it" (only if plannable) + "Back to Today".
- Edit is shown only if the day is in `usePlannableDays().days` (tomorrow always; today only while unplanned, so an already-planned today has no Edit).
- Invalid dayKey -> "Not a day" with a back button (no crash).
- Jar: `Collection` at scale 2.3, `closed={false}`, `animateLast`. Jar's own drop effect is keyed on the newest item's identity, so re-renders do not replay it; it plays once per mount (visit).
- Row time label: "45 min" for timed rows, "checklist" for check rows; "<topic> · from Thursday" for forwarded rows. Total = sum of timed budgets ("3 tasks · 1h 15m"; checklists add no minutes).
- Jar label under test is "Jar with 1 marble": the jar shows the planning marble, not one per task.
- Today: "Plan tomorrow" is primary unless tomorrow is already planned (then ghost). 

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean (typed routes include `/plan/[dayKey]` now that chunk 4's file exists).
- `npm run lint`: no output/warnings.
- `npm test`: Test Suites 36 passed; Tests 366 passed.
- `npm run test:coverage`: same counts, All files 98.29 / 98.32 / 96.59 / 98.29, gate held. `mobile/coverage` deleted.
- Note: during the run chunk 4's `plan/[dayKey].tsx` / PlanScreen existed; no errors were seen from them, none ignored.

### Known limitations and phone checks
- Tests mock motion (`reduce: true`), so the drop animation is not exercised in Jest.
- Phone checks:
  1. Confirm tomorrow's plan: Planned opens and the marble drops into the jar once; navigate away and back, it drops once per visit; a data refresh while on screen must not replay it.
  2. Watch for the carried one-frame flash of the new marble at rest before the drop (Jar shared value starts at 0). Fix if seen: start at -distance or `useLayoutEffect` (in Jar, a chunk 3 file).
  3. "Done" lands on the Today tab (tab bar visible), not back into the plan flow; Back on Android does the expected thing.
  4. Planned for an already-planned today has no Edit; tomorrow shows Edit and it reopens the plan with saved choices.
  5. Today shows Plan today only while today is unplanned; after confirming tomorrow it shows "Tomorrow is planned · n tasks" with See and Edit.
  6. Reduce Motion on: marble appears with no drop. All buttons are comfortably tappable (min height 48).
- The Today placeholder still shows the M0 chain/topic demo cards beneath the entry points (temporary).
- With 41+ items the newest marble is hidden in the jar (carried, chunk 3).

## Check (Sonnet)

**Verdict: FAIL** (one layering defect; everything else passes)

### ERRORS
1. `mobile/src/screens/PlannedScreen.tsx:4,7,47,92` - Layering violation. Expected: screens never import `@/data` or `getDb` (M2 contract). Actual: imports `getTopic` from `@/data/repos/topics` and `getDb` from `@/state/dbRef`, and calls `getTopic(getDb(), r.topicId)` per row in render. Proof: `grep -n "@/data\|getDb" src/screens/PlannedScreen.tsx`. Also redundant: `useDayPlan` rows already carry `colorKey`/`name`. Fix: delete the two imports, `db`, and the `useDataVersion(['topics'])` call; use the new `usePlanTopics()` hook (`@/state/hooks/usePlanTopics`, exists now), build `const topicName = useMemo(() => new Map(topics.map(x => [x.id, x.name])), [topics])` and render `topicName.get(r.topicId) ?? 'Topic'`. (today.tsx is clean: no `@/data`/`getDb`.)

### Non-blocking notes
- Back stack: `router.replace('/(tabs)/today')` from Planned (Done / Back to Today) replaces the Planned entry with a second `(tabs)` instance on top of the initial `(tabs)`; Android back from Today may then go to the older `(tabs)` instead of exiting. Likewise Plan -> `replace` Planned after Edit-from-Planned leaves a stale earlier Planned under the new one (back from the new Planned shows the old Planned; Plan itself is correctly gone). Consider `router.dismissTo('/(tabs)/today')` for Done. Not verifiable without a device; add to phone checks.
- Marble drop: Jar effect is keyed on newest item identity, so no replay on re-render; it replays on each new mount (including the stale-Planned case above). Acceptable "once per visit". Not covered by Jest (motion mocked).
- Jar label "Jar with 1 marble" correct per doc 04 section 7.
- Today: entry points per contract (Plan today only when plannable, "Tomorrow is planned · n tasks" + See/Edit, reacts via useDayPlan), temporary comment present. M0 demo cards ("Your tasks will live here", "Planning comes first: milestone M3") remain and say "nothing planned yet" even when today is planned; mildly confusing, M4 replaces.
- Tests: assert real behaviour (title, rows, forwarded label, total, Edit gating, routes, invalid key). Test 2 of "Today entry points" is titled "...and shows tomorrow planned with See/Edit" but only asserts absence; rename. No test for no-replay of the marble.
- Planned for a planned today lacks Edit correctly; invalid key and no-plan states OK.

### Command outputs (from mobile/)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest PlannedScreen + src/state + src/ui/__tests__`: 17 suites, 122 tests passed.
- `npx expo export --platform android`: succeeded (5.3MB hbc); export dir and mobile/coverage deleted.

## Fix (Opus)

### Errors fixed
1. **Layering (checker ERROR 1).** `PlannedScreen.tsx` imported `getTopic` (`@/data/repos/topics`) and `getDb` (`@/state/dbRef`) and queried the db once per row in render.
   - Root cause: the screen was written before chunk 4's `usePlanTopics` hook existed, so it reached for the repo directly.
2. **Back stack (lead promoted from the checker's notes; you can see it on Android).**
   - (a) Done / Back to Today used `router.replace('/(tabs)/today')`. That swaps Planned for a second `(tabs)` route in the root stack, so Android back from Today went to the old `(tabs)` instead of leaving the app.
   - (b) Planned "Edit" used `router.push` to Plan, and Plan's confirm `replace`s itself with a new Planned. The old Planned stayed underneath, so Back from the new Planned showed the stale one.

### API verification (expo-router 58.0.27, from node_modules)
- `build/global-state/router.d.ts:58`: `dismissTo(href, options?)`: "Dismisses screens until the provided href is reached. If the href is not found, it will instead replace the current screen with the provided `href`."
- `build/global-state/router.js:198`: `dismissTo` dispatches the `POP_TO` event.
- `build/react-navigation/routers/StackRouter.js` (case `'POP_TO'`): it searches the active routes backwards for a route with that name and pops to it. If none is found, it replaces the current route.
- `build/global-state/resolveNavigationDestination.js:142`: navigators below the POP_TO target get NAVIGATE with `pop`. So the nested Tabs navigator switches to the `today` tab, and no new tabs instance is created.
- `router.replace` dispatches `REPLACE` (`router.js:204`).

### Changes
- `mobile/src/screens/PlannedScreen.tsx`
  - :1-9: removed the `getTopic`, `getDb` and `useDataVersion` imports. Added `useMemo` and `usePlanTopics`.
  - :27: `REMOVED_TOPIC = 'Removed topic'`, the same label `PlanScreen` uses.
  - :31: `goToday = () => router.dismissTo('/(tabs)/today')`. It is used by Done, by Back to Today in the no-plan state, and by Back to Today in the "Not a day" state.
  - :34: `replaceWithPlan(dayKey)` calls `router.replace({ pathname: '/plan/[dayKey]', params })`.
  - :53-54: `usePlanTopics()` plus a memoized `Map` of id to `{name, colorKey}`.
  - :63: "Plan it" (no-plan state) also uses `replaceWithPlan`. It had the same duplicate-Planned bug: Planned(no plan) -> push Plan -> confirm replaces Plan with Planned, leaving Planned(no plan) underneath.
  - :76: Edit uses `replaceWithPlan`.
  - :86-97: each row looks up its topic in the map. The dot colour is the live `colorKey`, or the row's snapshot `colorKey` if the topic is missing. The name is the live topic name, or "Removed topic" if missing. `usePlanTopics` lists only topics that are not deleted, so every miss means the topic was removed.
- `mobile/src/screens/__tests__/PlannedScreen.test.tsx`
  - The `expo-router` mock now includes `dismissTo`.
  - `plan()` returns the topic id.
  - First test: Edit calls `replace` exactly once with the plan route and `push` is never called; Done calls `dismissTo('/(tabs)/today')` exactly once and `replace` is not called again.
  - New test (:94): rename the topic and the rows show "Maths"; remove the topic (inside `act`) and the mounted screen shows "Removed topic · from Thursday" with no "Maths" left. The old code would fail this: `getTopic` still returns the soft-deleted row with its old name.
  - No-plan test: Plan it calls `replace`; Back to Today calls `dismissTo` once.
  - Bad-key test: Back to Today calls `dismissTo`.
  - Today test renamed to "hides Plan today once today is planned, with no tomorrow card while tomorrow is unplanned" (it only asserts that things are absent).
  - "Tomorrow is planned" test: now also asserts that the See and Edit buttons are present before pressing them.
- `src/app/(tabs)/today.tsx`: unchanged. It was already clean (no `@/data`/`getDb`). Its pushes to Plan/Planned are correct, because Today is the base of the stack.
- Not touched: PlanScreen, PlanRow, usePlanTopics, useTaskNote.

### Command outputs (from `mobile/`)
- `grep -n "@/data\|getDb" src/screens/PlannedScreen.tsx`: no matches (exit 1).
- `npm run typecheck`: clean.
- `npm run lint`: clean (no output).
- `npx jest src/screens src/state src/ui/__tests__`: 19 suites, 142 tests passed.
- `npm test`: 37 suites, 373 tests passed.
- `npx expo export --platform android --output-dir <scratchpad>/m3c5-fix-export`: succeeded (android entry hbc 5.3MB). The export dir was deleted, and `mobile/coverage` is absent/deleted.

### Downstream
- M4: the real Today screen keeps these entry points: Plan today (while plannable), Plan tomorrow, and "Tomorrow is planned · n tasks" with See/Edit. From Today (the base of the stack), keep using `push` to Plan and Planned. Any "return to Today" from a stacked screen should use `router.dismissTo('/(tabs)/today')`, never `replace`.
- M5: in the Close day -> Plan tomorrow flow, Plan's confirm already replaces Plan with Planned, and Planned's Done uses `dismissTo`. If Close is its own stacked screen, open Plan from it with `replace` (or pop Close first). Otherwise Close stays under Planned and Back revisits it. Never `replace` to `/(tabs)/...`.

### Phone check: Android back button (needs a device)
1. Cold start the app (lands on Today). Press Plan tomorrow, confirm, and Planned opens. Press system Back once: you are on Today with the tab bar. Press Back again: the app exits (goes to the launcher). It must not show Today a second time or reopen Planned.
2. Cold start. Plan tomorrow -> confirm -> Planned -> **Done**. You are on Today. Press system Back once: the app exits.
3. Cold start. Today -> See (tomorrow planned) -> Edit (Plan opens) -> confirm -> Planned. Press system Back once: Today (not an older Planned, not Plan). Press Back again: the app exits.
4. Repeat check 3 but press Back on Plan without confirming: you land on Today, because Plan replaced Planned. This is expected.
5. Switch to the Topics tab, then open Planned (if reachable) or run check 2 from there. Done shows the Today tab focused. Back then follows the tabs' back behaviour (Today first, then exit), and no duplicate tab bar or instance appears.
6. Remove a topic that is in tomorrow's plan (Topics tab), then open Planned. Its rows say "Removed topic" with the original colour dot.

## Re-check (Sonnet)

**Verdict: PASS** (no remaining errors)

### Verified
1. Layering: `grep "@/data\|getDb"` over src/screens and src/app (excluding __tests__ and _layout.tsx): no matches. PlannedScreen uses `usePlanTopics` + memoized Map; a missing topic renders "Removed topic" with the row's snapshot `colorKey` (`PlannedScreen.tsx:87-97`). Test at :94 covers rename and removal (mounted, inside `act`).
2. `router.dismissTo` (expo-router 58.0.27, node_modules): `router.js:198` dispatches `POP_TO`. `StackRouter.js` `case 'POP_TO'` (:382-): scans `activeRoutes` backwards from the current index for a route named `(tabs)`; if found it keeps `activeRoutes.slice(0, index)` plus that route (no new route), applying the nested state via `attachRouteState`. `resolveNavigationDestination.js:142-143` sends NAVIGATE with `pop` to the nested Tabs, so the today tab is focused without a new instance. Only if no `(tabs)` exists does it replace the current route. Root stack is `[(tabs)]` (index.tsx Redirects to /today, replacing index) then pushed plan/planned. Planned reached from Today tab (push): stack [(tabs), planned] -> pops to [(tabs)]. Via Plan (Today -> Plan -> replace Planned): [(tabs), planned] -> same. Via Edit then confirm: [(tabs), plan] -> replace -> [(tabs), planned] -> Done -> [(tabs)]. No duplicates.
3. Edit and "Plan it" call `router.replace` (REPLACE) to Plan; PlanScreen confirm `replace`s to Planned (PlanScreen.tsx:143); so there is never more than one Planned/Plan in the stack. Today's See/Edit use `push` (Today is the base) - correct. Test asserts replace x1, push never called.
4. Tests are meaningful: assert dismissTo with exact href (Done, no-plan Back, bad key), replace payloads, Removed-topic/rename behaviour, Edit gating. Residual (non-blocking): no device check of Android back; keep the phone checks listed in Fix section.
5. grep (item 1): none found.
6. Commands (from mobile/): `npm run typecheck` clean; `npm run lint` clean (no output); `npm test`: Test Suites 37 passed, Tests 373 passed. `mobile/coverage` deleted (absent).

## Fix (Opus) · user-reported: today's plan not shown

### Report
"I have planned today, but it's not showing the things I planned on Today's page."

### Root cause
`src/app/(tabs)/today.tsx` was the M0 placeholder with only the M3 entry points added. It read tomorrow's plan but never today's. Once today was planned, `usePlannableDays` dropped today, so "Plan today" disappeared and nothing replaced it. The header was hard-coded to "nothing planned yet". The M0 demo cards ("Your tasks will live here", "Planning comes first: milestone M3") and a fake demo Chain stayed on screen, which made it look as if the plan had been lost.

### Changes
- `mobile/src/ui/PlannedList.tsx` (new): a presentational list taken from `PlannedScreen`. It renders a card of rows (topic dot, task name, topic name, " · from <weekday>" for forwarded rows, "N min" or "checklist"), then the total "n tasks · Xh Ym". Props: `rows: DayTask[]` and `topics: Topic[]`. It imports nothing from state or data. `REMOVED_TOPIC` now lives here.
- `mobile/src/screens/PlannedScreen.tsx:13,73`: renders `<PlannedList rows={rows} topics={topics} />` in place of the inline card and total. Removed the imports and locals it no longer uses (`useMemo`, `useTheme`, `Card`, `formatMinutes`, `topicById`, `totalSec`, `count`). Behaviour is unchanged, and its 6 tests are untouched and pass.
- `mobile/src/app/(tabs)/today.tsx` (still a thin TEMPORARY screen, comment updated at :17-20):
  - :23-25: added `usePlanTopics()` and `useDayPlan(todayKey)`. `todayPlanned` means `planConfirmedAt != null`.
  - :35: the header note says "n tasks planned" when today is planned, and "nothing planned yet" only when it isn't.
  - :38-49: when today is planned, a card shows "Today is planned · n tasks" and "Starting tasks arrives in the next update.", with a See button (label "See", a11y label "See today's plan"). See pushes `/planned/[todayKey]`; Today is the base of the stack, so `push` is correct. Below the card, `PlannedList` shows today's rows. There is no Edit for today, which is the same rule `PlannedScreen` uses.
  - Plan today (only while plannable), the tomorrow card (See/Edit) and Plan tomorrow are unchanged.
  - Removed the M0 demo topic cards and the fake `Chain`. The real chain arrives in M5; `ui/Chain.tsx` stays for it.
- Layering: the route uses only state hooks (`useDayPlan`, `usePlannableDays`, `usePlanTopics`) and ui. No `@/data`, no `getDb`.

### Tests (`mobile/src/screens/__tests__/PlannedScreen.test.tsx`, "Today entry points")
Setup is the existing `setupState(NOW)` (test db + `setDb` + clock), and plans are made with `confirmDayPlan` through `plan()`.
- :143 (unplanned, extended): "nothing planned yet" is shown. No "Today is planned", no "Your tasks will live here". Plan today and Plan tomorrow push the right routes (as before).
- :162 (new): with today planned, the screen shows "Today is planned · 3 tasks", the header note "3 tasks planned", "Starting tasks arrives…", the rows Read, Notes and Past, "45 min", "checklist", "Study · from Thursday" and "3 tasks · 1h 15m". It does not show Plan today, Edit, "nothing planned yet" or the M0 demo text. See today's plan pushes `/planned/[dayKey]` with TODAY, and Plan tomorrow is still there.
- :186 (new): a mounted Today updates when today is planned (inside `act`).
- The existing tests at :155 and :197 and all PlannedScreen tests are unchanged and pass.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean.
- `npm run lint`: clean (no output).
- `npm test`: Test Suites 37 passed; Tests 375 passed (up from 373, with 2 new).
- `grep -rnE "@/data|getDb" src/app src/screens src/ui` (excluding `__tests__` and `_layout.tsx`): no matches (exit 1).
- `mobile/coverage`: deleted (absent).

### Downstream
- M4 replaces this placeholder with the real Today: topic folds with TaskRow/CheckRow, Run, Close, and "Today · n of m done". It keeps the entry points: Plan today (while plannable), Plan tomorrow, and "Tomorrow is planned · See / Edit". `PlannedList` stays shared by Planned, and the temporary today list and "Starting tasks arrives…" line go away.
- Phone check: plan today, then return to Today. The card, list and header count appear, and "Plan today" is gone.

## Re-check (Sonnet) · user-reported fix

**Verdict: PASS** (no remaining errors)

### Verified
1. Today shows "Today is planned · n tasks", PlannedList rows and total, header "n tasks planned" (today.tsx; test :162). Grep for "Your tasks will live here", "Planning comes first", fake Chain: only absence assertions in tests; no Chain in today.tsx.
2. Plan today only when `days.includes(todayKey)`; tomorrow card (See/Edit) and Plan tomorrow unchanged; See uses `router.push` to `/planned/[dayKey]` with todayKey; no Edit for today (asserted).
3. PlannedList.tsx is presentational (imports only domain types, theme, ui; no state/data). PlannedScreen tests unchanged and pass.
4. Mounted re-render test at :186 (plan inside `act`).
5. A11y labels distinct: "See today's plan" vs tomorrow "See".
6. Layering grep over src/app, src/screens, src/ui (excl. __tests__, _layout.tsx): no matches.
7. Commands (mobile/): typecheck clean; lint clean; npm test: 37 suites, 375 tests passed. mobile/coverage absent.
Residual (non-blocking): phone check of the on-device flow.
