# M14 chunk 2 · State: useInsights + data trace

## What it is for
Loads the last 30 days from the db and hands them to `computeInsights`. `loadInsights(at)` is plain (testable);
`useInsights()` is the hook the screen will use. The data trace test proves the numbers against a real five-week
story driven only by the app's own actions.

## Files
- `src/state/hooks/useInsights.ts` (new): `loadInsights(at)`, `useInsights()`.
- `src/state/__tests__/insightsData.test.ts` (new): 3 tests.
- `src/data/repos/topics.ts` (edited, minimal): `listTopics(db, opts?: { includeDeleted?: boolean })`. Default unchanged.
- `src/data/__tests__/topics.test.ts` (edited): one test for the option.
- `src/domain/insights.ts` not touched.

## Build
- `loadInsights`: `todayKey(db, at)`, `listDays(db, addDays(todayKey, -29), todayKey)`, `loadDayBundle` per row, topics via
  `listTopics(db, { includeDeleted: true })` (no repo listed deleted topics before; `getTopic` is by id only, so the option was needed).
- `useInsights`: `useMemo` on `useDataVersion(['days','sessions','topics','tasks','settings'])`, `now()` read inside, like `useProfileStats`.

## Tests
Story (Oct 8 .. Nov 12, 2026; clock moved by `setClockOverride`; actions: createTopic/createTask/removeTopic, confirmDayPlan,
startTask/pauseTask/stopTask/toggleCheckTask, closeToday, reconcile, setDayStart): tasks A (Study timed 30), C (Study check),
H (Health timed 20, Tue/Fri), Z (Home timed 15, Wed). Covers 20 rows in W with 10 no-row gaps, 9 auto-closed days (one with a
330 min session ended by the auto-close, one across midnight at the month end, empty rows), moved and let-go tasks (incl. carried
twice), ticks, gold rings (incl. exactly 1 min over and exactly 0 over), session of exactly 60 min, sessions over hour marks, a
running session today (reconcile at 09:15), Home removed on Nov 3, day start 4 -> 6 on Oct 27, a confirmed plan (planning marble),
two days before the window (Oct 8, Oct 13) that must add nothing.
1. Every field of `Insights` hand-worked in comments and asserted exactly (total 868 min, 18 sessions, 13 first starts, 14 showed up, 9 rings, 5 moved, 10 let go, ticks 10/4, records, five week buckets 5/7/7/7/4 days).
   Removed topic asserted tolerant of grouping/name (`Removed topic` or `Removed topics`; id and colour normalised); position and ms asserted.
2. Cross-checks: showedUp.total == count via `collectionItems(b, at)` read through repos; sum(trend) == sum(hours) == sum(weekdays) == sum(topics) == totalFocusMs; sum(bins) == count; lifetime focus minus window == 100 min (the two outside days); auto-closed day list; day-start snapshots (4 until Oct 27, 6 from Oct 28).
3. Live: `at + 30 min` adds exactly 30 min to the open session (total, hour 9, bins move 45 -> 75 min).
Jest runs in America/New_York (jest.global-setup.js); epochs are built from local parts; the story spans the 2026-11-01 DST end but no session crosses 01:00-02:00.

## Command tails
- `npx tsc --noEmit`: clean (no output).
- `npx expo lint`: clean (no output).
- `timeout 400 npx jest src/state/__tests__/insightsData.test.ts src/data/__tests__/topics.test.ts`: 2 suites, 8 tests passed.

## Errors / open
- None. All hand-worked values matched on the first run.
- The `listTopics` option touches a shared repo file (default behaviour unchanged, other callers not edited).

## Check

### Checker B (data audit)
**Verdict: PASS.** Every asserted value in `insightsData.test.ts` equals the hand-derived value and the value `loadInsights(at)` returns. 0 errors, 2 cosmetic warnings.

Method: temporary probe `insightsData.probe.test.ts` (copy of the story setup; deleted, confirmed gone) read every row through `listDays` / `loadDayBundle` / `listTopics({includeDeleted:true})` and recomputed independently: focus per day from raw session spans, hours minute by minute (each minute added to its local hour), showed-up via `collectionItems(b, at).length >= 1`, gold via `isGold`, carry and checks on closed days only, weekday via `Date.getDay`, topic via live/deleted lookup. Probe passed; all field comparisons below held.

**Stored facts per day in W (Oct 14 .. Nov 12; startH = stored dayStartHour; by = closedBy)**

| Day | startH | closed (by) | sessions | outcomes / ticks | focus | showed | gold |
|---|---|---|---|---|---|---|---|
| Oct 14 | 4 | 09:00 (user) | A 08:00-08:20; Z 08:20-08:45 | A moved; C ticked; Z done | 45 | yes | Z |
| Oct 15 | 4 | 10:30 (user) | A(10m) 09:50-10:20 | C let_go | 30 | yes | A |
| Oct 16 | 4 | Oct 17 04:00 (auto) | none | none | 0 | no | - |
| Oct 18 | 4 | Oct 19 04:00 (auto) | A 22:30 -> Oct 19 04:00 | C ticked | 330 | yes | A |
| Oct 20 | 4 | 09:40 (user) | H 08:00-08:10; A 08:30-09:30 | H moved; C let_go | 70 | yes | A |
| Oct 21 | 4 | 08:10 (user) | none | H moved; A, Z let_go; C ticked | 0 | yes | - |
| Oct 22 | 4 | 09:30 (user) | H 09:00-09:10; A 09:10-09:25 | A, C let_go | 25 | yes | none |
| Oct 23 | 4 | Oct 24 04:00 (auto) | none | none | 0 | no | - |
| Oct 26 | 4 | Oct 27 04:00 (auto) | A 07:00-07:25 | C ticked | 25 | yes | none |
| Oct 27 | 4 | 08:40 (user) | A 08:00-08:31 | H moved; C ticked | 31 | yes | A |
| Oct 28 | 6 | 11:20 (user) | Z 09:00-09:12; A 09:12-11:12 | Z moved; H let_go; C ticked | 132 | yes | A |
| Oct 29 | 6 | Oct 30 06:00 (auto) | none (Z 3m carried) | none | 0 | no | - |
| Oct 31 | 6 | Nov 1 06:00 (auto) | A 23:40 -> Nov 1 00:10 | C ticked 00:15 | 30 | yes | none |
| Nov 1 | 6 | Nov 2 06:00 (auto) | A 08:00-08:20 | C let_go | 20 | no | none |
| Nov 3 | 6 | 11:00 (user) | H 10:00-10:50 | A let_go; C ticked | 50 | yes | H |
| Nov 4 | 6 | Nov 5 06:00 (auto) | none | none | 0 | no | - |
| Nov 9 | 6 | 07:30 (user) | A 06:30-06:45, 07:00-07:20 | C ticked | 35 | yes | A |
| Nov 10 | 6 | Nov 11 06:00 (auto) | none | none | 0 | no | - |
| Nov 11 | 6 | 09:10 (user) | none | A let_go; C ticked | 0 | yes | - |
| Nov 12 | 6 | open | A 08:30 -> open (to 09:15) | C not ticked (open day, not counted) | 45 | yes | A |

No row: Oct 17 19 24 25 30, Nov 2 5 6 7 8 (10 days). Outside W: Oct 8 (A 60m), Oct 9 (empty), Oct 13 (A 40m; = todayKey-30): none contribute. Topics stored: Study, Health live; Home deleted; No topic live.

**Field by field (all "match" = hand = asserted = actual)**

| Field | Hand | Asserted | Actual | Match |
|---|---|---|---|---|
| window | Oct 14 .. Nov 12 | same | same | yes |
| totalFocusMs | 868 min | 868 | 52080000 | yes |
| hours (min, h0..h23 nonzero) | 0:70 1:60 2:60 3:60 6:15 7:45 8:166 9:140 10:130 11:12 22:30 23:80 | same | same | yes |
| weekdays total (Mon..Sun) | 60 151 177 100 0 30 350 | same | same | yes |
| weekdays dayCount / avg | 4 4 5 5 4 4 4 / 15 37.75 35.4 20 0 7.5 87.5 | same | same | yes |
| firstStart | 13 days (240 350 1110 240 300 180 240 180 1060 120 240 30 150), median 240 | same | same | yes |
| topics | Study 761, Health 70, Removed 37 | same | 45660000/4200000/2220000 ms, removed row `removed`/`Removed topics`/`none` | yes |
| planned | Study 430/761, Health 100/70, Removed 48/37 | same | same | yes |
| sessions | 18, median 25m, bins [0,3,7,3,2,3] | same | same | yes |
| trend | 405 95 238 50 80 (days 5/7/7/7/4) | same | same | yes |
| showedUp | 14; weeks 3 3 4 1 3 | same | same | yes |
| gold | 9 rings, 9 days; weeks 3 1 2 1 2 | same | same | yes |
| carry | moved 5 (1 2 2 0 0), let go 10 (1 5 2 1 1) | same | same | yes |
| checks | ticked 10, not 4 | same | same | yes |
| records | best Oct 18 330m; longest A Oct 18 330m; run 3 ending Oct 28 | same | same | yes |

Extra checks (probe): Oct 13 (todayKey-30) and Oct 8 contribute nothing (window totals equal the probe's in-window sum). `at` + 30 min: totalFocusMs +30 min exactly; hours change only at h9 (+30); trend only the last week (+30); weekdays only Thu (+30); topics Study +30, planned Study focusedMs +30 with plannedMs unchanged; sessions count 18 and bins [0,3,7,3,1,4] (45 -> 75 min); gold rings stay 9; records unchanged. The probe's independent per-minute hours, per-day focus, showed-up, gold, carry and checks all equalled `loadInsights`. Auto-closed days list matches the cross-check test (9 days).

**ERRORS:** none.

**WARNINGS:**
1. The test comment for hours says "h3 60 (Oct 18's run; Oct 31's 00:00-00:10)"; Oct 31's 10 minutes belong to h0 (the asserted h0 70 is right). Wording only.
2. The story crosses the 2026-11-01 DST end but no session touches 01:00-02:00, so the DST-safe hour split is not exercised by this test (the domain tests are the place for it). Day-start arithmetic across the change (Nov 1 08:00 vs 06:00 = 120) is correct.

### Checker A (code)
**Verdict: NOT PASS (1 must-fix).** tsc, hook, repo option and layering are fine.

Commands: `npx tsc --noEmit` clean. `npx expo lint`: 0 errors, 4 warnings, all in the stray `src/state/__tests__/insightsData.probe.test.ts`
(not in the builder's list). `jest insightsData + topics`: 2 suites, 8 tests passed.

**ERRORS (must fix)**
1. `src/state/__tests__/insightsData.test.ts:244-245` (`norm`) and its uses at `:299`, `:308`: the removed row is rewritten to
   `REMOVED/REMOVED/'-'` and the regex accepts `Removed topic` or `Removed topics`, so the test passes for any grouping, name,
   id or colour. Fix: delete `norm` and assert the exact merged rows:
   - line 302 -> `{ topicId: 'removed', name: 'Removed topics', colorKey: 'none', ms: 37 * M }` and `expect(ins.topics)` (no norm);
   - line 311 -> `{ topicId: 'removed', name: 'Removed topics', colorKey: 'none', plannedMs: 48 * M, focusedMs: 37 * M }` and `expect(ins.planned)`.
   (Could import `REMOVED_TOPICS_ID` from `domain/insights` for the id.) Also update the "Removed topic" wording in the Tests note above.
2. A stray `insightsData.probe.test.ts` existed during my lint run (4 warnings) but was gone on re-check; make sure none is left behind.
   warnings and runs in the full jest). Delete it.

**WARNINGS**
- The story removes only one topic (Home), so the state-level test cannot show that two removed topics merge into one row. The
  domain tests presumably cover that; if not, add a second deleted topic with a different colour to the story (changes hand numbers).
- Contract lists "a confirmed plan (planning marble)": `confirmDayPlan` is called (line 143) but no assertion depends on it
  (Oct 27 gets a row either way). Harmless, but it is not a tested scenario.

**NITS**
- `:281` avgMs uses `toBeCloseTo(..., 6)`; exact values exist (`totalMs / dayCount`), use `toEqual([60/4, 151/4, 177/5, 100/5, 0, 30/4, 350/4].map(m => m * M))`
  (check float equality; the 35.4/37.75 cases are exact division results of the same operands).
- `:396-397` day-start check is weakly phrased (`[0]` of the filter plus `every` on earlier days); assert the full list of 6-hour days equals those from Oct 28.
- `useInsights` memo does not include time passing (same as `useProfileStats`); acceptable, matches the contract's version key.

**Checked OK**
- Contract: `todayKey` via `state/today.ts` with `at`; window `addDays(todayKey, -29)..todayKey`; `loadDayBundle` for every row; topics
  with `includeDeleted`; memo keys exactly `['days','sessions','topics','tasks','settings']`; plain `loadInsights(at)` exported; `now()` read in the hook only.
- Repo: default path (`q.where(isNull(deletedAt))`) identical to before; ordering `asc(sortOrder)` in both modes; all ~20 non-test
  callers (reconcile, useToday, usePlanDraft, usePlanTopics, useTopicsLibrary, useTopicRemoval, useCloseSummary, listUserTopics) pass no
  option so behave as before. Test is adequate (hidden by default, included with option, deletedAt kept); it could assert ordering/No-topic presence (nit).
- Trace test: only app actions (`createTopic/createTask/removeTopic/confirmDayPlan/startTask/pauseTask/stopTask/toggleCheckTask/closeToday/reconcile/setDayStart`)
  plus `setClockOverride`; the only repo use is read-only (`listDays/loadDayBundle/getDay/listTasks/listTopics`, `focusedMs`), plus `buildPlan` input for `confirmDayPlan` (the app's own flow). No direct writes.
  All other fields are asserted with exact `toEqual/toBe`; scenarios in the contract (month end, gaps, auto-close, moved/let go, ticks, gold, hour boundary, running session, deleted topic, day-start change) are covered.
- Layering: state reads db through repos only; no ui import; no `Date.now()` in `useInsights.ts` or the test (`new Date(y,m,d,h,min)` only).

### Fix (lead, 2026-11-05)
- Must-fix (checker A): `norm` removed. `topics` and `planned` now assert the exact merged row
  `{ topicId: REMOVED_TOPICS_ID ('removed'), name: 'Removed topics', colorKey: 'none', ... }` (37 min focus, 48 min planned).
  Two removed topics merging into one row is covered by the domain test (`insights.test.ts`, unknown + deleted case).
- Nits: `weekdays.avgMs` asserted exactly (`toEqual` on total / count); the day-start change asserts the full list of
  rows with `dayStartHour` 6 (Oct 28 .. Nov 12, the 10 rows); checker B's comment error fixed (Oct 31's 23:40-00:10
  run is in h0, not h3; the asserted values were already right).
- `npx tsc --noEmit` clean; `insightsData.test.ts`: 3 passed.

**Chunk 2 result: PASS (A: must-fix fixed; B data audit: PASS).**
