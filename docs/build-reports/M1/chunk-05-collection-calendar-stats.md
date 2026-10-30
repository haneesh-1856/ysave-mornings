# Chunk 5 · Collection, calendar, stats

## Build (Sonnet)

### Purpose
Pure domain rules for doc 04 §7-§10: which marbles a day shows, whether a calendar day glows, the 8-link soft chain, and the profile/Topics numbers.

### Files
- `mobile/src/domain/collection.ts`: `CollectionItem`, `collectionItems`, `isLidClosed`
- `mobile/src/domain/calendar.ts`: `ChainLink`, `glows`, `chain`
- `mobile/src/domain/stats.ts`: `dayNumber`, `daysShowedUp`, `focusedHours`, `marbles`, `topicWeeklyMinutes`, `weekDots`
- `mobile/src/domain/types.ts`: appended `DayBundle` (the one allowed change; rollover.ts will import it from types too)
- Tests: `mobile/src/domain/__tests__/{collection,calendar,stats}.test.ts`

### Connections now
Imports only domain files: `timer.ts` (`isGold`, `focusedMs`), `dayKey.ts` (`addDays`, `compareDayKeys`), `types.ts`. `stats.weekDots` calls `collectionItems`. Nothing consumes these yet.

### Future connections
- M4: jar dock and the 12 collection renderers consume `collectionItems`.
- M5: lid (`isLidClosed`) and the chain (`chain`).
- M6: calendar glow (`glows`) and profile stats.
- M2: Topics weekly time (`topicWeeklyMinutes`) and dots (`weekDots`).
- The state layer must build `itemCountByDay` from `collectionItems(...).length` per day and pass it to `chain`, `daysShowedUp`, `marbles`.

### Decisions & contract/doc conflicts
- No contract/doc conflicts found.
- `DayBundle` lives in `types.ts` (rollover and collection both import it from there).
- `dayNumber(null, …)` returns 1 (first open shows "Day 1"); also clamped to ≥ 1 if first is in the future. Counting uses UTC midnights so DST cannot skew it.
- Planning marble counts as an item in `itemCountByDay` (matches §9), so it is the caller's count of `collectionItems`.
- `weekDots` returns the earliest 6 when more than 6 exist (doc says only "max 6").
- `topicWeeklyMinutes` masks `repeatMask & 0x7f` and ignores deleted and check tasks.
- `gold` is only for timed tasks; a missing sessions list is treated as `[]`.

### Command outputs
- `npx tsc --noEmit`: clean.
- `npx expo lint`: 0 errors, 2 warnings, both in `src/data/__tests__/schema.test.ts` (another builder's file; not mine).
- `npx jest src/domain`: 6 suites, 119 tests passed (all domain).
- Coverage on collection/calendar/stats: 100% statements, branches, functions, lines. `mobile/coverage` deleted.

### Known limitations
- `glows` takes `todayKey` as given; it does not know about the day-start hour.
- `weekDots` trusts the caller to pass only the current Mon-Sun week's bundles.
- `dayNumber` assumes valid day keys (no validation beyond `compareDayKeys`' asserts).

## Check (Sonnet)

### Verdict: PASS

No real defects. Exports and signatures match the contract exactly (collectionItems, isLidClosed, CollectionItem, glows, ChainLink, chain, dayNumber, daysShowedUp, focusedHours, marbles, topicWeeklyMinutes, weekDots, DayBundle in types.ts). Imports are domain-only (timer, dayKey, types, collection); no I/O, no Date.now; `now` is passed in.

### ERRORS
None.

### Rule check
- Collection: planning marble (sun) first iff planConfirmedAt set, then completed tasks by completedAt, ties by sortOrder; check -> small; gold only for timed and isGold (>= 60 s overtime, via timer.ts); missing sessions treated as [].
- Glow: closed OR past, >= 1 dayTask, every completedAt non-null. Moved/let-go rows have null completedAt so they block; empty days don't glow.
- Chain: 8 links, todayKey-7..todayKey via dayKey.addDays (DST/month safe), oldest first, last 'today'; solid iff count >= 1.
- Stats: dayNumber inclusive, UTC-midnight diff (DST-proof), null/future -> 1; showed-up, marbles, focusedHours (unrounded) correct; weekly minutes = minutes x popcount of low 7 bits, timed and non-deleted only; weekDots excludes the planning marble, filters by topicId, sorts by time, caps at 6.

### Non-blocking notes
1. weekDots "earliest 6": reasonable. Doc only says "max 6"; a week dot row fills left to right as the week goes, so earliest-first is stable (dots never shift). Fine for M2.
2. glows counts any dayTasks even when planConfirmedAt is null (e.g. prefilled unplanned rows). Practically unreachable (can't complete without confirming), and the doc's "has a plan" is satisfied by rows existing. Optional hardening: also require planConfirmedAt !== null.
3. API gaps for downstream (none blocking): callers must build itemCountByDay from collectionItems(...).length (M5/M6) and pass only the current Mon-Sun bundles to weekDots (M2); there is no helper for the week range (belongs to dayKey/state layer). weekDots takes whole-week bundles but DayTask.topicId is used, so deleted-topic past items still count (matches snapshot rule §11).
4. Tests: no explicit DST-crossing test for chain (it relies on addDays, which dayKey tests cover); dayNumber DST case is tested. Tests assert concrete values (order, ties, flags), not just truthiness.

### Command outputs (from mobile/)
- `npx tsc --noEmit`: clean (no output).
- `npx expo lint`: clean (no output).
- `npx jest src/domain`: 6 suites, 119 tests passed.
- Coverage collection/calendar/stats: 100% statements, branches, functions, lines. mobile/coverage deleted.
