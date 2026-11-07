# M14 chunk 1 · Domain: insights

## What it is for
`computeInsights(input)` turns the last 30 days of stored bundles into the 12 Insights numbers. It is pure (`at` is an
argument, no Date.now, no imports from data/state/ui) and reuses `focusedMs`, `isGold`, `collectionItems`, `addDays`,
`weekdayIndex`, `weekStartOf`, `dayStartOf`.

## Files
- `src/domain/insights.ts` (new): `INSIGHT_DAYS`, `InsightsInput`, `WeekBucket`, `Insights`, `computeInsights`.
- `src/domain/__tests__/insights.test.ts` (new): 31 tests.
- No other file changed.

## Build
- One pass over the 30 window keys in order; bundles are looked up by key (first bundle per key wins), so anything outside W is ignored.
- Hour split: per session, a loop that jumps to `new Date(y, m, d, h + 1)` (wall clock, DST-safe); each piece goes to its start hour. A `max(boundary, cursor + 1)` guard prevents a stuck loop.
- Median: sorted, odd = middle, even = `Math.round(mean of middle two)` (used for minutes and ms).
- Removed topic: topic missing from `topics` or with `deletedAt !== null` -> `Removed topic` with the day-task's `colorKey`. Topic rows are grouped by `topicId`; the colour of a removed topic is the first day-task met (bundles in key order).
- Ordering: topics/planned sort by value desc, then name, then topicId (deterministic).
- Run/ties: best day strict `>` (earliest); longest session strict `>` or equal length with earlier `startedAt`; longest run uses `>=` (latest).
- Ambiguities resolved:
  - A session's day = the bundle's key (equals `dayTask.dayKey` in real data; the test helper sets it so).
  - `topics.ms` counts every day-task's sessions (timed or not); `planned` only timed day-tasks.
  - Carry `moved`/`letGo` counts any kind of day-task with that outcome on a closed day.
  - A day with no row resets the run.
  - 6 week buckets happen only when today is a Monday (W starts on a Sunday); a Sunday today gives 5 (2+7+7+7+7). Tested with Monday 2026-11-09.

## Tests
- Hand-worked fixture (arithmetic in comments) with 11 sessions over 9 days in W plus 2 outside: asserts every field (window, total, hours, weekdays, firstStart incl. a day with its own dayStartHour 6, topics, planned, sessions, trend, showedUp, gold, carry, checks, records).
- Hour boundary, midnight crossing (day stays the day-task's), open session counted to `at`.
- Bundles outside W ignored; bundle with no sessions; unknown topicId and deleted topic; topic name ties; first start clamp to 0.
- Median odd/even for first start and session length (12.5 -> 13, 1000.5 -> 1001).
- Bins at 4:59.999 / 5:00 / 14:59.999 / 15:00 / ... / 59:59.999 / 60:00.
- Ties: best day, longest session (across days and within a day), longest run.
- Gold at exactly 60 000 ms over vs 59 999; carry/checks only on closed days; check tasks no rings.
- Empty input: zeros/nulls, arrays 24/7/6, 5 week buckets (4,... days sum 30) and a 6-bucket case summing to 30.
- Jest runs in `America/New_York` (jest.global-setup.js); not changed; epochs built with `new Date(y, m, d, h, min)`.

## Command tails
- `npx tsc --noEmit`: no output (clean).
- `npx expo lint`: no output (clean).
- `npx jest src/domain/__tests__/insights.test.ts`: Test Suites: 1 passed, 1 total; Tests: 31 passed, 31 total.

## Errors / open
- None. All passed first run. Open for lead: a removed topic that appears under two different `topicId`s shows as two rows both named `Removed topic` (the contract does not say to merge them).

## Check

### Checker A (code)
**Verdict: PASS with fixes** (one lead-decided must-fix; everything else conforms).

Command tails: `npx tsc --noEmit` exit 0, no output | `npx expo lint` exit 0, no output | `npx jest src/domain/__tests__/insights.test.ts`: Test Suites 1 passed; Tests 31 passed, 31 total.

Conformance: exported names/types match the contract; W = todayKey-29..todayKey; bundles filtered by key (first per key wins); days without a row count 0 and reset the run; carry/checks only when `closedAt !== null`; bins lower-bound inclusive via floors; medians round per rule; ties (best day earliest, longest session earliest startedAt, run latest) correct; hours split with `new Date(y,m,d,h+1)`. Reuse confirmed: `focusedMs`, `isGold`, `collectionItems(b, at).length >= 1`, `dayStartOf(key, b.day.dayStartHour)`. Pure: imports only domain modules, no `Date.now()`, no input mutation (sorts act on fresh arrays). Outputs NaN-free (dayCount is always 4 or 5). Clamp: a session with endedAt < startedAt adds 0 to hours (loop skipped), to length, and to focus, so hours still sum to the total.

ERRORS (must fix)
1. `src/domain/insights.ts` lines 12, 98-102, 184-186, 189-192: unknown/deleted topics are kept as separate rows (keyed by `t.topicId`). Lead decision: merge into ONE row in both `topics` and `planned`, name `Removed topics` (not `Removed topic`), colorKey `'none'`. Change: set `REMOVED_TOPIC_NAME = 'Removed topics'` (l.12); in `topicLabel` return `colorKey: 'none'` and a merge key (e.g. `topicId: 'removed'`) for the removed case (l.100); key the `topicMs` and `plannedBy` maps by that merge key instead of `t.topicId` and emit that id in `rows()` (l.184-192, 250-251). The merged row then sorts like any other (ms desc / plannedMs desc, name tie). Update tests: fixture expectations at test l.215 and l.226 (colorKey 'home' -> 'none', name, topicId), and the "unknown topicId and deleted topic" test at l.328-337, which must now expect ONE row `Removed topics`, 'none', 90 min. Add a planned assertion for the merge (unknown + deleted topic both timed). Update `Ambiguities`/`Errors / open` in the report.

WARNINGS
- No test for a session with endedAt < startedAt (clamp to 0 in hours, bins, median, focus). Add one.
- Today = Sunday (5 buckets: 2+7+7+7+7) is not tested; only Thursday (5) and Monday (6). The code is right by reading; add a one-line test.
- Window edge inside W is not exercised with data: no fixture bundle on 10-07 (first key). A window of 29 days would be caught only by `windowStart`/`dayCount`, not by a counted day. Add a session on the first key and on today.
- A session ending exactly on an hour boundary (e.g. 10:00-11:00 -> all in hour 10, nothing in 11) is not asserted; a plausible off-by-one in the split loop.
- `planned` tie-by-name and the `plannedMs == 0 && focusedMs > 0` branch (timed task with budget 0, with focus) are not tested.
- No test that input bundles are not mutated, and none for a duplicate bundle key.
- DST: `addToHours` is wall-clock based, and on fall-back day a session over the repeated hour is credited whole to the earlier hour (sum still exact). Matches the contract; no DST-day test exists (jest runs America/New_York, so one is cheap: 2026-11-01 01:30-03:00).

NITS
- `binOf` uses a forEach over floors; a reverse find would be simpler.
- `byDescThenName` mutates the array it is passed (safe today since callers pass fresh arrays); say so in the comment or copy.
- Report says "31 tests" and "Removed topic ... two rows" open item: resolved by must-fix 1.

### Checker B (data audit)

**Verdict: PASS.** Every number of the main fixture was recomputed by hand from the fixture code (not from the test comments) and equals the asserted value. No errors.

Hand recomputation (W = 2026-10-07 Wed .. 2026-11-05 Thu; weeks 10-05 (5 d), 10-12, 10-19, 10-26 (7 d each), 11-02 (4 d)):

| Field | Expected by hand | Asserted | Match |
|---|---|---|---|
| Day focus | 10-08 40 min; 10-14 10+30 = 40; 10-20 60 + (299 999 + 300 000 ms) = 4 199 999; 10-28 10+10+12 = 32 min; 11-05 30+30 (open to 12:00) = 60 min | same | yes |
| totalFocusMs | 2.4M + 2.4M + 4 199 999 + 1.92M + 3.6M = 14 519 999 | 14 519 999 | yes |
| msByHour h0 | d1 00:00-00:30 = 1 800 000 | 1 800 000 | yes |
| h6 | b1 06:30-06:40 = 600 000 | 600 000 | yes |
| h8 | f1 10+10 + j1a 08:15-08:45 30 = 50 min | 3 000 000 | yes |
| h9 | a1 40 + f2 12 = 52 min | 3 120 000 | yes |
| h10 | d2 299 999 | 299 999 | yes |
| h11 | d2 300 000 + j1b 30 min = 2 100 000 | 2 100 000 | yes |
| h14 / h15 | b1 14:50-15:00 = 600 000 / 15:00-15:20 = 1 200 000 | same | yes |
| h23 | d1 23:30-24:00 = 1 800 000 | 1 800 000 | yes |
| (all other hours) | 0; sum = 14 519 999 | sum asserted equal | yes |
| weekdays.totalMs (Mon..Sun) | Tue 4 199 999; Wed 2.4M + 1.92M = 4.32M; Thu 2.4M + 3.6M = 6.0M; rest 0 | same | yes |
| weekdays.dayCount | 30 days = 4 weeks (4 each) + Wed + Thu extra -> [4,4,5,5,4,4,4] | same | yes |
| weekdays.avgMs | 4 199 999/4, 4.32M/5, 6.0M/5, zeros | same | yes |
| firstStart days | 10-08 09:00-04:00 = 300; 10-14 06:30-06:00 (own hour 6) = 30; 10-20 earliest 10:00 (d1 starts 23:30) -> 360; 10-28 08:00-04:00 = 240; 11-05 08:15-04:00 = 255 | same | yes |
| firstStart median | sorted 30,240,255,300,360 -> 255 | 255 | yes |
| topics | study 2.4M+2.4M+1.2M = 6.0M; health 599 999+720 000+3.6M = 4 919 999; gone (deleted -> Removed topic, colour home) 3.6M; No topic 0 omitted | same, same order | yes |
| planned (timed only) | study 1.8M+3.6M+0.9M = 6.3M / 6.0M; health 0.6M+1.2M+0.6M+3.6M = 6.0M / 4 919 999; gone 3.6M / 3.6M; no-topic (i1) 1.8M / 0 | same, order 6.3,6.0,3.6,1.8 | yes |
| sessions.count | a1 1, b1 2, d1 1, d2 2, f1 2, f2 1, j1 2 = 11 | 11 | yes |
| sessions.medianMs | sorted 299 999, 300 000, 600k x3, 720k, 1.8M x3, 2.4M, 3.6M; 6th = 720 000 | 720 000 | yes |
| sessions.bins | <5: 1; 5-14: 300k, 3x10 min, 12 min = 5; 15-29: 0; 30-44: 3x30 + 40 = 4; 45-59: 0; 60+: 1 | [1,5,0,4,0,1] | yes |
| trend | 2.4M, 2.4M, 4 199 999, 1.92M, 3.6M (sum 14 519 999) | same | yes |
| showedUp | confirmed plan or tick: 10-08, 10-14, 10-20, 10-25, 10-28, 11-03 (tick), 11-04, 11-05 = 8; 10-15 no (unconfirmed, no tick); by week 1,1,2,1,3 | 8; 1,1,2,1,3 | yes |
| gold | a1 (+10 min), f1 (+5), f2 (+2) = 3 rings; j1 exactly 60 = 0 over, d1 exact, b1/d2 under; days 10-08, 10-28 = 2; by week 1/1, 0, 0, 2/1, 0 | same | yes |
| carry | closed days: moved a3, c1 = 2; let_go b1, b2, i1 = 3; e1 on open day excluded; by week moved 1,1,0,0,0 / letGo 0,2,0,0,1 | same | yes |
| checks | ticked a2, g1 = 2; not ticked b2, c1 = 2 (e1/e2 open day excluded) | 2 / 2 | yes |
| records | bestDay 10-20 4 199 999; longestSession d1 'Practice' 3 600 000 on 10-20 (j1 pieces are 30 min); longestRun 11-03..11-05 = 3 ending 11-05 | same | yes |

Invariants, probe test (3 generated fixtures, 39-day input each so days outside W with sessions were present; gaps, tick-only days, unconfirmed days, an open session today 09:10-09:50 plus 11:40-open at 12:30 = 90 min exactly): Monday today (2026-11-09, 6 week buckets), Sunday today (2026-11-08, 5 buckets), Thursday today (2026-11-05). All 3 passed (`timeout 300 npx jest src/domain/__tests__/insights.probe.test.ts`: 3 passed). Checked in each: totalFocusMs equals an independent per-day focusedMs sum over W only (outside-window days excluded); sum(msByHour), sum(trend.ms), sum(topics.ms), sum(weekdays.totalMs) all equal totalFocusMs; msByHour equals a brute-force per-second recompute; sessions.count equals counted in-window sessions and sum(bins) equals count; sum(daysInWindow) = 30; sum(weekdays.dayCount) = 30; showedUp.total and its by-week sum equal the count of W days with real collectionItems(b, at).length >= 1; gold and carry by-week sums equal their totals; records.bestDay.ms equals max per-day focus; open session counted to `at`. Probe file deleted (confirmed: no probe file remains in src/domain/__tests__).
On the main fixture the same invariants (hours, trend, topics sum to 14 519 999; bins sum 11; daysInWindow 30; dayCount 30; showedUp 8 = counted days) hold by the hand arithmetic above.

ERRORS: none.

WARNINGS (not errors):
- Two sessions starting inside the same day-task but on the next calendar day (d1 crosses midnight) are attributed to the day-task's day for focus and weekday, but to the clock hour for `hours` (h0). This matches the contract (hours = clock hour) and is asserted.
- Test comment on the 6-bucket case says "W starts on a Sunday and ends on a Monday"; the probe confirmed a Sunday-today gives 5 buckets (2+7+7+7+7), as the builder noted.

### Fix (lead, 2026-11-05)
- Must-fix from checker A: every deleted or unknown topic now goes to one row, `topicId: 'removed'`
  (`REMOVED_TOPICS_ID`, exported), name `Removed topics`, colorKey `'none'`, in both `topics` and `planned`.
- Tests updated for the merged row (main fixture and the unknown + deleted case, now also asserting `planned`), and
  the checker A gaps closed: a reversed session (end before start) counts 0 everywhere; today on a Sunday gives 5
  buckets (2+7+7+7+7); the first window day counts and the day before does not; a session ending exactly on the hour
  adds nothing to the next hour; the New York DST change on 2026-11-01 (jest's zone) counts real elapsed time once;
  the input is not mutated. `byDescThenName` comment says it sorts in place.
- `npx tsc --noEmit` clean, `npx expo lint` clean, `insights.test.ts`: 37 passed.

**Chunk 1 result: PASS (A: PASS with fixes, fixed; B data audit: PASS).**
