# M10 chunk 1 · Streak data

**What it is for:** the streak moment's stair needs one step per real day with that day's weekday letter. The moment
already carries `days` and `endDayKey`; this chunk adds `streakWeekdays(m)` (domain, pure) and proves with the app's
own actions that the streak moment is the user's real run.

**Connections now:** `src/domain/moments.ts` (`STREAK_MAX_STEPS = 21`, `streakWeekdays`, uses `weekdayIndex`).
Reads nothing new from the db; the run still comes from `computeMomentsAfterClose` (`itemCountByDay` via
`collectionItems`).
**Future connections:** chunk 2 (`Streak.tsx` turns the weekdays into `WEEK_LETTERS` labels, `streakDraw` draws
`min(days, 21)` steps).

## Build (Sonnet)
- `streakWeekdays`: length `min(days, 21)`, oldest first, last = `weekdayIndex(endDayKey)`.
- Domain tests: 0, 1, 7, 14, 21 (full array), 28 (capped; first entry is endDayKey - 20), every end weekday.
- `src/state/__tests__/streakData.test.ts` (new), real actions across the 2026-11-01 DST change:
  1. Mon 10-26 .. Sun 11-01, one item a day (Tue, Thu, Sat checklist-only; Sat auto-closed at Sun 04:00 local):
     only Sunday plays, `{ days: 7, endDayKey: '2026-11-01' }`, weekdays `[0..6]`, markers 7 / 11-01.
  2. Day 6 closed: nothing, markers unchanged. Thu opened but empty and Fri not opened break the run; it restarts
     Sat 10-31 and plays 7 on Fri 11-06, weekdays `[5,6,0,1,2,3,4]` (unbroken would be 10, not a multiple of 7).
  3. Recomputing Sunday's moments after its close plays nothing (`closeToday` throws on a closed day, so a second
     hand close cannot happen).
  4. Sun 11-08 plays 14, weekdays `[0..6, 0..6]`.

## Check A (code and contract, Sonnet): PASS
Nits applied: full 21-day array, days 0 and 1, day-6 markers fully unchanged.

## Check B (data audit, Sonnet): PASS with warnings
Recomputed every case by hand (table in the run log): all match. Also passed with `TZ=America/New_York` and
`TZ=Asia/Kolkata`. Traced real-usage gaps: a session running at close counts only if it completes the task; forwarded
and let-go tasks never make a day count by themselves; a day with only the confirmed plan counts (same as `chain`).
Applied: the 28-day first-entry assertion; the DST comment now says local time (jest does not pin TZ).
Noted for chunk 2: the copy must not claim "tasks every day"; the existing detail "NO DAY MISSED" is accurate.

## Lead verification
tsc clean, lint clean, `Test Suites: 98 passed, 98 total`, `Tests: 1213 passed, 1213 total`. No temp files.
