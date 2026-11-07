# M14 contract · Insights (on-device statistics in Profile)

**User decisions:** 2026-11-02 option 1 (statistics on the phone, no model, nothing leaves the phone, describes only,
never judges or suggests; non-goals stand). 2026-11-05 pick (Insights Picker artifact, `picks/current`): **all 12**
insights, span **last 30 days**. Insights whose picker example covered a longer span (12 weeks, 6 months, 8 weeks)
are shown **week by week inside the 30 days**; records also cover the 30 days, so every number on the screen means
the same span.

**Data rule:** everything shown is the user's real stored data, computed with the existing domain rules (focus =
`focusedMs`, gold = `isGold`, showed up = `collectionItems(b, at).length >= 1`, day start = the day row's own
`dayStartHour`). A day with no row counts as 0 / not showed up. No number is ever invented or estimated.

**Layering:** domain (pure, `at` is an argument) | data | state | ui; ui and screens never read the db. No new
dependency. Charts are static `react-native-svg` (no animated colours or dash arrays: see M13 fix 1).

## The window
`W` = the 30 day keys `addDays(todayKey, -29) .. todayKey` (today included, live: an open session counts up to `at`).
`weeks` = the Monday-Sunday weeks (`weekStartOf`) that overlap `W`, oldest first (5 or 6); each with `daysInWindow`
(1-7). A week's numbers only count its days inside `W` (a partial week is marked, never scaled up).
"Closed days" = days in `W` whose row has `closedAt !== null`.

## Chunk 1 · Domain: `src/domain/insights.ts` (+ `src/domain/__tests__/insights.test.ts`)
```ts
export const INSIGHT_DAYS = 30;
export interface InsightsInput { todayKey: DayKey; at: Epoch; days: DayBundle[]; topics: Topic[] }
// `days` = the bundles of rows in W (others are ignored: filter by key, the M9 lesson). `topics` includes deleted ones.
export function computeInsights(input: InsightsInput): Insights;
export interface WeekBucket { weekStart: DayKey; daysInWindow: number }
export interface Insights {
  windowStart: DayKey; windowEnd: DayKey;              // W's first and last key
  totalFocusMs: number;                                 // sum of all focus in W
  hours: { msByHour: number[] };                        // 24 entries, index = local clock hour 0-23
  weekdays: { totalMs: number[]; dayCount: number[]; avgMs: number[] };   // 7 entries, 0 = Monday
  firstStart: { days: { dayKey: DayKey; minutes: number }[]; medianMinutes: number | null };
  topics: { topicId: string; name: string; colorKey: ColorKey; ms: number }[];               // ms desc, ties by name
  planned: { topicId: string; name: string; colorKey: ColorKey; plannedMs: number; focusedMs: number }[]; // plannedMs desc, ties by name
  sessions: { count: number; medianMs: number | null; bins: number[] };   // 6 bins, see below
  trend: (WeekBucket & { ms: number })[];
  showedUp: { total: number; byWeek: (WeekBucket & { days: number })[] };
  gold: { rings: number; days: number; byWeek: (WeekBucket & { rings: number; days: number })[] };
  carry: { moved: number; letGo: number; byWeek: (WeekBucket & { moved: number; letGo: number })[] };
  checks: { ticked: number; notTicked: number };
  records: {
    bestDay: { dayKey: DayKey; ms: number } | null;
    longestSession: { dayKey: DayKey; taskName: string; ms: number } | null;
    longestRun: { days: number; endDayKey: DayKey } | null;
  };
}
```
Definitions (every session belongs to the day of its day-task, `dayTask.dayKey`):
1. **hours**: each session's focused span (`startedAt` .. `endedAt ?? at`) split at local clock-hour boundaries
   (`new Date(y, m, d, h + 1)`; DST-safe), each piece added to its start hour. Sum of `msByHour` = `totalFocusMs`.
2. **weekdays**: `totalMs[w]` = focus of the days of W with `weekdayIndex === w`; `dayCount[w]` = how many keys of W
   have that weekday (4 or 5, rows or not); `avgMs[w] = totalMs[w] / dayCount[w]`.
3. **firstStart**: for each day in W with at least one session: earliest `startedAt` minus
   `dayStartOf(dayKey, day.dayStartHour)`, in whole minutes (floor), never negative (clamp 0). Days in key order.
   `medianMinutes`: median of those values (even count: mean of the two middle values, rounded to the nearest minute);
   null when there are none.
4. **topics**: focus per `dayTask.topicId`. Name and colour from `topics` (the No topic row included); a topicId not
   found or deleted: name `Removed topic`, colour = that day-task's `colorKey`. Only topics with ms > 0.
5. **planned**: over **timed** day-tasks in W: `plannedMs` = sum of `budgetSec * 1000`, `focusedMs` = their focus.
   Per topic as in 4. Topics with plannedMs > 0 or focusedMs > 0.
6. **sessions**: every session in W; length = `(endedAt ?? at) - startedAt` (clamp 0). Bins by length in minutes:
   `[<5, 5-14, 15-29, 30-44, 45-59, 60+]` (lower bound inclusive). `medianMs` as in 3 (rounded to the nearest ms),
   null if none.
7. **trend**: per week bucket, focus of its days in W. Sum = `totalFocusMs`.
8. **showedUp**: `total` = days in W with `collectionItems(b, at).length >= 1`; per week the same count.
   Must equal the Profile/Calendar rule for the same days.
9. **gold**: `rings` = timed day-tasks in W with `isGold(budgetSec, sessions, at)`; `days` = days in W with >= 1.
10. **carry**: over closed days in W: day-tasks with `closeOutcome === 'moved'` / `'let_go'`.
11. **checks**: over closed days in W: check day-tasks, `completedAt !== null` ticked, else not ticked.
12. **records**: `bestDay` = the day in W with the most focus (> 0), ties: the earliest. `longestSession` = the longest
    single session in W (> 0), ties: the earliest `startedAt`; `taskName` = its day-task's name. `longestRun` = the
    longest run of consecutive keys of W that showed up (rule 8), ties: the latest; null if none showed up.

Domain tests: a hand-worked fixture (values worked out in comments) covering every field; a session across an hour
boundary and one across midnight; bundles outside W ignored; a bundle with no sessions; a deleted topic; empty input
(all zeros and nulls, arrays of 24 / 7 / 6, 5 or 6 week buckets). Use the time zone jest already runs in (check the
jest config; do not add one) and build epochs with `new Date(y, m, d, h, min)` so the tests hold in any zone.

## Chunk 2 · State: `src/state/hooks/useInsights.ts` (+ `src/state/__tests__/insightsData.test.ts`)
- `loadInsights(at: Epoch): Insights` (plain function, testable) and `useInsights(): Insights` (memo on
  `useDataVersion(['days', 'sessions', 'topics', 'tasks', 'settings'])`). Loads `listDays(db, windowStart, todayKey)`
  then `loadDayBundle` for each, and the topics including deleted ones (check the repo; add an option only if needed).
- **Data trace test** with the app's own actions only (`setupState`, library, plan, run, close, reconcile, settings):
  about 5 weeks of history crossing a month end, with gaps, an auto-closed day, moved and let-go tasks, checklist ticks,
  a gold ring, a session over an hour boundary, a running session today, a deleted topic, a day-start change. Every
  field of `Insights` recomputed by hand in comments and asserted exactly. Plus cross-checks: `showedUp.total` equals
  the count of days in W with `collectionItems(...).length >= 1` read through the repos, and `trend` and `hours` each
  sum to `totalFocusMs`.

## Chunk 3 · Screen: `src/screens/InsightsScreen.tsx`, route `src/app/insights.tsx`, Profile row
- Profile: a row **Insights**, value `Last 30 days`, pushes `/insights`.
- Header `Insights`, note `Last 30 days`; one line under it: `Counted on this phone from your days, tasks and timers.`
- 12 cards in 4 groups, in the picker's order and titles: When you focus (Hours you focus, Your week shape, First timer
  of the day) · What you spend it on (Topic split, Planned and focused, Session lengths) · Over time (Weekly focus,
  Days you showed up, Gold rings) · How days end (Moved and let go, Checklist ticks, Your records).
- Each card: title, the chart (static SVG, theme tokens; topic colours via `t.topic(colorKey).color`), and the numbers
  as text (H:MM with the app's existing formatter if there is one). Every chart has an `accessibilityLabel` that states
  its numbers in words. A card with nothing in W says `Nothing in these 30 days yet.`
- **Describes, never judges:** none of the words good, great, only, just, should, try, better, worse, improve,
  keep it up, well done, amazing, nice; no arrows or colours meaning up or down. Records use plain labels:
  `Most focus in a day`, `Longest timer run`, `Most days in a row`. A test scans the screen file and its rendered text.
- Tests: renders every card from a fixture `Insights` (hook mocked), the empty state, the Profile row, a11y labels,
  the word scan. Follow the M8 a11y audit (44 pt targets, labels on touchables, SVG labelled, font scaling ON).

## Process (same as M9-M13)
Sonnet builder per chunk -> Sonnet checker A (contract, code, tests, layering) -> Sonnet checker B (data audit:
recompute every number by hand from the fixture) -> Opus fixes a test failing more than twice, that error only.
Lead: tsc, lint, full jest, report. Nothing is committed without the user asking.
