# Chunk 1 · Domain types + day boundary

## Build (Sonnet)

### Purpose
Shared domain types/constants and the pure day-boundary functions (doc 04 §1) that every later domain module builds on.

### Files created/changed
- `mobile/src/domain/types.ts` (new) - exactly the contract's types and constants, formatted one field per line.
- `mobile/src/domain/dayKey.ts` (new) - `dayKeyOf, dayStartOf, dayEndOf, addDays, weekdayIndex, repeatsOn, weekStartOf, compareDayKeys, isDayKey`.
- `mobile/src/domain/__tests__/dayKey.test.ts` (new) - 31 tests.
- `mobile/jest.global-setup.js` (new) - sets `process.env.TZ = 'America/New_York'` once before workers start.
- `mobile/package.json` - added `date-fns ^4.4.0` (via `npx expo install`) and `jest.globalSetup`.

### Connections now
- `types.ts` imports nothing. `dayKey.ts` imports `date-fns` and `./types` (type-only: `DayKey`, `Epoch`).
- Nothing imports either file yet.

### Future connections
- `dayKey.ts`: chunk 2 timer (`dayEndOf`), chunk 3 plan (`repeatsOn`, `addDays`, `weekdayIndex`, `compareDayKeys`, `plannableDays`), chunk 4 rollover (`dayKeyOf`, `dayStartOf`, `dayEndOf`, `addDays`), chunk 5 calendar/stats (`addDays`, `weekStartOf`, `compareDayKeys`), state layer (`dayKeyOf` with `clock.now()`), data layer validation (`isDayKey`).
- `types.ts`: all domain modules; `src/data` imports it (domain/types only) for repo return types; `MINUTES` used by plan.ts, `GOLD_OVERTIME_MS` by timer.ts, `DEFAULT_DAY_START_HOUR` by state/rollover.

### Decisions & contract/doc conflicts
- Doc 04 §1 says `dayKeyOf` = date of `instant - H hours` via `subHours`. date-fns `subHours` subtracts absolute milliseconds, which disagrees with `dayStartOf` (local wall-clock H:00) on DST days (e.g. H=4, spring-forward day: 04:00 EDT minus 4 absolute hours lands on the previous day). Implemented instead as: local calendar date of the instant, minus one day if the instant is before `dayStartOf(thatDate, H)`. Same results as the doc's examples, and `dayKeyOf(dayStartOf(k)) === k` / `dayKeyOf(dayEndOf(k) - 1) === k` hold on DST days. Recommend updating doc 04 §1 wording.
- Invalid `dayKey` inputs throw (including `weekdayIndex`, `repeatsOn`, `weekStartOf`, `addDays`, `compareDayKeys`); `isDayKey` is the only non-throwing check. `addDays` also throws on non-integer `n`; `dayKeyOf` throws on non-finite instants.
- Gap case: if H:00 does not exist (e.g. H=2 on spring-forward), `dayStartOf` yields 03:00 (JS rollforward); tested that `dayKeyOf` still agrees.
- Added `jest.global-setup.js` rather than a setup-file import so TZ is set before any Date use in all workers.

### Command outputs
- `npx tsc --noEmit`: pass, 0 errors.
- `npx expo lint`: pass, exit 0, no warnings.
- `npx jest`: 2 suites passed, 42/42 tests (31 dayKey + 11 existing theme).

### Known limitations
- Tests only run in America/New_York; no southern-hemisphere or half-hour-offset zone coverage.
- `isDayKey` accepts years 0100-9999 only in practice (4-digit years below 0100 are rejected by the year check, intentionally).
- Ambiguous fall-back hour: `dayStartOf` for H=1 picks the first (EDT) occurrence.

## Check (Sonnet)

**Verdict: PASS**

### ERRORS
None.

### Verified
- `types.ts` matches the contract field for field (all types, interfaces, `DayTaskDraft`, `MINUTES`, `GOLD_OVERTIME_MS`, `DEFAULT_DAY_START_HOUR`). No imports.
- `dayKey.ts` exports exactly the 9 contract functions with the contract signatures. No extra exports (helpers `assertDayKey`, `assertHour`, `parse`, `toKey` are private). Imports only `date-fns` and type-only `./types`. No `Date.now()` or argless `new Date()`.
- Scratch property test (temporary, since deleted), America/New_York:
  - For 800 consecutive keys from 2025-12-25 and all H in 0..23: `dayKeyOf(dayStartOf)=k`, `dayKeyOf(dayEndOf-1)=k`, `dayKeyOf(start-1)=k-1`, `dayKeyOf(end)=k+1`, `end>start`, and the midpoint maps to k.
  - A minute-by-minute scan around 2026-03-07..09 and 2026-11-01..02 for H in {0,1,2,3,4,23} showed the key is monotonic, steps by exactly one day, and every instant lies in `[dayStartOf, dayEndOf)` of its key.
  - H=2 on spring-forward: `dayStartOf` = 03:00 EDT. H=1 on fall-back: the first (EDT) 01:00. H=4 days are 24h on both DST days.
  - Invalid inputs throw: bad keys in every function, hour -1/24/4.5/NaN, NaN instant. `repeatsOn` Monday and Sunday bits are correct. Month and year rollover is correct.
- subHours deviation is CORRECT. Literal `subHours(04:00 EDT on 2026-03-08, 4)` gives 23:00 EST on Mar 7, so the day would start at 05:00 instead of 04:00 and disagree with `dayStartOf`. The builder's approach keeps the doc 04 §1 intent (H=4: Tue 02:30 -> Mon, Tue 04:00 -> Tue) and keeps the functions mutually consistent. Doc 04 §1 wording should be updated, as the builder recommended.
- TZ setup works: `globalSetup` sets `process.env.TZ` and workers inherit it. Proven by the in-suite test (`getTimezoneOffset()` is 240 in July) and by my scratch run (300 in Jan, 240 in Jul). Theme tests still pass.
- No other files changed. `git status` shows the whole tree as untracked, so there is no diff to inspect, but only chunk-1 files plus the `package.json` jest config and `date-fns` are touched. No layering violations; nothing imports these files yet.

### Non-blocking notes
1. `mobile/coverage/` is NOT gitignored (`git check-ignore` returned nothing). I deleted the directory my run created. Consider adding `coverage/` to .gitignore.
2. `types.ts` shows 0% coverage (lines 66-68, the constants). This is expected for a constants-only file and is not a defect.
3. Tests only exercise America/New_York (the builder already noted this).
4. The default `package.json` jest config has no `collectCoverageFrom`.

### Command outputs
- `npx tsc --noEmit`: exit 0.
- `npx expo lint`: exit 0, no warnings.
- `npx jest`: 2 suites passed, 42/42 tests (31 dayKey + 11 theme).
- `npx jest --coverage --collectCoverageFrom='src/domain/**/*.ts'`: 42/42 tests passed.

### Coverage
| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| dayKey.ts | 100 | 100 | 100 | 100 |
| types.ts | 0 (constants only) | 100 | 100 | 0 |
