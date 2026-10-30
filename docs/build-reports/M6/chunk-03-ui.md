# M6 · Chunk 3 · Calendar + Profile UI

## Build (Sonnet)

### Purpose
The presentational pieces the Calendar screen (chunk 4) and Profile / Day start screens (chunk 5) compose, plus three carried M5 items.
Props in, callbacks out; no `src/state` or `src/data` imports.

### Files (under `mobile/src/ui/` unless noted)
- New: `MonthGrid.tsx` (also exports `cellLabel`, type `MonthGridCell`), `CalendarLegend.tsx`, `DayCard.tsx`, `StatTiles.tsx`, `SettingRow.tsx`, `HourPicker.tsx`, `dayCardLine.ts`.
- Edited: `dayNames.ts` (+ `monthName`, `weekdayInitials`, `hourText`), `TaskRow.tsx`, `Checkbox.tsx`, `CheckRow.tsx` (`disabled`), `collection/Jar.tsx` (lid sync, `testID="jar-lid-overlay"`).
- Edited outside ui: `screens/TodayScreen.tsx` (closed rows use `disabled`; the `Locked` wrapper is gone).
- Tests: `__tests__/CalendarUi.test.tsx` (new, 26 tests); `collection/__tests__/Jar.test.tsx` (+1); `screens/__tests__/TodayScreen.test.tsx` (closed-day test now presses and asserts `toBeDisabled`); `screens/__tests__/TopicsScreen.test.tsx` (fake timers).

### Connections now
- `MonthGrid`: `Collection` (scale 0.26, `closed` shows the lid), `useMotion().reduce`, `t.glow`, `t.selected`, `t.c.sun/accent`, `dayNames`.
- `DayCard`: `Card`, `Collection` (0.6), `Button` (ghost), `T`. `StatTiles`: `Card`, `T`. `SettingRow`: `T`, `t.c.tint2`. `HourPicker`: `hourText`.
- `dayCardLine` uses `formatMinutes`. Nothing is wired into a screen yet.

### Future connections
- Chunk 4: `<MonthGrid weeks={useCalendarMonth().weeks} selected onSelect />` (state's `CalendarCell` is structurally assignable to `MonthGridCell`);
  `<DayCard title={...} line={dayCardLine(card, weekdayName(dayKey))} items closed glows action={canPlan ? {label: planned ? 'Edit':'Plan', onPress} : undefined} />`; `<CalendarLegend />`.
- Chunk 5: `StatTiles` (3 tiles), `SettingRow` list (value-only rows render as tags: Sounds "Coming later", Reminders "Not decided"; "My day starts" gets `onPress`), `HourPicker value={useDayStart().hour}`, and `hourText(hour)` for the "Today still ends at 4:00 AM" explanation.
- M7: other collection looks already receive `closed`; glow could move into the look.

### Decisions
- Cell label: "Thursday 22 October, [today|tomorrow,] [glowing,] N marble(s)[, closed]"; weekday/month via `Intl`. Selected is `accessibilityState.selected`. Blank cells are hidden from the accessibility tree; weekday initials row too.
- Glow = halo `View` (`t.glow.fill` + `t.glow.ring` + sun shadow). Pulses opacity 1 to 0.6 with `withRepeat` only when `!useMotion().reduce`; under Reduce Motion it is a fixed opacity 1 and the loop is never started.
- Today ring is a 2 pt `sun` border; selected is `t.selected` fill + accent border (a today+selected cell shows the sun ring).
- Cells are `flex:1` columns with `minHeight` 58 (>=44). On phones narrower than ~340 dp each column is under 44 pt wide (7 columns + gaps); height stays 58.
- `SettingRow`: optional extra prop `tag?: boolean`; default is a tag when the row has a value but no `onPress` and no `right`. With `right` the row is not one accessible item (so a Switch stays reachable).
- `dayCardLine` (second arg accepted per contract, currently unused): past/today non-glowing and partial days read "2 of 4 tasks · 45m focused" (never "failed"/"missed"); an empty today reads "Nothing planned yet." (contract only defined empty past). Focus minutes are floored; the focused part is omitted at 0m.
- `HourPicker`: 4-column wrapped grid of 44 pt radios inside a labelled radiogroup ("Hour the day starts"). `hourText` swaps the narrow no-break space ICU puts before AM/PM for a plain space.
- `TaskRow`/`Checkbox`/`CheckRow` `disabled`: sets `accessibilityState.disabled`, `disabled` on the Pressable and drops `onPress`. Checkbox state is now `{ checked, disabled }`. Closed-day rows therefore announce their normal labels ("Sums" checkbox) plus disabled, instead of the old wrapper label "Sums, not done".
- `Jar.useLid`: when `animateLid` is off the shared value now follows `closed` (1/0), so enabling `animateLid` later starts from the right pose.
- TopicsScreen: the two debounce tests use `jest.useFakeTimers()` around the text change plus `act(advanceTimersByTime(450))`, then real timers (the library `afterEach` also restores them); `waitFor` removed.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean (earlier one warning in another builder's `domain/rollover.ts`, since gone).
- `npx jest` targeted (CalendarUi, collection, TodayScreen, TopicsScreen): all passed (CalendarUi 26).
- `timeout 900 npm run test:coverage`: 51 suites, 539 tests passed; overall 98.31% statements. `mobile/coverage` deleted.

### Known limitations + phone checks
- Check on a phone: glow pulse looks gentle and stops with Reduce Motion on; mini jars at scale 0.26 are legible inside a cell in every look; cells are comfortably tappable on a ~360 dp wide device and 6-row months fit above the DayCard; HourPicker grid is easy to hit; dark palettes keep glow contrast.
- The Reduce Motion test checks the halo's opacity is the static 1 and that the non-reduced path mounts/unmounts cleanly; it cannot observe the animation on a device.
- Jest cannot show the lid pose numerically; the Jar test asserts the overlay style has no lift/rotation instead.

## Check (Sonnet)

**Verdict: PASS** (no blocking errors).

Commands: `npm run typecheck` clean; `npm run lint` clean; `timeout 900 npx jest src/ui src/screens`: 24 suites, 222 tests passed. No `mobile/coverage` left.

### ERRORS
None.

### NOTES (non-blocking)
1. Closed checkbox is NOT a screen-reader regression. `Checkbox.tsx` sets `accessibilityState={{ checked, disabled }}`, so TalkBack/VoiceOver still announce checked/unchecked plus disabled; the old wrapper label "Sums, done" was a workaround. Gap: no test asserts a closed, done checkbox still has `checked: true` (TodayScreen.test.tsx ~291-298 checks only `disabled`), and there are no direct unit tests for `disabled` on Checkbox/TaskRow/CheckRow (only via TodayScreen). Suggest one assertion on `checked` in the closed-day test.
2. Narrow phones: `MonthGrid.tsx` cells are `flex:1` columns, so below ~340 dp each is under 44 pt wide (about 39 pt at 320 dp), while height is 58. Not an error: 360 dp (the target) gives ~44 pt, the cell is 58 pt tall, and WCAG 2.5.8 minimum is 24 px; but it technically misses the "targets >= 44 x 44" line in doc 07 on very small devices. Documented by the builder; acceptable, worth a phone check.
3. Components match the contract props/behaviour: MonthGrid (Mon-first initials from `dayNames`, label "Thursday 22 October, today, glowing, 3 marbles, closed", sun ring for today, selected state, lid via `closed`), CalendarLegend text exact, DayCard (Jar 0.6, title + line, ghost action), StatTiles, SettingRow (role button + "›", tag default, disabled), HourPicker (radiogroup, 24 radios, 44 pt, `Intl`). `MonthGridCell` fields are identical to the contract's `CalendarCell`, so it is assignable. No `src/state`/`src/data` imports in `src/ui` (only domain types). `SettingRow` `tag` prop and `dayCardLine`'s unused `weekdayName` arg (`void weekdayName`) are additions/leniencies, harmless.
4. Glow: `Halo` starts no `withRepeat` when `reduce`, cancels any loop, holds opacity 1; marked `importantForAccessibility="no"`. On Android, `elevation: 3` on the translucent halo may draw a grey rectangular shadow; check on device.
5. `dayCardLine`: never says failed/missed. Extra wordings are sensible: "Nothing planned yet." (empty today), "2 of 4 tasks · 45m focused" (partial), "0 tasks · 20m focused" (unplanned focus). Only blunt case is "0 of 3 tasks" for an untouched past day; consider "3 tasks planned" if it feels harsh. Non-glowing past days with every task done cannot occur (glows covers it).
6. Text is mostly locale-aware via `Intl` (weekday, month, initials, hour); words like "today", "marbles", "closed", "glowing" are hard-coded English, consistent with the rest of the app.
7. Carried items done correctly: TaskRow/Checkbox/CheckRow `disabled` sets state, Pressable `disabled`, and drops `onPress`; TodayScreen's `Locked` wrapper removed cleanly (timed rows keep their full `a11yLabel`, now plus disabled); Jar `useLid` syncs `p` when `animateLid` is off, with a new test (indirect style assertion, weak but reasonable); TopicsScreen debounce tests use fake timers around the change, `advanceTimersByTime(450)` in `act`, and `afterEach` restores real timers. `doNotFake: ['queueMicrotask']` is not used there, but the tests pass and no completion is crossed.
8. HourPicker `width: '23%'` + `flexGrow` with gap 8 gives 4 columns at 328 dp; may wrap to 3 columns on much narrower screens (still fine).
9. Style matches surrounding code (T, Card, theme tokens, `importantForAccessibility="no"` on decorative text). No unnecessary connections found.
