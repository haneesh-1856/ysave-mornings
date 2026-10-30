# M7 · Chunk 4 · Apply the look everywhere

## Build (Sonnet)

### Purpose
Today follows `t.look.layout` (dock / corner / hero), every user-visible name for the collection or its items follows `t.look.art` through `collectionNoun` / `unitNoun`, and the hard-coded radius / surface / motion literals that the theme can supply were replaced.

### Files
- `src/ui/Dock.tsx` — rewritten: a `Card` row (collection at 0.5, "Today's <noun>" / "N <units>", small Close button via new `onClose`). `onPress` still wraps the collection+text in one button.
- `src/screens/TodayScreen.tsx` — layout switch; Close button rules unchanged.
- `src/ui/collection/kit.tsx` — `collectionLabel` now uses `collectionNoun`/`unitNoun` (the only edit in `src/ui/collection`).
- `src/ui/dayCardLine.ts` (`art` param), `src/ui/MonthGrid.tsx` (`cellLabel` `art` param; Halo duration), `src/screens/CalendarScreen.tsx`, `src/screens/CloseScreen.tsx`, `src/screens/TopicsScreen.tsx`, `src/ui/TaskCard.tsx`, `src/ui/TopicForm.tsx`, `src/screens/ProfileScreen.tsx` (third tile label only), `src/screens/RunScreen.tsx` (pill radius).
- Tests: `src/screens/__tests__/TodayScreen.test.tsx` (+7), `src/ui/__tests__/Nouns.test.tsx` (new, 4), `src/screens/__tests__/ProfileScreen.test.tsx` (+1).

### Connections now
- `TodayScreen` -> `useTheme().look.{layout,art}` -> Dock (footer) or inline `Collection` blocks; `Dock` -> `Card`, `Button`, `collectionNoun`/`unitNoun`.
- `MonthGrid` -> `cellLabel(cell, locale, t.look.art)`; `CalendarScreen` -> `dayCardLine(card, weekday, art)`; `CloseScreen`, `TopicsScreen`, `TaskCard`, `TopicForm`, `ProfileScreen`, `kit.collectionLabel` -> `collectionNoun.ts`.

### Future connections
- Morning's "Today's <noun> / 1 <unit> already" block from the prototype is not in the app yet; it should use the same helpers when added.

### Decisions
- Dock layout: per the contract/prototype the small Close lives in the dock. The old in-content "Close today" button is removed for `dock` only. The button's visible label is "Close" with `accessibilityLabel="Close today"`, so existing tests/screen-reader name are unchanged.
- Dock is now a `Card` (look surface, radius, glass) instead of a hand-styled strip with a top border; the Screen footer already pads for the tab bar and safe area, so the dock's own bottom-inset padding was dropped (it double counted).
- Pure helpers gained an optional trailing `art` param defaulting to `'glass'` (`cellLabel`, `dayCardLine`), so old call sites and tests keep working.
- Corner: row with ghost "Close today" left, `TODAY'S <NOUN> · N` label (label variant, uppercased by the T variant) over collection at 0.62 right. Hero: collection scale 1 + "N in today's <noun>" under the header, list, Close at the end.
- Topics dots a11y label now uses correct singular ("1 marble this week"; before it was always "marbles"). Looks the same under all other counts.
- Calendar legend ("Glowing days: everything you planned got done") and Run/Planned/Morning contain no noun text, so nothing to change there.

### Audit changes
- `src/ui/Dock.tsx` (whole style): `backgroundColor t.c.surface + borderTopWidth/Color` -> `<Card>` (look surface, radius, glass).
- `src/ui/MonthGrid.tsx:~65`: Halo `duration: 1600` -> `t.motion.duration * 2.5` (same 1600 ms for Springy).
- `src/screens/CloseScreen.tsx:~97`: `borderRadius: 12` -> `t.radius.r`.
- `src/screens/RunScreen.tsx:~134`: treat pill `borderRadius: 999` -> `t.radius.rb`.
- Left alone, on purpose: `MISSING_COLOR`/Button danger `#d4574e` (documented error red); small dot/pill/knob radii that are drawing geometry (TopicsScreen/RunScreen/CheckRow/TaskRow/OutcomePicker/PlannedList/Chain/TabBar dot/Switch/Stepper/ColorSwatches/WeekRing/TimeSlider/MonthGrid draft dot/ProfileScreen avatar); `Checkbox` radius 8 and `SettingRow` badge radius 6 (tiny glyph-sized boxes, a look radius would turn a 26 pt box into a circle); `CalendarLegend` swatch radius 5 (14 pt sample); `CountdownBar` `TICK_MS` linear tween (must match the 1 Hz tick, not a look motion); `TextField` already `min(t.radius.r,16)`; SVG text/geometry in `src/ui/collection` (out of scope, file untouched except kit label). `GlassSwatch`/`LookPreview`/`LookScreen`/`GlassScreen` not touched per instructions (they contain literals such as `borderRadius: 7`, `r + 14`, `rgba(255,25…)` for the chunk-5 owner). Font family: every `fontFamily` is `t.font.*`; none hard-coded.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean (no output beyond header).
- Targeted: TodayScreen 21/21, Nouns 4/4, ProfileScreen pass.
- `timeout 600 npx jest src/screens src/ui` (twice): 381-383 of 384 pass; the 1-3 failures differ per run (CalendarScreen arrows/swipe, GlassScreen switch) and all pass when run alone (`CalendarScreen` + `GlassScreen`: 17/17), so they look like timeouts under full-suite load; not caused by this chunk (no overlap with files changed).

### Known limitations + phone checks
- Not run on a device. Dock text is `importantForAccessibility="no"` so a screen reader gets the collection's own label (or the button's label when tappable).
- Check 1: switch Look > layout between the three on Today; collection and Close appear where described; Close absent on an empty or closed day.
- Check 2: with garden / stamp card, Today, Calendar day card, Close ("Close the garden"), Topics note and Profile stat read in the new nouns.
- Check 3: dock Card in glass vs outline surfaces keeps ≥ 44 pt Close button and doesn't clash with the floating tab bar.

## Check (Sonnet)

**Verdict: PASS**

ERRORS: none.

NOTES
1. Layouts: dock/corner/hero match the contract and prototype. Close is gated by `!closed && !empty` in all three layouts. The dock Close calls the same `router.push('/close')` as the old button. The dock has no `onPress`, as before.
2. Safe area: `Screen` footer has `paddingBottom = TAB_BAR_SPACE + insets.bottom`. The old Dock added `insets.bottom` on top of that, so it double-counted. Removing it is correct. On an iPhone with a home indicator the dock now sits one inset above the tab bar space. With corner/hero (no footer) the ScrollView pads `bottom` once.
3. Dock as a Card in the footer: the footer is a sibling of the `BlurTargetView`, so the Card's BlurView target still resolves. The dock is inset by the footer's 20 pt horizontal padding, so it is a floating card, not an edge-to-edge strip. This is a visual change from the old full-width bar, not a bug. Needs a device look.
4. Nouns: leftovers are `LookScreen.tsx:36` hint "where the jar lives on Today" (prototype DIMS wording, chunk 5 owner), code identifiers/comments (`CloseScreen` `jar` var, `RunScreen:81` comment), and `stats.marbles` data. No user-visible leftovers in the files this chunk owns. CalendarScreen passes `art` to `dayCardLine`; MonthGrid passes `t.look.art` to `cellLabel`. Default look strings are unchanged (the `art` param defaults to `glass`).
5. Audit: Halo `t.motion.duration * 2.5` is added to the effect deps. Radii changes are fine. The "left alone" list was not touched. The diff also contains earlier-chunk work (Collection switch, Profile Look/Glass rows), which is out of this chunk's scope.
6. Tests: `CalendarScreen` + `GlassScreen` alone: 17/17 pass. `npx jest src/screens src/ui`: 33 suites, 384/384 pass in my run, with no flakes. The builder's 1-3 intermittent failures were not reproduced, which is consistent with load timeouts. TodayScreen resets the look in `afterEach` (`saveLook(DEFAULT_LOOK)`). Nouns.test passes the look through `ThemeProvider` props, so there is no store leak. I did not check other test files for a missing look reset.
7. `npm run typecheck` and `npm run lint` are clean.
