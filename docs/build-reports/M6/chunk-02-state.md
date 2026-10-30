# M6 · Chunk 2 · Calendar + Profile state

## Build (Sonnet)

### Purpose
Pure month maths and three read-only hooks that feed the Calendar and Profile screens.

### Files
- `src/domain/types.ts` — added `MonthKey` ('YYYY-MM').
- `src/domain/calendar.ts` — added `monthKeyOf`, `addMonths`, `monthGrid`.
- `src/state/hooks/useCalendarMonth.ts` — `useCalendarMonth(month)`, types `CalendarCell`, `CalendarMonth`.
- `src/state/hooks/useDayCard.ts` — `useDayCard(dayKey)`, type `DayCard`.
- `src/state/hooks/useProfileStats.ts` — `useProfileStats()`, type `ProfileStats`.
- Tests: `src/domain/__tests__/monthGrid.test.ts`, `src/state/__tests__/calendarHooks.test.ts`.

### Connections now
- Hooks -> `todayKey(db, now())` (chunk 1) -> repos `listDays` / `loadDayBundle` / `getDay` -> domain `glows`, `collectionItems`, `plannableDays`, `focusedMs`/`overtimeMs`, `dayNumber`/`daysShowedUp`/`focusedHours`/`marbles`.
- All three re-read on `useDataVersion(['days','sessions','settings'])`.
- `CalendarCell` is assignable to `MonthGridCell`; `DayCard` is assignable to `DayCardLineInput` (both checked in the tests by typed assignment).

### Future connections
- Chunk 4 CalendarScreen: `useCalendarMonth(month)` + `monthKeyOf(todayKey)`/`addMonths` for arrows and swipe; `useDayCard(selected)` with `dayCardLine`; reset month and selection when `todayKey` changes; action from `canPlan` + `planned`.
- Chunk 5 ProfileScreen: `useProfileStats()` into `StatTiles` (format `focusedHours` with `formatMinutes`).

### Decisions
- No new repo functions: `listDays(db, '0000-01-01', '9999-12-31')` gives every row, `loadDayBundle` is called only for keys that exist (a month never loads its blank days).
- `CalendarCell` for a day with no row: no items, no glow, not closed (flags today/tomorrow/future still set).
- `canPrev` = month > month of the first days row (today's month when there are no rows); `canNext` = month < month of tomorrow (so it opens on the last day of a month).
- `useDayCard` for a day with no row returns zeros, `planned: false`; `canPlan` comes from `plannableDays(todayKey, getDay(todayKey))` (open today and tomorrow; only tomorrow once today is closed).
- `kind`: `past` < today, `tomorrow` = today+1, everything later is `later`.
- `focusedHours` is unrounded hours (per `stats.ts`); the UI formats.
- `monthGrid` derives month length from `addDays(nextMonth-01, -1)` and the lead blanks from `weekdayIndex`, so it reuses the validated dayKey code.
- Hook tests use the real actions (seed, toggle, start/stop, `closeToday`) instead of raw inserts.
- Chunk 1 files were not edited.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npx jest` on my two suites: 2 passed, 30 tests.
- `npm run test:coverage`: 53 suites, 569 tests, all pass. All files 98.37% stmts / 98.65% branches / 96.68% funcs. `domain/calendar.ts` 100% across the board. `coverage/` deleted.

### Known limitations + phone checks
- Each hook reads every days row (cheap at this scale; if a user reaches thousands of rows, `useProfileStats` could move to an SQL aggregate).
- Hooks compute `now()` when the memo runs, so an open Calendar shows live values only after a data bump or day change (chunk 4 must re-render on the day boundary via `todayKey` in its state).
- Phone checks (after UI chunks): glowing day shows the halo; closed day shows the lid; arrows disable at the first and last allowed months; "Plan" appears for today and tomorrow only; Profile numbers match what the Collection shows.

## Check (Sonnet)

**Verdict: PASS**

Ran: `npm run typecheck` clean; `npm run lint` clean; the two suites 2 passed / 30 tests; no `coverage/` dir existed.

### ERRORS
None.

### Verified
- `monthKeyOf`/`addMonths`/`monthGrid` match the contract: Mon-first via `weekdayIndex`, 4-6 rows (Feb 2027 gives 4, Mar 2026 gives 6), null padding, negative and year-crossing month maths correct.
- `useCalendarMonth` returns every contract field. Glow comes from the domain `glows(bundle, todayKey)`, `closed` from `closedAt`, items from `collectionItems`. A day with no row has no items, no glow and is not closed. `isToday`/`isTomorrow`/`isFuture` are correct. `canPrev` is judged from the first `listDays` row (ascending order, so index 0 is the earliest), falling back to today. `canNext` is judged from tomorrow's month. `dayNumber` uses the shared `dayNumber`.
- `useDayCard`: `kind` is correct. `canPlan` is `plannableDays(todayKey, getDay(today))`, the same as `usePlannableDays`, so ADR-009 holds (a closed today leaves only tomorrow). `done`/`total`/`focusedMs`/`extraMs` are computed with the same loop as `useCloseSummary` (overtime only for timed tasks, summed per task), so the two agree. A day with no row returns zeros.
- `useProfileStats` uses the existing domain `daysShowedUp`/`focusedHours`/`marbles`/`dayNumber` over all rows.
- Performance: `loadDayBundle` is called only for days that have a row, and only for the month (Calendar) or once per row (Profile, as documented). No per-cell repeat queries. The `listDays` call is cheap.
- Invalidation: `['days','sessions','settings']` covers all three hooks. Task renames and topic colours are not needed by these outputs.
- Layering: the hooks use repos and domain only; they take `todayKey` from `state/today`.

### NOTES
1. The hooks do not put `todayKey` in the memo deps (unlike `usePlannableDays`). Across a day boundary with no data bump, they stay stale until the next bump or remount. The builder already flagged this. Chunk 4 must re-render on day change. `useDayBoundary` or reconcile probably bumps 'days' anyway.
2. Test gaps (minor): no case for an unclosed past day that glows because it is past; the Profile test has only one day, so it does not show summing across days; no check that `extraMs` ignores check tasks.
3. `monthGrid` test row/day cases are good; the Monday-first layout is asserted indirectly (Oct 2026 begins on a Thursday, Mar 2026 on a Sunday).
