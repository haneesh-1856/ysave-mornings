# M14 chunk 3 - Insights screen

## What it is for
The Insights screen (Profile > Insights): 12 descriptive cards in 4 groups over the last 30 days, drawn from `useInsights()`. It describes only; no judging words, arrows or good/bad colours.

## Files
- `src/screens/InsightsScreen.tsx` (new): header, back button, 4 groups, 12 cards, empty state `Nothing in these 30 days yet.`
- `src/app/insights.tsx` (new): route, default export.
- `src/ui/insights/charts.tsx` (new): static react-native-svg charts (Bars, PairedBars, StackedBar, PairRows, DotStrip) inside one labelled `Chart` wrapper (role image, label states the numbers; the Svg itself is hidden from the a11y tree).
- `src/ui/insights/format.ts` (new): dateText, shortDateText, partialText ("3 of 7 days"), plural.
- `src/screens/ProfileScreen.tsx`: row `Insights` / `Last 30 days` -> `/insights`, above the Moments switch, right after Monthly goal (not dev-only).
- Tests: `src/screens/__tests__/InsightsScreen.test.tsx` (new), `src/screens/__tests__/ProfileScreen.test.tsx` (Insights row test).

## Build
- Durations use the existing `formatHM` (H:MM) and `spokenDuration` from `src/ui/momentText.ts`; weekday names from `src/ui/dayNames.ts`.
- Charts: viewBox 240 wide, `width: 100%` plus `aspectRatio`, so they scale to any phone width without overflow. Text under charts is real RN text in flex columns aligned to the bars. Partial weeks show `N of 7 days` under the week column and in the chart label.
- Colours: `t.c.accent`, `t.c.muted`, `t.c.line`, `t.c.sun` (gold), `t.topic(colorKey).color` for topics. Moved vs let go use accent vs grey (no red/green).
- Records card has no chart (text rows with date and task name), so 11 charts.
- Back button `‹ Profile` + Android back, as MonthlyGoal.

## Tests
InsightsScreen (8): header and line, group and card order, key numbers, partial-week text, records labels, 11 chart a11y labels in words, all-empty state (12 empty cards, no charts), word scan (rendered text of full and empty fixtures, and the 4 source files). ProfileScreen: row pushes `/insights`. Accessibility audit passes.

## Command tails
- `npx tsc --noEmit`: no output (clean).
- `npx expo lint`: no output (clean).
- jest (3 suites): Tests: 23 passed, 23 total.

## Errors / open
- Two first-run failures in my own test (duplicate `9:40` text; partial-week count 4 not 5), fixed in the test. Console showed "overlapping act()" warnings from a loop render in the word scan; replaced by `it.each`.
- Chart label for first-timer lists one entry per day (up to 30 dates); long but complete.
- Not seen on a device or emulator; layout is by construction (percent width, flex columns).

## Check

### Checker B (data audit)
**Verdict: PASS WITH ERRORS (1 must-fix: sub-minute values shown as 0:00; 1 small grammar fix).** Every number and chart mark traces to the correct `Insights` field; no NaN/Infinity/undefined text and no negative or NaN svg attribute in any of 3 probe fixtures (realistic-ish, all-zero, edge). Probe file deleted (confirmed).

| Card | Shown value | Source field | Expected | Match |
|---|---|---|---|---|
| Hours you focus | bars; `h:00 to h+1:00`; H:MM of top hour | hours.msByHour, max of series, indexOf(max) | edge 59 s at 7h -> `7:00 to 8:00`, `0:01`; real 2 h -> `10:00 to 11:00`, `2:00` | yes (0:01 is 59 s rounded up) |
| Your week shape | bar per weekday, H:MM, `N days` | weekdays.avgMs, dayCount (Mon=0 matches weekdayIndex) | avg shown as stated, not recomputed | yes; `1 days` if dayCount 1 (see W2) |
| First timer | dots, median H:MM, count | firstStart.days/medianMinutes, axis max = max(60, ceil(max/60)*60) | median 0 -> `0:00`; axis `1:00` | yes |
| Topic split | stacked widths = ms/total, legend H:MM, total | topics[].ms | no percents shown; total = sum of ms | yes |
| Planned and focused | pair widths on one max | planned[].plannedMs/focusedMs | 1 h 0 min 30 s planned -> `1:01` | yes (rounded, W1) |
| Session lengths | bins, count, median H:MM | sessions.bins/count/medianMs | 59 s -> `0:01`; 29 s -> `0:00` | rounded; 29 s shows 0:00 (E1) |
| Weekly focus | bars + H:MM + `Oct 5` + `N of 7 days`; total | trend[], totalFocusMs | partial 1-day week labelled `1 of 7 days`, not scaled | yes |
| Days you showed up | `days of daysInWindow`, bar scale 7 with pale track | showedUp.byWeek/total | `1 of 1` for 1-day week | yes (scale is 7, not series max; fine, see W3) |
| Gold rings | rings per week, rings, days | gold.* | zero-safe | yes |
| Moved and let go | `m / l` per week, totals | carry.* | zero-safe (max 0 -> no bars) | yes |
| Checklist ticks | stacked ticked/not, counts | checks.* | `Ticked  1`, `Not ticked  0` | yes |
| Your records | H:MM, task name, `Wed, Oct 7`, `1 day` | records.* | dates carry weekday+month+day, unambiguous | yes (E1 for sub-minute) |

Scaling checks: all bar/pair/stack helpers guard max 0 and total 0; heights/widths clamp at >= 0; the all-zero fixture renders only empty cards (no charts). Weekday and 30-day totals match the fixtures. Percentages are never shown.

**ERRORS**
- E1. `src/ui/momentText.ts:9-12` (`formatHM`, used throughout `src/screens/InsightsScreen.tsx`, e.g. lines 196, 206, 229, 255, 299, 301): rounds to the nearest minute, so a non-zero value under 30 s shows `0:00` (probe: topic `Removed topics  0:00`, median run `0:00`, `Longest timer run 0:00` for 29 s), while the chart label says "less than a minute". A real, non-zero value displayed as zero breaks the "shown exactly" rule. Fix: add an Insights-local formatter in `src/ui/insights/format.ts`, e.g. `durationText(ms)`: `ms > 0 && ms < 60_000 ? '<0:01' : formatHM(ms)` (or show `0:29` as M:SS under one minute), and use it for every duration on this screen (and for the legend/records rows). Add a test with a 29 s value.
- E2 (minor, copy). `InsightsScreen.tsx:207`: `` `${wd.dayCount[i]} days` `` prints `1 days` for a count of 1. Use `plural(wd.dayCount[i], 'day')`. Cannot occur in a real 30-day window (every weekday appears at least 4 times) but the card should not rely on that.

**WARNINGS**
- W1. Rounding: H:MM rounds half up (1 h 0 min 30 s shows `1:01`; 59 s shows `0:01`). Consistent with the rest of the app; sums of rounded rows can differ from the rounded total by a minute.
- W2. `Legend` keys on `text` (`InsightsScreen.tsx:91`): two topics with the same name and time would collide. Use the index in the key.
- W3. Days-you-showed-up bars use scale 7 rather than the series max; intentional (track shows days in window) but differs from the other charts.
- W4. `StackedBar` (`charts.tsx:80`) draws a tiny share (under 1/240 of total) as width 0, so a non-zero part can be invisible; the legend still lists it.
- W5. Week columns show the Monday of a partial first week (`Oct 5`) though the window starts Oct 7; labelled `N of 7 days`, so it is accurate.

### Checker A (code)

**Verdict: PASS with warnings (no must-fix errors).** Contract titles, order, groups, header, note, intro line, empty text, records labels and the Profile row all match. Layering clean (screen imports only `useInsights`, pure `addDays`; no db). Hook file already exists.

Command tails
- `npx tsc --noEmit`: no output (clean).
- `npx expo lint`: 0 errors, 6 warnings, all in `src/state/__tests__/insightsData.probe.test.ts` (chunk 2's parallel work, not chunk 3).
- jest (InsightsScreen, ProfileScreen, accessibilityAudit): 3 suites, 23 passed.

ERRORS (must fix): none.

WARNINGS
1. Describes-never-judges: I read every visible string, source and about-lines; no praise, ideal, suggestion, arrows, or up/down colour. Moved = accent, let go = muted grey, not red/green. Gold ring uses `t.c.sun` because it is the app's gold-ring colour, fine. "Planned vs focused" is the contract's own card. No change needed.
2. Zero shown as "less than a minute" (InsightsScreen.tsx:135 week-shape label; also :150, :146 for 0 ms). `spokenDuration(0)` returns "less than a minute", so a weekday with no focus is read "Wednesday less than a minute over 4 days", which is not the stored number. Fix: small helper `spokenMs = ms => ms <= 0 ? 'no focus' : spokenDuration(ms)` (or "0 minutes") used in the week-shape, planned, and hours labels. The test at line 160 currently locks in the odd wording; update it.
3. iOS ignores `importantForAccessibility="no"`. Hidden decoration views that hold Text (hour axis InsightsScreen.tsx:189, WeekColumns :70, week-shape columns :202, bins :245, first-timer axis :215) get read by VoiceOver in addition to the chart label (duplicate, noisy). Fix: add `accessibilityElementsHidden` next to each `importantForAccessibility="no"` on those container Views (as `Chart` already does for the Svg). The columns' numbers are all already in the chart labels.
4. Hour label wording (:130): "9:00 5 hours 30 minutes" is ambiguous when read aloud. Use `9 to 10, 5 hours 30 minutes` (or reuse the visible "9:00 to 10:00" form). Same idea for 24 h clock vs the app's hour formatting; fine to keep 24 h but say "to".
5. First-timer a11y label (:141-143, up to 30 dates): recommend a summary label, with the per-day list available as visible text. Concrete form: chart label = `First timer of each day, after your day starts. 12 days. Median 45 minutes. Earliest 20 minutes on Mon, Oct 12. Latest 1 hour 30 minutes on Fri, Oct 9.` (earliest/latest by `minutes`, ties by earlier date). Under the chart add a 44 pt "Day by day" toggle (Pressable, accessibilityState expanded) that reveals one text row per day (`dateText` + `formatHM`), so screen-reader and sighted users can both reach exact values without a 30-item sentence. Not blocking: the current long label is complete and correct.
6. Layout at 360 dp with font scaling ON: `WeekColumns` has 5-6 columns of about 45 dp; "5 of 7 days" at 10 pt wraps to two lines (fine, text wraps, no overflow) but carry values `${moved} / ${letGo}` with 2-digit numbers (":286") at 12 pt bold could clip or break at 130%+ font scale. Not fixed-width so no hard overflow; consider stacking "moved" over "let go" lines or accept wrapping. Week-shape columns (7 across) and bins labels ("60+ min" 11 pt) are similar. Unverified on device.
7. StackedBar (charts.tsx:80): a part under about 0.4% of total gets width `w - 1` clamped to 0 and disappears from the drawing (still in legend and label). Use a min width of 2 for parts with value > 0.

NITS
- Hour axis labels (:190) use space-between, so 6:00/12:00/18:00 are only approximately under their bars; use absolutely positioned or equal-flex cells for exact alignment.
- Legend key `i.text` could collide if two topics share name and numbers; use index in key.
- Colours: all from `t.c.*` and `t.topic(colorKey).color`; `'none'` is handled by `t.topic` (buildTheme.ts:81 returns muted), so "Removed topics" with colorKey `none` works. The only literal values are `opacity` numbers; no light-only hard-coded colours. PairRows planned bar = `muted` at 0.45 opacity: on dark theme confirm contrast on device.
- Charts are static (no Animated, no animated colour/dash). Every Svg is hidden inside a labelled `role=image` wrapper. Font scaling not disabled anywhere.
- Back button matches MonthlyGoal (same pattern, label "Back to Profile", 44 pt).

Tests (gaps, not blockers)
- Number assertions are real for: 9:00 to 10:00, 5:30, 0:45, 9:40, Study rows, 12 runs, 18 days, ticks, partial-week counts, all 3 records, and 11 chart labels. 
- Not asserted from the fixture: week-shape values (1:00, 0:18, 0:24 text), bins counts and "median run 0:40", weekly column values (1:00, 2:00, 3:00, 3:40), showed-up "3 of 5", gold ring/day figures (4 and 3), carry figures (7 / 2) and "1 / 0" columns, first-timer "3 days with a timer". `getByText('12')`/`'18'` are loose (could match other nodes; they pass only because unique now). Add `getByText` assertions for those, and a test for a topic with colorKey 'none' ("Removed topic") rendering without error, and for the singular forms ("1 ring on 1 day", "1 day").
- The empty test checks 12 empty-state texts but not that a partly empty fixture (e.g. topics with no planned) shows empty only on that card.

### Fix
Changes (files: `src/ui/insights/format.ts`, `charts.tsx`, `src/screens/InsightsScreen.tsx`, the screen test; `momentText.ts` untouched):
1. (B E1) `durationText(ms)` = `<0:01` for 0 < ms < 60 s, else `formatHM`; `spokenMs(ms)` = `no focus` for 0, `less than a minute` under 60 s, else `spokenDuration`. Used for every duration shown or spoken on the screen.
2. (B E2) `nounFor` plus the existing `plural`: week-shape `N day(s)`, figure captions (timer run(s), gold ring(s), day(s) with a timer / with a gold ring / you showed up), spoken `N task(s) moved/let go`, `N item(s) ticked/not ticked`, first-timer `N day(s)`.
3. (A W1) zero in spoken weekday, trend, topic and planned labels says `no focus`.
4. (A W2) containers holding Text inside charts (hour axis, week-shape columns, first-timer axis, bins, WeekColumns) now have `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`.
5. (A W3) hours label `9 to 10, 5 hours 30 minutes; ...`, `23 to 0` at midnight, non-zero hours only, else `No timer runs in these 30 days.`
6. (A W4) first-timer label is a summary (days, median, earliest and latest with date; ties go to the earliest date). No toggle.
7. (A W6) `StackedBar`: any part > 0 is drawn at least 2 wide, taken from the largest part. Also Legend key now includes the index (B W2).

Tests (InsightsScreen now 11): new `exact values` test (week shape 0:18/0:24/0:08 and day counts, session bins per column, median run 0:40, weekly focus 3:40/2:00, 30-day total, showed-up `3 of 5` etc., gold 4/3, carry 7/2 and per-week `1 / 0`, `2 / 1`, `3 days with a timer`); `Removed topics` (colorKey none) row with a 29 s value showing `<0:01` and spoken `less than a minute`; singular forms (1 day, 1 session/run, 1 ring, 1 task, 1 item) and `23 to 0`. Loose `getByText('12')`/`('18')` replaced by labelled figures `timer runs: 12`, `days you showed up, of 30: 18`. Existing label tests updated (hours exact string, `Wednesday no focus over 4 days`, first-timer summary exact). Test file sets `defaultIncludeHiddenElements: true` because hidden axis text is intentional. Word scan kept.

Command tails:
- `npx tsc --noEmit`: no output (clean).
- `npx expo lint`: no output (clean).
- jest (InsightsScreen, ProfileScreen, accessibilityAudit, momentText): 4 suites passed, 36 tests passed.
