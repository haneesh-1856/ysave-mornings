# M8 chunk 3 - Accessibility pass

## What it is for
Make the app pass WCAG AA contrast in every palette and glass tint, keep every touchable labelled and at least 44 pt, and keep text scalable to 1.3x, with tests that stop regressions.

## Connections
- `src/theme/colorMix.ts` (`parseColor`, `luminance`), `src/theme/buildTheme.ts` (frost and blob colours), `src/theme/tokens.ts` (palettes, glass tints).
- `src/ui/T.tsx` (variants `sub` and `label` use `muted` for real copy), `Button`, `MonthGrid`, `Screen` (ScrollView), `ThemeProvider` (Reduce Transparency), `useMotion` (Reduce Motion).

## Future connections
- Chunk 6 (Maestro) is unaffected: no labels or testIDs changed.
- Any new palette or glass tint is checked automatically by `contrast.test.ts`; any new `Pressable` or `Svg` by `accessibilityAudit.test.ts`.
- `contrastRatio(fg, bg, under?)` and `compositeOver(color, under)` in `src/theme/contrast.ts` are the only new exports. (`colorMix.ts` already had an opaque-only `contrastRatio`; the new one composites alpha and lives in its own file.)

## Files
- src/theme/contrast.ts (new)
- src/theme/__tests__/contrast.test.ts (new)
- src/ui/__tests__/accessibilityAudit.test.ts (new)
- src/theme/tokens.ts (palette `muted` x6, `accent` x4, glass tints `clear` and `arctic`)
- src/ui/Button.tsx (danger fill)
- src/ui/MonthGrid.tsx (hitSlop), src/ui/__tests__/CalendarUi.test.tsx (+1 test)
- src/ui/Background.tsx, src/ui/GlassSwatch.tsx (decorative SVG hidden from screen readers)
- src/ui/TabBar.tsx (label `numberOfLines={1}`), src/ui/Checkbox.tsx (glyph `maxFontSizeMultiplier={1}`)

## Build

### Decisions
- `muted` is body-size text: `T` variants `sub` (13 px) and `label` (11.5 px) use it for descriptions, dates, hints, calendar day numbers and tab labels. So it must meet 4.5:1 (not the 3:1 large-text bar) on: bg, solid surface, the selected-chip tint (accent 16% over surface), and the frost of every glass tint composited over the page bg.
- `ink` must meet 4.5:1 on all of those, and also on the frost over the palest glass blob behind a card (blobs are blurred decoration that can sit under any card). `muted` over those blobs must meet 3:1 (secondary, transient peak).
- `accent` is also text (links like "Back to Profile", tab label, Today chip), so it must meet 4.5:1 on bg and surface, and `on` over `accent` (button label, selected chips, radios, WeekRing letters) 4.5:1.
- Topic colour dots and swatches are not text: skipped.

### Token changes
"Worst" = lowest ratio over bg, surface, selected tint and every glass frost over the page.

muted:
| Palette | before | after | worst before -> after |
|---|---|---|---|
| mist | #7d8a90 | #5d6a70 | 2.88 -> 4.52 |
| sunrise | #9b8580 | #776461 | 2.83 -> 4.53 |
| lagoon | #6f8a96 | #516c79 | 2.97 -> 4.53 |
| lavender | #8b84a0 | #6a647e | 2.89 -> 4.57 |
| mono | #88887f | #60605a | 2.56 -> 4.53 |
| night | #8e96a8 | #b8becb | 3.81 -> 6.06 (raised further so muted stays >= 3:1 over the palest glass blobs: 3.01) |

Each was found by mixing the old muted toward the palette's own ink in 1% steps until the rule held, so the hue family stays.

accent (fails as text on bg/surface or under the `on` label):
| Palette | before | after | worst before -> after |
|---|---|---|---|
| mist | #3f8a74 | #397c68 | 3.80 -> 4.55 |
| sunrise | #ec7a55 | #af5a3f | 2.64 -> 4.53 (the one visible look shift: bright coral becomes burnt orange; `sun` untouched) |
| lagoon | #1d8fb0 | #197a96 | 3.46 -> 4.55 |
| lavender | #7b62d6 | #765ecd | 4.26 -> 4.57 |
| mono #161616 (16.7), night #8fd3c0 (9.5) | unchanged | | |

Each was darkened toward black in 1% steps (smallest change that passes).

Glass tints (only failing combination: Night palette, pale blobs): `clear` frost alpha 35% -> 55% (ink worst 3.61 -> passes); `arctic` frost alpha 40% -> 55% and blob strength 80% -> 70% (ink worst 2.94 -> 4.71). 55% is what the other tints already use. Visible only on Night with those two tints (slightly darker frost).

Button danger fill: #d4574e -> #c4433a (white label 3.98 -> 4.99).

All other ink pairs already passed (ink worst 7.7 to 10.3 on the light palettes). The `on` label passes on every palette after the accent changes.

### Labels and roles
- `accessibilityAudit.test.ts` is a source-level scan of every `.tsx` under `src/ui`, `src/screens`, `src/app`. It asserts: every `Pressable`/Touchable has `accessibilityRole` and `accessibilityLabel` (or is explicitly hidden; only the TimeSlider inner tap area is, inside a labelled `adjustable` parent); every `<Svg>` is hidden from screen readers (or lives in Jar, kit or WeekRing, whose wrapper View is the single labelled node or hidden); no `allowFontScaling={false}`. A guard asserts it found more than 30 Pressables so the scan cannot silently go empty. I chose this over rendering nine screens (which needs per-screen DB state); the screens' own tests already query by `getByRole` + name.
- Audit result: every existing Pressable (about 45 in ui and screens) already had role and label. No fixes needed.
- Decorative SVG: `Background` and `GlassSwatch` now carry `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`. `SunMark`, `SunriseCard`, `WeekRing` already did. The M7 carried item (inner SVGs of `Jar`/`kit`) was tried and reverted: the outer `accessible` View with role image + label already groups them for screen readers, and hiding the inner SVG also hides the testID parts from RNTL (66 tests failed). The audit allowlists those two files.

### Targets (44 pt)
Audited every Pressable's style: Button 48, ChipSet/OneOffForm/LookScreen chips 44 min, Segmented/OutcomePicker/HourPicker 44, Stepper 44, Checkbox 44, ColorSwatches 48 (34 visible), WeekRing day buttons 44 (36 visible), Calendar arrows 44 + hitSlop, TabBar 48, Switch/SettingRow/TaskRow/PlanRow 44, TimeSlider track 44 high. All already met 44.
- Fixed: MonthGrid day cells. Height 58; width is (screen - 40 padding - 18 gaps) / 7, about 38.6 at 320 dp and 42 at 360 dp. Added `hitSlop={{ left: 3, right: 3 }}`, equal to the 3 pt grid gap, so the slop stays inside the gap and never reaches a neighbour's cell (effective width about 44.6 at 320, 48 at 360). Grid unchanged. Test added in `CalendarUi.test.tsx`. Below about 314 dp it is still under 44 (7 columns cannot fit); rare, noted.

### Font scale 1.3
- `T` never sets `allowFontScaling={false}` (the audit test forbids it anywhere). `Screen` scrolls by default and no screen uses `scroll={false}`; pinned footers are short.
- Only fixed-size text box found: the Checkbox check glyph (26 pt box inside a 44 pt target). Gave that glyph `maxFontSizeMultiplier={1}`; the row label still scales. TabBar labels got `numberOfLines={1}` so the bar stays stable (tabs are `minHeight`). Existing single-line names (TaskRow, TaskCard, CheckRow, Fold, SettingRow) already use `numberOfLines` and keep the full name in the accessibility label; everything else wraps in flexible containers.
- Needs a device: how it actually looks at font scale 1.3 and the largest Android size on a 320 dp phone (tab bar, Calendar day-number row, onboarding layout, chip rows wrapping); VoiceOver/TalkBack reading order and the grouped jar images; real touch behaviour of the Calendar hitSlop.

### Reduce Motion / Reduce Transparency
Verified, no change. `useMotion` returns the target value when `useReducedMotion()` is true; `ThemeProvider` reads `isReduceTransparencyEnabled`, listens to `reduceTransparencyChanged`, and `buildTheme(..., { reduceTransparency })` sets `glass.blur=false` while keeping the frost tint.

### Residual (not changed)
- Error text colour `#d4574e` (used as text in `DayStartScreen`, `RunScreen`, `TextField`, `CloseScreen`) is about 3.9:1 on light bg, under 4.5. Only the Button fill was in scope; the proper fix is a theme `danger` token with light and dark variants.
- Muted over the palest glass blob on Night is only about 3:1 by design (secondary).

## Outputs
- New tests: `contrast.test.ts` (6 palettes x 3 checks, danger label, helper basics), `accessibilityAudit.test.ts` (4), one MonthGrid target test.
- `npx tsc --noEmit` clean; `npm run lint` clean.
- Full `npx jest --silent`: 70 of 72 suites, 843 of 846 tests pass; CalendarScreen and GlassScreen time out at 5 s only under full parallel load (known). Isolated rerun (`--runInBand` of CalendarScreen, GlassScreen, all of src/ui and src/theme, after the final edits): 27 of 27 suites, 321 of 321 tests pass.

## Errors
- Full-parallel timeouts in CalendarScreen (swipe test among them) and GlassScreen: known load-only flakes.
- My first glass rule (muted 4.5 over every blob) pushed Night muted to nearly ink, so the rule was split into "frost over page 4.5" and "over palest blob 3".

## Check

### Check (independent, chunk 3)
**Verdict: FAIL** (1 error; notes non-blocking)

Errors
1. src/screens/DayStartScreen.tsx:75, src/screens/RunScreen.tsx:143, src/ui/TextField.tsx:19 (`DANGER`), src/screens/CloseScreen.tsx:25 (`MISSING_COLOR`): error text uses `#d4574e`. Measured: 3.98:1 on white, 3.67:1 on the Mist bg (#f4f6f6), 4.59 only on Night. Error messages are body-size copy (13 px `sub` or default T), so the contract's >= 4.5:1 rule applies and the report itself admits ~3.9. The chunk fixed the button fill but left four text uses, and the contrast test never covers them. Fix: add a `danger` colour to the palettes in tokens.ts (light palettes darker, about #b3362e or whatever clears 4.5 on bg, surface and glass frost; Night lighter, e.g. keep about #e5736a), use it for those four text sites and for Button danger fill (white label must stay >= 4.5; on Night check `on` label), and extend contrast.test.ts to assert danger vs bg, surface and the glass frost per palette. Remove the duplicated hard-coded reds (Button, TextField, CloseScreen, DayStart, Run).

Non-blocking notes
- contrast.ts is correct: WCAG luminance reused from colorMix (0.03928 threshold), bg composited over `under` first then fg over the solid bg, rgba/hex parse via parseColor. Hand checks (independent script): Mist muted #5d6a70 on #fff 5.58, on bg 5.15; Night muted #b8becb on surface 8.75; Sunrise accent #af5a3f on white 4.82; danger #c4433a vs white 4.99 (matches report). The extra rounding to hex before luminance is harmless.
- contrast.test.ts is not tautological: thresholds fixed (4.5 / 3), ratios computed from live tokens and `buildTheme`; iterates all 6 palettes x all glass tints (so strongest and weakest alpha included). Composition matches Card.tsx (frost View over BlurView, blobs are opaque colorMix over bg). Not covered: the BlurView's own contribution (unknowable in jest), and Night muted over blobs sits at about 3.0 by design. Danger fill hex is duplicated in the test (DANGER_BG) rather than read from Button; will go away with the danger token.
- Duplicate `contrastRatio` exists in colorMix.ts (opaque only) with the same name as the new one in contrast.ts. Suggest consolidating (make colorMix's version the alpha-aware one, or rename new one `contrastOver`); check no other caller depends on it. Not an error.
- Token changes listed in the report all match the diff (muted x6, accent x4, `clear` a 35->55%, `arctic` a 40->55% and bs 80->70%); nothing else changed in tokens.ts. No LookMix keys touched; saved looks/favourites unaffected (only values change, so Sunrise users see a darker accent and Night a brighter muted, as reported).
- accessibilityAudit: the scan catches Pressable/Touchable* tags missing role or label (brace-balanced parser; guard > 30). Weaknesses: only matches tags starting exactly `<Pressable`, so `<Animated.Pressable>`, `<AnimatedPressable>` or `createAnimatedComponent(Pressable)` would be missed (none exist today); role/label are matched anywhere in the tag text, so a label nested inside a prop expression would satisfy it; the `hidden` regex matches any `importantForAccessibility={...no...}`; a `{...props}` spread supplying the label would be flagged (safe direction). Allowlists (Jar, kit, WeekRing SVG; TimeSlider inner tap area) are justified by the comments and the report. I did not run a temp-file mutation; assessment is by reading.
- MonthGrid hitSlop {left:3,right:3} with `gap: 3`: each cell's slop covers the whole gap, and neighbours' slops overlap each other over the same 3 pt (neither enters a neighbour's real area, so a tap on a visible cell is never stolen). A tap in the gap is claimed by both cells and resolved by platform order (iOS: later sibling, i.e. right day; Android: first match), so it may pick either neighbour. That is acceptable but the "effective 44.6 / 48" figures in the report are optimistic since half of that slop is shared. Optional tidy: `{left: 1.5, right: 1.5}` makes slops tile the gap exactly (effective about 41.6 at 320 dp, 45 at 360 dp) and removes ambiguity; or leave it. Test asserting the exact value would need updating.
- Font scale: TabBar `numberOfLines={1}` on a short fixed word is fine (labels also carry accessibilityLabel through the tab buttons); Checkbox glyph `maxFontSizeMultiplier={1}` fine since the row label still scales and the 44 pt target is unchanged.
- Layering, types, style: contrast.ts depends only on colorMix; no `any`; tests fine. Diff in src/app/index.tsx and ProfileScreen belongs to chunks 1-2 (ignored).

Commands
- `npx tsc --noEmit`: clean (exit 0).
- `npm run lint`: clean, no output beyond the script header.
- Full `npx jest --silent`: 71 of 72 suites, 844 of 846 tests; only CalendarScreen failed (two 5 s timeouts: "arrows move to any past or future month..." and "swipe moves through months..."); GlassScreen passed this run.
- Isolated rerun (CalendarScreen, GlassScreen, accessibilityAudit, src/theme): 6 of 6 suites, 65 of 65 tests pass.

## Fix (Opus)

Fixes checker error 1 (hard-coded error red under 4.5:1).

### What changed
- `src/theme/tokens.ts`: every palette gains `danger` (error text and error borders) and `dangerFill` (Button `kind="danger"` fill, white label). They flow through `buildTheme` to `t.c.danger` / `t.c.dangerFill` and the `ColorName` type like `muted`/`accent`, so `<T color="danger">` works.
- `src/ui/Button.tsx`: danger fill is `t.c.dangerFill` (was `#c4433a`); label stays `#ffffff`.
- `src/ui/TextField.tsx`: `DANGER` constant removed; border uses `t.c.danger`, message is `<T variant="sub" color="danger">`.
- `src/screens/CloseScreen.tsx`: `MISSING_COLOR` removed; missing-picker outline uses `t.c.danger`, message is `<T color="danger">`.
- `src/screens/DayStartScreen.tsx`, `src/screens/RunScreen.tsx`: error text is `<T color="danger">` (was inline `#d4574e`).
- `src/theme/__tests__/contrast.test.ts`: `DANGER_BG` hex removed. Per palette: danger >= 4.5 on bg, surface and the selected tint; white label >= 4.5 on `dangerFill`; for every glass tint, danger >= 4.5 on frost over the page and >= 3 over the palest blobs.
- `docs/06-design-system.md`: palette list now names `danger` and `dangerFill` (tokens.ts says keep them in sync).

### Values and worst-case ratios
| Palette | danger | dangerFill | danger on bg / surface (min) | danger on frost over page (min of all tints) | danger over palest blob (min) | white on dangerFill |
|---|---|---|---|---|---|---|
| Mist | #a8322a | #a8322a | 6.14 | 5.39 | 3.78 | 6.66 |
| Sunrise | #a8322a | #a8322a | 6.25 | 5.43 | 3.80 | 6.66 |
| Lagoon | #a8322a | #a8322a | 6.15 | 5.41 | 3.78 | 6.66 |
| Lavender | #a8322a | #a8322a | 6.16 | 5.41 | 3.80 | 6.66 |
| Paper mono | #a8322a | #a8322a | 6.15 | 5.38 | 3.78 | 6.66 |
| Night owl | #ffb0a8 | #a8322a | 9.34 | 8.28 | 3.22 | 6.66 |

### Decisions
- A separate `dangerFill` is needed because of Night: a red light enough to read on the dark page (#ffb0a8, 9.3:1) gives only about 1.75:1 under a white label. One deep red (#a8322a) works as the fill on every palette, and on the light palettes it is also the text colour.
- Danger over the glass blobs uses muted's secondary rule (3:1), not ink's 4.5. Over saturated blobs no red gets to 4.5 (my first try at 4.5 failed on 20+ tint/blob pairs on every palette, because only near-black ink clears it). Error copy still has >= 4.5 on the frost over the page, which is the case the checker named. The text carries the meaning, so colour is only a backup. Night's red was made lighter than the first pick (#f28b82 reached only 2.35 over blobs) so it clears 3 with some margin.
- Error borders (TextField, CloseScreen pickers) use the same `danger` as the text, and stay well above 3:1 for non-text UI.

### Results
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npx jest src/theme src/ui src/screens --silent`: 39 of 40 suites, 457 of 459 tests pass. The only failure was CalendarScreen with 2 timeouts under parallel load (the known flake).
- Isolated rerun (`--runInBand` CalendarScreen + GlassScreen): 2 of 2 suites, 20 of 20 tests pass.

## Re-check

**Verdict: PASS** (0 errors)

Checks
- No hard-coded error red remains: grep for d4574e, c4433a and red-ish hexes in src/ui and src/screens finds nothing outside SunMark/collection art. Button danger fill = `t.c.dangerFill`; TextField, CloseScreen, DayStartScreen and RunScreen use `t.c.danger` / `color="danger"`. `ConfirmBox`/`TaskCard`/`TopicForm`/`PlanScreen` only pass the `danger` prop to Button; types and props unchanged.
- Tokens: all six palettes carry `danger` and `dangerFill` (light: #a8322a for both; Night: danger #ffb0a8, fill #a8322a), flowing through buildTheme into `t.c` and `ColorName`.
- Hand check (WCAG): #a8322a luminance 0.1077, white on it 1.05/0.1577 = 6.66 (matches report). Night #ffb0a8 luminance 0.551 on bg #12151c (L about 0.0075) gives about 10.5, and on the lighter surface the reported 9.3 is consistent.
- Test: fixed 4.5 / 3 thresholds, ratios from live tokens; danger asserted on bg, surface, selected tint, frost over page (all 6 palettes x all glass tints), white on dangerFill 4.5, and 3:1 over blobs. Raising any red toward the old #d4574e (3.67 on Mist bg) would fail the bg/surface/frost assertions.
- Ruling on danger at 3:1 over palest saturated blobs: ACCEPTABLE, not an error. Same rule the builder applied to muted (secondary), blobs are blurred decoration under a frost layer, only near-black ink reaches 4.5 there, and the named case (frost over the page, plus bg/surface/selected) is held at 4.5. Error text is also carried by words and role="alert", not colour alone. Minimum 3.22 (Night) and 3.78 (light) leave margin.

Commands
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- Full `npx jest --silent`: 71 of 72 suites, 849 of 851 tests; only CalendarScreen failed (2 timeouts, the known parallel-load flake). GlassScreen passed.
- Isolated `--runInBand` CalendarScreen, GlassScreen, src/theme: 5 of 5 suites, 66 of 66 tests pass.
