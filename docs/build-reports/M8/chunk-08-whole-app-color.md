# M8 chunk 8: The colour colours the whole app

## What it is for
The colour picked in Color & glass is the app's colour, not only the glass or the background glow. Pick a tint and the buttons, links, switches, selected chips, tab-bar highlight, page, cards and lines all follow it. The six palettes now sit in the same COLOR list, so every colour choice lives in one place.

## Connections
- `LookMix` is unchanged (`pal`, `glass` keep their meaning). "Match the palette" (`glass: 'match'`) stays a valid saved key and gives exactly today's palette.
- Everything that colours the UI already read `t.c.*`; a grep of `src/ui` and `src/screens` found no hard-coded accent/bg/surface. Left alone on purpose: topic colours, collection art, SunMark, the white danger label, the TabBar shadow.
- Look screen's Colors aspect (`pal`) is unchanged. Profile and Look rows show "<palette or tint> · Frosted / No frost".
- `PAGE_BLOB_STRENGTH`, `calmPageBlob` and `backdrop` (chunk 7) now run against the derived colours.

## Files
- `src/theme/deriveColors.ts` (new): `ensureContrast`, `tintMain`, `resolve` (moved from buildTheme), `derivePalette`, `derivedPalette` (memoised per palette x tint), type `Colors`.
- `src/theme/buildTheme.ts`: `c` is the derived palette when the tint is not `match`; `Palette` is now the widened string type.
- `src/screens/GlassScreen.tsx`: palette group + tint group in one radiogroup, `pal` in the draft and in the confirmed patch, new sub line, `PaletteSwatch`.
- `src/ui/lookNames.ts`: `glassValue` shows the palette name when the tint is `match`.
- Tests: `deriveColors.test.ts` (new), `contrast.test.ts`, `GlassScreen.test.tsx`, `LookScreen.test.tsx`, `ProfileScreen.test.tsx`.

## Build
Derivation (only when the tint is not `match`; light = bg luminance >= 0.2, else Night):
- main = the most saturated (largest RGB spread) of the tint's tone and blobs (palette references resolved first).
- bg = main mixed 16% (light) or 20% (dark) into the palette bg; surface = main 7% (light) / 12% (dark) into the palette surface; line = main 14% into the palette line.
- accent = main, mixed toward black (light) or white (Night) in 1% steps until >= 4.5:1 on the new bg and surface (smallest step).
- on = the palette's `on` if >= 4.5:1 on the new accent, else white or near-black, whichever reads better.
- ink, muted, danger keep the palette value unless they miss 4.5:1 on bg, surface, the selected-chip tint or the frost over the page (muted and danger 3:1 over the blobs under a frost card, ink 4.5:1), then step by the smallest amount. In practice only muted moved a little on Mist.
- Chain and blobs follow the tint as before (chain from the tint, blobs over the new bg). `calmPageBlob` recomputes against the new bg, surface, ink, muted, accent, danger, so bare page text stays >= 4.5 on non-glass pages. The strength cap (45) was kept; with the tinted bg the blobs read as a clear variation of the page.
- `dangerFill` and the white danger label are untouched (white on dangerFill passes everywhere, tested).

Examples (flat surface, hex; accent ratio on bg / surface; `on` ratio on accent):

| Palette / tint | accent | bg | surface | accent on bg / surface | on on accent |
|---|---|---|---|---|---|
| Mist / Aurora | #664dca | #e0ddf5 | #f6f4fe | 4.55 / 5.54 | 6.04 (white) |
| Mist / Sea glass | #366f8b | #dcedf4 | #f4fafe | 4.59 / 5.25 | 5.52 (white) |
| Mist / Ember | #8c621f | #f6ebd8 | #fffaf1 | 4.58 / 5.20 | 5.41 (white) |
| Night / Aurora | #967ef3 | #272346 | #272741 | 4.65 / 4.53 | 5.43 (#0f1d1a) |
| Night / Sea glass | #5bbcec | #213646 | #243340 | 5.86 / 6.07 | 8.13 |
| Night / Ember | #ffb238 | #413422 | #37322b | 6.71 / 7.06 | 9.64 |

Perf: a first build of a palette x tint pair costs a mean 6.6 ms (worst 22 ms, the first call incl. JIT warm-up) across all 6 x 28 pairs; a repeat (memoised derivation) costs a mean 0.24 ms (worst 2 ms). The theme.test guard asserts a mean under 25 ms.

Color list (addition from the user):
- One radiogroup "Color": the 6 palettes first (tile drawn from each palette's bg, surface, accent), then the 27 tints. The "Match the palette" tint is not listed (the palette entries replace it).
- Label `COLOR · <NAME>`: the palette name when the tint is `match`, else the tint name.
- Pick a palette: draft `pal` = it and `glass = 'match'` (looks exactly like that palette today). Pick a tint: `pal` stays as the light/dark base (Night owl gives a dark tinted base).
- Highlight: palette selected only when the tint is `match`; otherwise the selected tint.
- Draft, preview, Confirm/Cancel as before; Confirm sends only changed fields, `pal` and `glass` together.
- Copy: "Pick the color used across the whole app."

## Outputs
- `npx tsc --noEmit`: clean. `npm run lint`: clean.
- Full `npx jest --silent`: 901 tests, 899 passed. Failed under load, passed alone (22 of 22): `RunScreen > shows the task details and starts: running label, keep-awake on, light haptic`, `TopicsScreen > shows the empty state and opens the new-topic form` (5 s timeouts at about 75 s suite time).
- New tests: `deriveColors.test.ts` (ensureContrast, tintMain, derivePalette, match = exact palette for all 6, a tint changes bg/surface/accent, Night stays dark, perf guard); `contrast.test.ts` rewritten over the derived colours for every palette x tint x surface (flat, raised, outline, glass): ink/muted/danger >= 4.5 on bg, surface, selected tint and page blobs, accent >= 4.5 on bg, surface and blobs, `on` >= 4.5 on accent, white >= 4.5 on dangerFill, glass frost rules (ink 4.5, muted/danger 3 over blobs) unchanged; GlassScreen: palettes and tints listed, pick palette sets `pal` + match, pick tint keeps `pal`, highlight rules, preview card follows the draft, confirming a tint changes the Confirm Button background.

## Errors
- Some tints reference palette colours (`var(--p-surface)`, `var(--p-accent)`); the first derivation crashed on them. Fixed by resolving them against the palette before picking the main colour.
- Accent as text on the 16% selected-chip tint is below 4.5 for some pairs; it was never a rule (chunk 3 checks ink, muted, danger there), so the test does the same.
- Near-neutral tints (Clear ice, Smoked, Milk glass) change the palette only slightly, by design.
- Low-saturation or very dark tints on Night give a dark but barely tinted page; not changed.
- Not checked on a device: how strong 16/20% looks on a phone.

## Check

### Checker (2026-10-31)
**Verdict: FAIL** (one error)

Errors
1. Accent text on the selected tint is below 4.5 and is really used. `TabBar` (float nav) draws the active tab's icon and label in `t.c.accent` on `t.selected` (accent 16% over the card). `MonthGrid` draws today's day number in accent on the same tint when that day is selected. I measured accent against that tint composited over surface and over bg for every palette x tint (27 real tints, flat). Minimum is 3.55:1 (Night owl / Smoked, over surface). Many Mist tints are about 3.7 to 4.4. For "match" (the old palettes, unchanged) the minimum is also about 3.7, which predates this chunk. `derivePalette` already computes `selected` but ensures only ink/muted/danger on it, not accent. Fix: add `selected` to the bgs used when ensuring accent, then re-derive the `on` label. Add a contrast assertion for accent on the selected tint, at least for derived tints.

Verified OK
- "match" returns `base` itself (`buildTheme`), so existing users get exactly the palette. Non-match derives bg/surface/line/accent/on. Ink/muted/danger move only through `ensureContrast`. Night stays dark (`dark` is chosen from base bg luminance and the mix goes into the dark base).
- Memoisation key is `pal|tint`. Inputs are constants, so reduceTransparency/lowEnd (not part of derivation) cannot break it.
- No new per-render cost. `derivedPalette` is memoised, and both full runs were green.
- Remaining hard-coded hex in src/ui and src/screens is decorative or deliberate: the collection art whites, SunMark default, GlassSwatch edge, TabBar shadow black, Button white on danger. Button, Switch, ChipSet, TabBar, links, Chain and focus rings all read `t.c.accent`, `on` or `chain`.
- GlassScreen: one "Color" radiogroup, 6 palettes first, then tints without match. Palette pick sets `pal` and match. Tint pick keeps `pal`. Palette is highlighted only when glass is match. Confirm patch sends `pal` and `glass` together. Cancel discards. The preview follows the draft. The label and `glassValue` show the palette name for match. LookMix shape is unchanged.
- The builder's contrast test covers ink/muted/accent/danger on bg, surface and blobs, `on` on accent, and white on dangerFill. I did not re-derive every cell by hand.

Commands
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0.
- `npx jest --silent` run 1: 75/75 suites, 901/901 tests, 149 s (a short extra jest run of mine overlapped it). Run 2: 75/75 suites, 901/901 tests, 116 s. No failing or timed-out tests in either run, so the builder's 2 timeouts did not recur.
- My temporary measuring test was deleted.

## Fix (Opus)

Rule (`src/theme/deriveColors.ts`, used by `buildTheme`):
- `t.selected` = accent at a per-theme alpha, `selectedShare(c)`: start at 16% and step down 1% to the strongest share where the text drawn on it holds 4.5:1. Accent and ink are checked over surface (float tab bar) and bg (calendar day on the page); muted and danger over surface, as in chunk 3. Floor 6% so the selection stays visible.
- Derived tints: `derivePalette` now gets accent from `ensureContrast(main, a => [bg, surface, a@6% over bg, a@6% over surface])` (`ensureContrast` takes a function of the candidate colour), so the 6% floor always passes; `on` is re-derived from that accent as before. Ink/muted/danger ensure is unchanged.
- "match": palette tokens are untouched; only the alpha drops.
- Memoised as `selectedShareFor(pal, glass, c)`, same `pal|tint` key as `derivedPalette`.

Result (6 palettes x 28 tints, incl. match):
- Selected strength: derived tints 6 to 16% (most Mist/Sunrise/Lagoon/Lavender/Mono tints 6 to 8%; Night 6 to 16%). Match: Night and Mono stay 16%; Mist, Sunrise, Lagoon, Lavender go to 6%.
- Derived tints: every check is at least 4.5:1 (accent, ink over surface and bg; muted, danger over surface). Lowest `on` on accent: 4.82.
- Match gaps, reported and not fixed (tokens must stay exact). Accent on the 6% tint: Mist 4.24 over bg; Sunrise 4.46 over surface and 4.21 over bg; Lagoon 4.20 over bg; Lavender 4.24 over bg. These accents are only about 4.55 on the bare bg, so no visible tint passes there. Fixing them means changing those palettes' accent tokens.

Tests:
- `contrast.test.ts`: new per-palette test over every tint x surface (flat, raised, outline, glass) on the real `t.selected`. It checks accent and ink over surface and bg, and muted and danger over surface. Match gaps are pinned in `MATCH_SELECTED_GAPS`, so the failure list must equal exactly those. The existing assertions are kept.
- `deriveColors.test.ts`: `selectedShare` stays within 6 to 16 for every palette x tint, Night match stays 16, and `t.selected` uses it.

Commands:
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: clean.
- `npx jest --silent`: 75/75 suites, 909/909 tests, 120 s. No failures.

## Re-check

### Re-checker (2026-10-31)
**Verdict: PASS** (no new errors)

Verified
- Derived tints: `derivePalette` ensures accent over bg, surface and the 6% tint over both, so the floor always passes; `selectedShare` steps 16 down to 6 and checks accent and ink over surface and bg, muted and danger over surface. The new contrast test covers every tint x surface (flat, raised, outline, glass) on the real `t.selected` and passes with no failures for derived tints.
- Selected strength is clamped to 6..16 (`SELECTED_MIN`/`SELECTED_MAX`); never below 6%.
- Match palettes: `buildTheme` uses `base` unchanged when glass is match; only the selected alpha changes.
- `MATCH_SELECTED_GAPS` pins Mist (bg), Sunrise (surface, bg), Lagoon (bg), Lavender (bg). The test compares the failure list with `toEqual` against exactly those, so a new regression or a listed gap that gets fixed (without updating the list) fails the test.
- Memo key `pal|tint` is correct for `selectedShareFor` and `derivedPalette`; inputs are constants (reduceTransparency/lowEnd do not affect colours).
- Perf (spot-timed in a temporary test, deleted): 15 cold buildTheme combos 110 ms total; 1000 warm calls 197 ms (about 0.2 ms each). No regression.

Notes
- The four match gaps (Mist, Sunrise, Lagoon, Lavender accent text on the selected tint over bg, 4.2 to 4.46; Sunrise also over surface) are PRE-EXISTING palette-token properties: those accents are only about 4.55 on the bare bg. They need a palette-token decision (change those accents), not a code fix. They remain documented and pinned in the test.

Outputs
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, clean.
- `npx jest --silent`: 75/75 suites, 909/909 tests, no failures.
