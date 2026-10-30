# M7 · Chunk 5 · Look + Glass screens

## Build (Sonnet)

### Purpose
Profile gets working Look and Glass rows. Two pushed settings screens let the user pick every style-lab option (12 groups, 6 presets, 28 glass tints, 5 blurs); each tap is saved at once and applies everywhere.

### Files
- `src/screens/LookScreen.tsx` + `src/app/settings/look.tsx` (new) — back link, live mini preview, presets, one section per group in `DIMS` order, a "Glass" row.
- `src/screens/GlassScreen.tsx` + `src/app/settings/glass.tsx` (new) — "Frosted glass" switch, tint grid, blur chips.
- `src/screens/ProfileScreen.tsx` — Look/Glass rows navigate; "Full settings in M7" line and the "Try a look" card removed.
- `src/ui/lookNames.ts` (new) — `LOOK_PRESETS` ("Your saved mix" + 6 presets), `sameLook`, `lookName` (preset name or "Custom"), `glassValue` (tint name or "Off").
- `src/ui/LookPreview.tsx` (new) — mini preview inside `<ThemeProvider look>`; includes a static `NavSample`.
- `src/ui/GlassSwatch.tsx` (new) — tint tile (3 radial glows + frosted square, SVG), port of `glassSwatch`.
- Tests: `LookScreen.test.tsx` (new, 15 cases incl. the 10-row `it.each`), `GlassScreen.test.tsx` (new, 5), `ProfileScreen.test.tsx` (updated, 6).

### Connections now
- `LookScreen`/`GlassScreen` -> `saveLook(patch)` -> store -> `bump('settings')`; they read `useTheme().look` so every tap re-renders in the new look.
- `LookPreview` -> `ThemeProvider look={t.look}` -> real `Card`, `CountdownBar` (variant = `look.bar`), `Collection` (3 sample `CollectionItem`s, scale 0.8).
- `ProfileScreen` -> `lookName` / `glassValue` -> `router.push('/settings/look' | '/settings/glass')`. LookScreen's Glass row pushes `/settings/glass`.
- Screens import no `src/data` / `getDb` (only tests do).

### Future connections
- Chunk 4 applies layout/nouns/etc. on Today and other screens; the preview and Collection pick up new renderers (chunks 2/3) automatically.
- Reduce Transparency already flows through `ThemeProvider` into the preview's cards.

### Decisions
- **Tab bar preview is a static stand-in** (`NavSample`): the real `TabBar` takes `BottomTabBarProps` (navigator `state`, `navigateToTab`, safe-area `insets`) and is absolutely positioned at the screen bottom, so it cannot render inline outside the tabs navigator. The stand-in draws the three shapes (floating pill, full-width bar, dots only) with the four tab names, no icons.
- **Preview look identity:** `LookPreview` takes `t.look`, which is the store's object (stable between taps), so no new memo was needed; documented in its doc comment (answers chunk 1 check note 4). The preview is hidden from screen readers (decorative).
- Palette group uses its own `PaletteChips` (chip + 4 colour dots + name + check) instead of `ChipSet`, since the contract asks for swatches for colours. Other groups use `ChipSet`; since `ChipSet` clears on a second tap, `onChange(null)` is ignored (a look group can't be empty).
- Option names: `name` fields for palettes/fonts/shapes/motions/glass tints/blurs; the plain string for surfaces, collection, transitions, layout, bar, nav. Titles/hints are copied from `DIMS`. Titles render upper-case through the `label` variant (e.g. "SCREEN TRANSITION"), the same way other sections do.
- Glass tint/blur are one "Glass" `SettingRow` placed right after Surfaces (where Glass tint sits in `DIMS`).
- Glass screen: no tint is marked selected while glass is off (as in the prototype); the heading shows "TINT · <NAME>" always. Selection is visible by ring + bold label (and `accessibilityState`), not colour alone.
- Swatch labels: each tint tile is a `radio` with the tint name as accessible label, min 44 pt tall (tile 52 pt).
- Shared preset helpers moved to `src/ui/lookNames.ts` (not `src/data`).

### Command outputs
- `npm run typecheck`: no errors in my files. It reports 4 errors in `src/ui/collection/__tests__/renderers.test.tsx` (the concurrent builder's file: `UNSAFE_queryAllByProps` / un-awaited `render`), not touched here.
- `npm run lint`: clean.
- `timeout 300 npx jest` on ProfileScreen, LookScreen, GlassScreen, DayStartScreen: 4 suites, 33 tests passed (Look 15 incl. the 10-row it.each, Glass 5, Profile 6, DayStart 7).

### Known limitations + phone checks
- Not run on a device. Swatch gradients, the preview and tab stand-in are checked only structurally in jest (SVG is mocked).
- Check 1: open Profile > Look; tap a palette, a typeface, a collection style: the preview and the screen itself change immediately; kill and reopen the app: the choice is kept.
- Check 2: tap each preset; exactly one shows a check, and changing any single chip afterwards removes the check and Profile's Look row reads "Custom".
- Check 3: Glass screen: swatches look like their tint on your palette; picking a tint while glass is off turns the switch on; blur chips change card blur visibly on the Look preview.
- Check 4: Android back and the "‹ Profile" button both return to Profile from Look and Glass; screen reader reads each chip as "<name>, selected".
- Check 5: the 28-tint grid is 4 columns; labels on narrow phones may wrap to two lines ("Match the palette").
- The preview shows the nav as a stand-in, not the live TabBar; fine details (icons, shadow) differ.

## Check (Sonnet)

**Verdict: PASS** (no blocking errors). typecheck clean, lint clean, jest 4 suites / 33 tests pass (run independently).

### ERRORS
None.

### NOTES
1. `src/ui/ChipSet.tsx` (used by LookScreen.tsx:63): every selected chip announces the hint "Double tap to clear", but LookScreen ignores `onChange(null)` (line 68-69), so a screen-reader user is told a thing that does nothing. Minor a11y mismatch; fix by adding an optional `clearable={false}` prop to ChipSet.
2. `src/ui/GlassSwatch.tsx:35`: hard-coded `rgba(255,255,255,0.45)` frost edge (copied from the prototype) is not documented as an exception in a comment. Also the gradient ids `gs0..gs2` repeat across all 28 swatches; fine on native (defs are scoped per Svg root) but would collide on react-native-web, where the first swatch's colours would win.
3. Perf: no buildTheme per chip. Theme is built once in ThemeProvider (memo on look identity); the preview passes `t.look` (the store's object, stable between taps) so it rebuilds once per tap. GlassSwatch does 4 colorMix calls and 3 gradients per tile, un-memoised, so all 28 re-render on any Glass-screen tap (~112 colorMix calls, cheap). Could wrap GlassSwatch in `React.memo` keyed on tint + theme; optional. LookScreen rebuilds its static option maps (`names(...)`) only at module load. Good.
4. Tests: all 10 look groups are checked against `{...DEFAULT_LOOK, ...patch}` via toEqual (so a palette pick provably keeps the other fields); glass/gblur/surf covered in Glass tests; presets incl. "Custom" and "Off" covered. Gaps: no test asserts the preview actually follows a tap (e.g. the NavSample label "Tab bar: Icons only" or ThemeProvider override identity), and the title-order assertion only checks presence, not order. The Android-back test only runs the handler once per screen. Not blocking.
5. Contract items verified: 7 preset rows (Your saved mix + 6) with correct marking via `sameLook` over all 12 keys; DIMS order and exact titles/hints (Glass tint/blur merged into one "Glass" row after Surfaces, pushes /settings/glass, shows tint name or "Off"); options come from tokens only; palette picks use `saveLook({pal})`, which merges onto the current store look then normalizes, so nothing is dropped; switch on -> surf 'glass', off -> 'flat'; tint pick saves `{glass, surf:'glass'}`; 28 tints, 5 blurs; Profile Look/Glass rows navigate with values; M7 placeholder line and Try a look card removed; back button + BackHandler match Day start. No src/data / getDb imports in screens/ui. Touch targets 44 pt; radio/switch roles and selected state present.
6. Glass screen shows no tint as selected when glass is off (matches prototype); heading still names the stored tint.
