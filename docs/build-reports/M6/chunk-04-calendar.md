# M6 · Chunk 4 · Calendar screen

## Build (Sonnet)

### Purpose
The Calendar tab: a month of days with mini jars and glow, month change by arrows or swipe, and a card for the selected day with a Plan/Edit action.

### Files
- `src/screens/CalendarScreen.tsx` (new); `src/app/(tabs)/calendar.tsx` is now a 3-line re-export.
- `src/ui/dayCardLine.ts` (edited): a past, unglowing day with tasks but 0 done reads "3 tasks planned." (or "3 tasks planned · 20m focused"). Today keeps "0 of n tasks".
- Tests: `src/screens/__tests__/CalendarScreen.test.tsx` (new, 6); `src/ui/__tests__/CalendarUi.test.tsx` (dayCardLine cases updated/added).

### Connections now
- CalendarScreen -> `usePlannableDays` (only for `todayKey`), `useCalendarMonth(month)`, `useDayCard(selected)`; ui `Header`, `MonthGrid`, `CalendarLegend`, `DayCard`, `dayCardLine`, `monthName`/`weekdayName`.
- Plan/Edit -> `router.push({ pathname: '/plan/[dayKey]', params: { dayKey } })`.
- Swipe: `usePanGesture` + `GestureDetector` over grid + legend (the app-root `GestureHandlerRootView` is used; none nested).

### Future connections
- M7 locale/looks: titles use the device locale via `Intl`; the card could link to a read-only day view (`/planned/[dayKey]`) for past days.

### Decisions
- Today comes from `usePlannableDays().todayKey` (cheap, re-renders on 'days' bumps, which `useDayBoundary` fires at the boundary). When it differs from the stored anchor, month and selection reset during render (no effect, no flash).
- Month header shows the year only when it is not today's year. Note is "Day N".
- Selection is kept when the month changes (the card may show a day outside the grid; blank cells still cannot be picked).
- Swipe: left <= -50 px = next, right >= 50 px = previous, `activeOffsetX` 20, `failOffsetY` 15 so vertical scroll still works; arrows and swipe share the `canPrev`/`canNext` guards. Arrows are 44 pt, `disabled` + `accessibilityState`.
- Swipe tested through gesture-handler's `createGestureController('calendar-swipe')` (testID on the gesture), so the real callback runs.
- Tests need an en-US-like device locale (titles use the default locale, like Today's `weekdayName`).

### Command outputs
- `npm run typecheck`: clean at the end (one earlier error was in another builder's `DayStartScreen.tsx`, since fixed).
- `npm run lint`: clean (earlier, `eslint src/screens` showed 5 warnings in others' DayStart/Profile tests only).
- `npx jest CalendarScreen CalendarUi`: 2 suites, 34 tests pass.
- `npm run test:coverage`: run 1: 55/56 suites, 593/594 (failure: `ProfileScreen › Try a look still switches the look`, another builder's file, 88 s under load); run 2: 56/56 suites, 594/594, All files 98.21% stmts / 98.38% branches / 96.7% funcs. `coverage/` deleted.

### Known limitations + phone checks
- Selection does not follow the month; swiping to September leaves the card on 29 Oct.
- A closed/past day has no "See" action yet.
- Phone checks: (1) Calendar shows this month, today ringed, glowing days pulse (still under Reduce Motion), legend under the grid. (2) Tap tomorrow: card "Friday, 30 October", "Plan it tonight..." and a Plan button opening the plan; after planning it says Edit. (3) Tap a later day: no button. (4) Swipe left/right on the grid changes the month; at the first/last month nothing happens and the matching arrow is dimmed; vertical scroll still works. (5) A past day with plans but none done reads "n tasks planned." (6) Leave the app open across the day boundary: month and selection jump to the new today. (7) TalkBack/VoiceOver: arrows say "Previous month"/"Next month" and announce disabled.

## Check (Sonnet)

**Verdict: FAIL** (one real defect; everything else matches the contract).

Ran: `npm run typecheck` clean; `npm run lint` clean; `jest CalendarScreen CalendarUi` 2 suites / 34 tests pass. No `coverage/` created.

### ERRORS
1. `src/ui/dayCardLine.ts:32` (and the matching test `src/ui/__tests__/CalendarUi.test.tsx:80`): the separator in "3 tasks planned · 20m focused" was written as a lone byte 0xB7 (Latin-1 middle dot), not the UTF-8 sequence C2 B7 used elsewhere (line 36). It is invalid UTF-8, so editors/Metro read it as U+FFFD and the phone shows "3 tasks planned � 20m focused". The test passes only because it contains the same corrupt byte. Expected: a real "·" in both files (as on line 36 and the prototype).

### NOTES
- Contract items verified OK: header month (locale, year only when not this year) + "Day N"; arrows 44pt, labels "Previous month"/"Next month", disabled by canPrev/canNext with accessibilityState; swipe via `usePanGesture`+`GestureDetector` (root GestureHandlerRootView in `_layout.tsx`, none nested), 50 px threshold, activeOffsetX 20 / failOffsetY 15, same canPrev/canNext guards; MonthGrid, CalendarLegend, DayCard title via weekdayName/monthName; Plan/Edit only when `card.canPlan`, `router.push({pathname:'/plan/[dayKey]', params:{dayKey}})`; reset to today during render when todayKey changes (tested across a day boundary). No `src/data`/`getDb` imports in the screen; no error paths needing `@/state/errors`.
- Re-render on data change: `useDayCard`/`useCalendarMonth` subscribe to 'days','sessions','settings' via `useDataVersion`, so planning tomorrow then returning shows "Edit" (the Edit test plans before render; the live update relies on the version bump, which the hooks' own tests cover).
- dayCardLine wording: past, 0 done, total>0, not glowing -> "n tasks planned." is guilt-free and correct; this also covers a past day that is planned but not closed (glows is false, so no false glow). Today still "0 of n". Partial past day reads "1 of 3 tasks" (acceptable, not guilt-laden).
- Selection not following the month: NOTE, not an error. The contract says a day outside the shown month cannot be *selected* (blank cells); that holds, since no tap path can pick one. Keeping a prior selection when the month changes is not a selection of an out-of-month cell, but it is mildly confusing: the card describes a day not in the grid, no cell is highlighted, and a Plan/Edit button may show for a day not visible. Suggest (non-blocking) clearing/following the selection on month change (e.g. select the 1st, or today when returning to the current month). Builder documented it honestly.
- Tests are meaningful (real swipe callback through gesture controller, limits, arrow disabled state, push params, day-boundary reset). Style matches the codebase.

## Fix (Opus)

### Root cause
1. The "·" separator on `src/ui/dayCardLine.ts:32` and `src/ui/__tests__/CalendarUi.test.tsx:80` had been written as a lone Latin-1 byte 0xB7 instead of UTF-8 `C2 B7`, so the files were invalid UTF-8 (the phone would show U+FFFD). The test passed only because it held the same bad byte.
2. `go()` in `CalendarScreen` changed only `month`, so the selection stayed on a day of another month (see Check NOTE).

### Changes
- Both bad bytes replaced with a real "·" (C2 B7). Repo scan of `src/` and `docs/build-reports/M6/` with a Node `TextDecoder('utf-8', { fatal: true })` script: only those two files were invalid; re-scan after the fix finds none.
- `src/screens/CalendarScreen.tsx`: `go(n)` now also sets `selected` to today when the new month is today's month, otherwise to `${month}-01`. Arrows and swipe both go through `go`, behind the same `canPrev`/`canNext` guards.
- `contract.md` chunk 4: added an "Amended by fix" line for the selection rule.
- Build "Decisions" line 24 and "Known limitations" line 36 (selection kept on month change) are superseded by this fix.

### Tests
- `CalendarScreen.test.tsx` +2: arrows (select 31 Oct -> prev -> card "Tuesday, 1 September", 31 Oct gone -> next -> "Thursday, 29 October") and swipe (select 30 Oct -> swipe right -> "Tuesday, 1 September", no Plan button; swipe at first month keeps it; swipe left -> "Thursday, 29 October" with Plan).
- `CalendarUi.test.tsx`: the "3 tasks planned · 20m focused" case now compares against a valid UTF-8 "·".

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `timeout 900 npx jest src/screens/__tests__/CalendarScreen.test.tsx src/ui/__tests__/CalendarUi.test.tsx`: 2 suites, 36 tests pass (14.9 s).
- No `coverage/` created. Profile/DayStart files not touched.

## Re-check (Sonnet)

**Verdict: PASS**

ERRORS: none.

Verified:
1. Strict UTF-8 scan (`TextDecoder` fatal) of src/ and docs/build-reports/M6: 203 files, 0 invalid. "·" in dayCardLine.ts and CalendarUi.test.tsx is C2 B7 (U+00B7).
2. `go()` sets selection to today if the shown month contains today, else `${month}-01`; arrows and swipe both go through it behind the canPrev/canNext guards. The day-boundary reset is a separate render-time branch and does not conflict. Plan/Edit still only when `card.canPlan`.
- typecheck clean, lint clean, jest 2 suites / 36 tests pass. No coverage/ created.

NOTES:
- `go` is called with stale-`today` risk only for one render at a day boundary; the reset branch corrects it. Not a defect.
