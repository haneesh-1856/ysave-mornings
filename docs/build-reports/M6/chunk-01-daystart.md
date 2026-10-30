# M6 · Chunk 1 · Day-start change

## Build (Sonnet)

### Purpose
Changing "my day starts" never moves today. Each day ends at its own snapshotted hour; rows after today take the new
hour; rows created later snapshot it. One function (`todayKey`) now answers "what is today" everywhere in the state layer.

### Files
- `src/domain/dayKey.ts` — `currentDayKey(now, settingHour, snapshotOf)` (the contract's 3-case rule).
- `src/domain/rollover.ts` — `rollover()` takes `todayKey` as input (the `now` input is gone: it was only used to derive today); `dayStartHour` stays for the new row's snapshot.
- `src/data/repos/days.ts` — `setFutureDayStartHour(db, afterKey, hour, now)` (validates 0-23, rows with dayKey > afterKey, bumps updatedAt).
- `src/state/today.ts` (new) — `todayKey(db, at)`, `todayEnd(db, at)`.
- `src/state/actions/settings.ts` (new) — `setDayStart(hour)`.
- `src/state/hooks/useDayStart.ts` (new) — `useDayStart()` -> `{ hour, todayEndsAt }`.
- Switched to `todayKey(db, at)`: `actions/close.ts`, `actions/plan.ts`, `actions/reconcile.ts`, `actions/run.ts`, `hooks/useChain.ts`, `useCloseSummary.ts`, `useMorning.ts` (incl. `markMorningSeen`), `usePlanDraft.ts`, `usePlannableDays.ts`, `useToday.ts`, `useTopicsLibrary.ts`, `useDayBoundary.ts` (arms to `todayEnd`, fire check compares `todayKey`).
- Tests: `src/domain/__tests__/dayKey.test.ts` (+8 `currentDayKey`), `src/domain/__tests__/rollover.test.ts` (helper derives `todayKey`; +1 test), `src/data/__tests__/days.test.ts` (+3), `src/data/__tests__/ops.test.ts` (passes `todayKey`), `src/state/__tests__/dayStart.test.ts` (new, 7).
- `src/screens` has no `dayKeyOf`/`getDayStartHour`; nothing to change there.

### Connections now
- Every state action/hook -> `state/today.todayKey` -> `domain/dayKey.currentDayKey` + `data/repos` (`getDayStartHour`, `getDay(...).dayStartHour`).
- `setDayStart` -> `reconcile()` -> `setDayStartHour` -> `setFutureDayStartHour(todayKey)` -> `bump('settings','days')`.
- `useDayBoundary` -> `todayEnd` (timer) and `todayKey` (fire check).
- `reconcile` -> `rollover({ todayKey, dayStartHour, ... })`.

### Future connections
- Chunk 2 hooks (`useCalendarMonth`, `useDayCard`, `useProfileStats`) take today from `todayKey`.
- Chunk 5 `DayStartScreen`: `HourPicker.onChange` -> `setDayStart`; explanation uses `useDayStart().todayEndsAt` ("Today still ends at 4:00 AM. From tomorrow, each day ends at 6:00 AM.").

### Decisions
- Files with a local `todayKey` variable import the function as `resolveTodayKey` (close, plan, reconcile, useChain, useCloseSummary, useMorning, usePlanDraft, usePlannableDays, useToday) to avoid shadowing; other files use `todayKey` directly.
- `rollover` lost its `now` input (unused after the change; lint flagged it). Rollover tests keep a test-only `now` in the `input()` helper that derives `todayKey` with `dayKeyOf`.
- `setDayStart` validates before `reconcile()` so a bad value does nothing. Same hour re-selected is harmless (rewrites the same values).
- `useDayStart` memoises on `['settings','days']`; `todayEndsAt` is read at memo time (a new day bumps 'days' via `useDayBoundary`).
- Some files in the repo have mixed CRLF/LF endings; I edited in place and did not normalise.

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean (no warnings).
- `timeout 580 npm run test:coverage`: 51 suites, 539 tests, all passed. All files 98.31% statements / 98.65% branches / 96.62% functions. `dayKey.ts`, `rollover.ts`, `days.ts` 100%. `coverage/` deleted.

### Known limitations + phone checks
- Not covered by a test: the real device timer firing at the OLD hour after a change (logic covered through `todayEnd`/`todayKey`, the timer itself by the existing M5 fake-timer tests).
- Phone checks: (1) in the evening change the hour 4 -> 6; Today keeps showing today. (2) Leave the app open past the old 4:00 AM; Today rolls over at 4, not 6. (3) Next day starts at 6. (4) Repeat 4 -> 2.
- Rows older than today are never touched by a change (history keeps its own hour).

## Check (Sonnet)

**Verdict: FAIL** (one real logic error in `currentDayKey` when the previous day has no row; everything else checks out).

Commands: `npm run typecheck` clean; `npm run lint` clean; `npx jest src/domain src/data src/state` 25 suites / 292 tests pass. No coverage dir left.

### ERRORS
1. `src/domain/dayKey.ts:69-79` (`currentDayKey`) and its use by `state/today.ts:9` / `actions/settings.ts:23`. When the day before today has NO row, the `snapshotOf(k) ?? settingHour` fallback uses the NEW setting for that missing row's end, so an hour change can move today.
   Expected: changing the setting never moves today (contract chunk 1).
   Failing scenario: setting 4, no Monday row (app not opened Monday, or a first-run user). Tuesday 05:00 reconcile creates the Tuesday row (snapshot 4). At Tue 05:30 the user sets 4 -> 6. `setDayStart` reconciles, writes setting 6, then calls `todayKey(db, Tue 05:30)`: k = dayKeyOf(Tue 05:30, 6) = Mon; prev = Sun (not running); `now >= dayEndOf(Mon, snapshotOf(Mon) ?? 6)` = Tue 06:00 is false, so it returns Mon. Result: `setFutureDayStartHour(db, Mon, 6)` rewrites the Tuesday row to 6 (today moves, ends Wed 06:00 instead of Wed 04:00), Today/useToday resolve to Monday (no row), and the next `reconcile` creates a Monday row and prefills it while the real Tuesday row sits as a "future" row until 06:00. Same effect in the 4 -> 6 case whenever now is in [old hour, new hour) and the previous day is rowless.
   Suggested direction (not applied): do not let a missing neighbour row use the new setting to reject an existing later row; e.g. if a row exists for k+1 (or the first existing row at or before k+1 whose start has passed), prefer it, or make `setDayStart` snapshot/materialise rows so only existing rows decide. A test should cover "no row for yesterday, change 4 -> 6 at 05:30".

### Verified OK
- `currentDayKey`: one step (k-1 / k+1) is always enough for hours 0-23 (k-2 ends <= date(k-1) 23:00, before k's start; k+2 cannot have started); days never overlap or skip when neighbours have rows; 4->6 and 4->2 at old and new boundaries (just before/after), tomorrow row before/after the change, 4->6->2 in one evening, same-hour re-select, hours 0 and 23, and DST (comparisons are by instant via dayStartOf) all behave correctly. `todayEnd` always > now, so `useDayBoundary` waits are positive.
- All "what is today" in `src/state` goes through `todayKey`; remaining `getDayStartHour` uses (close.ts:32, plan.ts:27, reconcile.ts:32, useDayStart.ts) only snapshot a new row or report the setting. `saveConfirmedPlan` uses `onConflictDoNothing`, so planning never overwrites an existing snapshot. No stray `dayKeyOf`/`Date.now` in state/screens/app.
- `rollover`: takes `todayKey`; closes past days at their own end; consistent with `currentDayKey` (no day < todayKey has an end after now, no open today past its end), apart from error 1.
- `setDayStart`: validates before any write, reconcile first, then setting, then rows > today, then `bump('settings','days')`. `setFutureDayStartHour` validates, `gt` filter, bumps `updatedAt`.
- `useDayBoundary`: arms to `todayEnd`. Changing the setting while open does NOT need a re-arm: today's end is its own snapshot and does not change (tomorrow's row change affects only the next re-arm after the fire). Not a bug.
- `useDayStart` returns `{hour, todayEndsAt}` correctly, invalidates on settings/days.
- Layering ok (state -> data/domain, no UI imports); tests are meaningful (domain table, data repo, end-to-end state test) but none cover a missing previous-day row.

### NOTES
- `useDayStart` reads `now()` at memo time only; `todayEndsAt` is stale if no bump happens, acceptable since the day boundary bumps 'days'.
- Mixed CRLF/LF warnings from git are pre-existing style noise.

## Fix (Opus)

### Root cause
`currentDayKey` used `snapshotOf(k) ?? settingHour` for a day with no row. The end of a rowless yesterday (that is,
the start of today) therefore came from the setting at the moment of the call. After a change, that is the NEW hour.
In the checker's scenario (no Monday row; Tuesday row snapshot 4; Tue 05:30, 4 -> 6), Monday "ended" at Tue 06:00, so
Monday came back as today. `setDayStart` then rewrote Tuesday's row (it now counted as a future day) and the next
reconcile created a Monday row. The same thing happens 2 -> 4 at Tue 03:30.

### Rule chosen
```
dayEndHourOf(k) = snapshotOf(k) ?? snapshotOf(k+1) ?? settingHour        // the hour day k ENDS at
currentDayKey:  c = calendar date of now; prev = c-1
                now < dayEndOf(prev, dayEndHourOf(prev)) ? prev : c
todayEnd:       dayEndOf(today, dayEndHourOf(today))
```
Why it works:
- **Today never moves.** `setDayStart` reconciles first, so today T always has a row when the hour changes. T's end
  is its own snapshot. T's start is end(T-1): T-1's row if it has one, otherwise T's own row. Neither depends on
  the setting, so changing the setting cannot move either edge of today.
- **No skip or overlap.** Each day D runs [end(D-1), end(D)). Whatever hours are chosen, end(D) falls on D+1's
  calendar date (00:00-23:00), so the ends strictly increase and today is always c-1 or c. One comparison is
  enough. This also replaces the old k-1/k/k+1 search, which reached the same answer in more steps.
- **Rowless history behaves as before.** Rows after today always carry the setting, because they are created with
  it and `setFutureDayStartHour` rewrites them on every change. So a rowless day either takes the setting or takes
  the next row's snapshot, which equals the setting. With no rows at all the result equals `dayKeyOf(now, setting)`,
  because `dayEndOf(c-1, H)` is the same instant as `dayStartOf(c, H)`, and that holds on DST days too.
- **Rows everywhere: unchanged.** Every day uses its own snapshot, exactly as before.
- **Matches rollover.** Rollover closes a past row at `dayEndOf(D, D.snapshot)`. For a row, `dayEndHourOf` is that
  same snapshot, so a past row's end has always passed and today's end is always after now. `todayEnd` now uses the
  same `dayEndHourOf`, so the boundary timer and `todayKey` agree even for a rowless today.
- **Pure.** `currentDayKey` keeps its signature. `dayEndHourOf` is a new pure export.

Rejected: "an existing row k+1 that has started wins". Whether k+1 has started depends on k's end, which is the
hour being decided, so that rule is circular. Materialising rows in `setDayStart` was also rejected, because it
creates rows for days that never happened.

### Files changed
- `src/domain/dayKey.ts`: new `dayEndHourOf`. `currentDayKey` rewritten to use it, keeping the same signature.
- `src/state/today.ts`: `todayEnd` uses `dayEndHourOf`.
- `docs/build-reports/M6/contract.md`: chunk 1 rule replaced with the exact rule above, marked "Amended by fix".

### Tests added
- `src/domain/__tests__/dayKey.test.ts` (+6):
  - The checker's scenario: rowless Mon, Tue row 4, setting 6, at 05:30, 04:00, 03:59, Wed 03:59 and Wed 04:00.
  - The 2 -> 4 mirror at 03:30.
  - 4 -> 2 at 05:30.
  - Rowless today with an existing tomorrow equals `dayKeyOf`.
  - No rows equals `dayKeyOf` for all 24 hours across both DST days and a normal day.
  - A sweep over mixed rows and hours (0/4/6/23): the day only ever stays the same or steps forward by one.
- `src/state/__tests__/dayStart.test.ts` (+3, `describe.each` over 4->6 at 05:30, 2->4 at 03:30, 4->2 at 05:30):
  - Yesterday has no row. Today's key, row snapshot and `todayEnd` stay the same, and no row is created for
    yesterday.
  - Today closes at its own old hour, and the next day snapshots the new hour.
- With the old `currentDayKey` put back temporarily, 4 of the new tests fail. With the fix they all pass.

### Command outputs
- `npm run typecheck`: one error, `src/screens/DayStartScreen.tsx(61,52)` ('"danger"' is not a theme colour key).
  That file belongs to another builder's in-progress chunk 5 work and was not touched by this fix. My files are
  clean.
- `npm run lint`: clean.
- `timeout 900 npx jest src/domain src/data src/state`: 27 suites, 331 tests, all passed.
- No `coverage/` directory was created.

## Re-check (Sonnet)

**Verdict: PASS**

Commands: `npm run lint` clean; `npm run typecheck` clean (the DayStartScreen error from the fix report is gone); `timeout 900 npx jest src/domain src/data src/state` 27 suites / 331 tests pass. No `coverage/` dir.

### ERRORS
None.

### Verified
- ERROR 1 and mirrors (4->6 at 05:30, 2->4 at 03:30, 4->2) are fixed. Rowless yesterday now ends at `snapshotOf(today)` (today's own row), not the setting, so neither edge of today depends on the setting. The new domain and state tests cover these.
- Today never moves: `setDayStart` calls `reconcile()` first. `rollover` always creates today's row when absent (`today.day === null` -> `createDays`), so today has a row when the hour is written. `setFutureDayStartHour` only touches rows > today. Consecutive changes (4->6->2) and hours 0/23 are fine: today's end is its own snapshot, later rows are rewritten.
- No skip/overlap: end(D) always lands on D+1's calendar date (00:00-23:00, also on DST days), so ends strictly increase and today is c-1 or c; one comparison is enough.
- No rows: `dayEndOf(c-1,H)` is the same instant as `dayStartOf(c,H)`, so it equals `dayKeyOf(now, H)`, including DST (tested for all 24 hours on both DST days).
- Rollover agreement: rowed past days close at `dayEndOf(D, own snapshot)`, which equals `dayEndHourOf` for a row. No open row < today has an end after now; today's end is always after now. Rowless past days have nothing to close, so rollover never needs their end.
- `todayEnd` uses the same `dayEndHourOf` as `todayKey`, so the timer fires when `todayKey` flips; wait is always positive. `useDayBoundary` is unchanged by the fix.
- Fix scope: only `dayKey.ts` (new `dayEndHourOf`, rewritten `currentDayKey`, same signature), `today.ts` (`todayEnd`), contract text, tests. No regressions in the rest of chunk 1.

### NOTES
- Theoretical race: `setDayStart` calls `now()` after `reconcile()` (which used an earlier `now()`). If the old boundary falls exactly in between, today is a rowless new day when the setting is written, and the row created later snapshots the new hour. Sub-millisecond window, harmless; could be closed by reusing one `at`. Not an error.
- The rowless-day rule assumes rows after today carry the setting; this holds because creation uses it and every change rewrites them.
- `useDayStart` reads `now()` at memo time (unchanged, acceptable).
