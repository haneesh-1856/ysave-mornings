# M8 chunk 7: Color & glass

## What it is for
The tint options are the whole app's color, not a glass feature. The old "Glass" screen is now "Color & glass": the color glows behind the page and colors the chain on every surface, and a separate "Frosted glass" switch only frosts the cards.

## Connections
- `LookMix` is unchanged. The tint key stays `glass`; `surf` and `gblur` keep their meaning, so saved looks and favourites load as before.
- Low-end default and Reduce Transparency (chunk 4: `lowEndDefault`, `blurChosen`, `confirmLook({ chooseBlur })`) only affect blur, as before.
- Route `/settings/glass` and `GlassScreen` keep their names.

## Files
- `src/theme/buildTheme.ts`: new `backdrop`, `PAGE_BLOB_STRENGTH`.
- `src/ui/Background.tsx`: draws from `t.backdrop`.
- `src/screens/GlassScreen.tsx`: new layout, switch semantics.
- `src/ui/lookNames.ts` (`glassValue`), `src/screens/ProfileScreen.tsx`, `src/screens/LookScreen.tsx`: row label and value.
- Comment-only: `src/state/actions/look.ts`, `src/theme/ThemeProvider.tsx`.
- Tests: `GlassScreen`, `ProfileScreen`, `LookScreen`, `theme`, `contrast`.

## Build
Theme shape:
- `t.backdrop: { blobs: [3 colors] }`, always present.
- `t.glass: { blobs, frost, intensity, blur } | null` is unchanged; `blobs` there equals the backdrop blobs on a glass surface. It is null unless `surf === 'glass'`.
- `t.chain` already came from the tint alone, so it follows the tint on every surface.

Decisions:
- Match the palette: its pale palette blobs now show on every surface. On glass they are identical to today. On flat, raised and outline they are drawn calmer.
- Calmer blobs: on non-glass surfaces the backdrop blobs are the tint mixed 45% over the page color (`PAGE_BLOB_STRENGTH`, in `colorMix` terms). Page text sits straight on the blobs there, with no frost card between.
- Why 45: the contrast test failed at full strength (for example Aurora, Ember, Smoke and Peach muted or accent text on Mist) and at 55% (Midnight accent on Sunrise and Lagoon). Thresholds were not weakened. At 45% every palette and tint passes.
- Glass surfaces keep full-strength blobs, as today.
- Glass-off surface rule: if the saved surface is not glass, the draft remembers it. Switching on and then off restores it (for example `outline` stays `outline`). If the saved surface is glass, the previous surface is unknown (the look stores one `surf`), so switching off gives `flat`.
- Picking a color changes only `glass`; it never touches the switch or `surf`. The selected swatch shows regardless of the switch.
- Confirm and Cancel work as before: the draft is whole-screen, and Confirm sends only the changed fields.
- Low-end line "Off, to save battery on this phone. Pick a level to turn it on." and the blur chips behave as before.

Copy:
- Header: "Color & glass".
- Sub line: "Pick the color that glows behind the whole app."
- Section label `COLOR · <TINT NAME>`.
- Section label `GLASS`, followed by the "Frosted glass" switch and the blur chips.
- Radiogroup label "Color"; chips label "Glass blur" (unchanged).
- Rows (Profile and Look): label "Color & glass"; value "<tint name> · Frosted" or "<tint name> · No frost". The accessible name is "Color & glass, Match the palette · Frosted".

## Outputs
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- Full `npx jest --silent`: 885 tests.
  - First run: 884 passed, 1 failed (a stale `TINT · MATCH THE PALETTE` assertion in `GlassScreen.test.tsx`; a test-side fix).
  - After the fix, `GlassScreen.test.tsx` alone passes.
- New tests:
  - `theme.test.ts`: blobs and chain on every surface.
  - `contrast.test.ts`: every palette × tint × non-glass surface. Ink holds 4.5:1 and muted, accent and danger hold 3:1 over the blobs; the card stays the solid surface.
  - `GlassScreen.test.tsx`: picking a color keeps `surf`; glass off keeps the tint and restores the previous surface, else `flat`.
  - Profile and Look tests: value strings.

## Errors
- Full-strength blobs under bare page text fail contrast on non-glass surfaces. Fixed by the 45% calm strength above, not by lowering thresholds.
- Page text on glass surfaces outside cards (headers) sits over full-strength blobs as it did before; this chunk left it unchanged.
- A Python edit pass wrote a stray cp1252 middle dot into some files; fixed to UTF-8.

## Check

### Check (independent, chunk 7)
**Verdict: PASS against the contract, with one accessibility concern for the lead to decide (item 1).**

Errors / concerns
1. Contrast rule is looser for bare page text than the rule the chunk-3 report states. Chunk 3 requires body-size `muted` 4.5:1 on bg and accent-as-text 4.5:1 on bg; its 3:1 "over the blobs" allowance was for text on a frost card over a blob (secondary, transient peak). Chunk 7 applies 3:1 to muted, accent and danger sitting directly on the blobs of flat/raised/outline pages (sub lines, labels, the "‹ Profile" accent link). Measured at 45% over all palettes x tints (flat): ink min 5.71, danger 3.90, muted 3.65 (night/arctic), accent 3.23. So 13 px muted and accent links can fall under 4.5 on a non-glass page. This matches the literal contract wording ("existing thresholds") and the test is honest about it, but it is a weakening in effect. Options: lower PAGE_BLOB_STRENGTH until muted/accent clear 4.5 on the page (test thresholds to AA for muted/accent), or accept and record it as a known deviation.

Notes (non-blocking)
- Verified: `backdrop.blobs` always present; `glass` non-null only when surf is glass; low-end/Reduce Transparency only change `glass.blur` (frost kept); chain comes from tint alone; LookMix unchanged (tint key `glass`). 45% is applied to already-mixed blobs (`colorMix(b, 45, bg)`), so effective tint share is bs x 0.45, slightly calmer than the comment "this % of the tint over the page" says. Glass blobs unchanged.
- Contrast test covers 6 palettes x all tints x flat/raised/outline, asserting every blob (ink 4.5; muted/accent/danger 3) and that the card is the solid surface; thresholds are constants and values computed from live `buildTheme`, so a stronger PAGE_BLOB_STRENGTH would fail it. It does not assert anything about the glass-surface page text outside cards (pre-existing, builder notes it).
- theme.test blob/chain assertions are partly tautological (glass compared with glass; chain compared with same-tint chain) but the final not.toEqual (tint changes blobs) is real.
- Screen: title "Color & glass", sub line, COLOR section (radiogroup "Color") first, then GLASS (switch + blur chips, low-end line kept). Picking a colour calls only setGlass (no setOn); selection no longer depends on `on`. Glass off: `restoreSurf = savedOn ? 'flat' : look.surf`. If the saved surface is glass, the previous non-glass surface is lost (LookMix stores one `surf`): falls to flat; acceptable per "if one can be known". Edge: a saved non-glass surf is remembered only because the draft starts from it; fine. Confirm sends only changed fields; Cancel drops the draft; blurPicked/blurPending/chooseBlur intact.
- Rows: `glassValue` = "<tint> · Frosted" / "<tint> · No frost" (proper UTF-8 middle dot); Profile and Look read "Color & glass".
- Background also got accessibilityElementsHidden/importantForAccessibility (harmless).
- Layering fine: ThemeProvider imports `../state/device` (theme -> state; existing M8 chunk 4 change, not this chunk). No `any`.
- Encoding: scanned all 350 tracked + untracked-not-ignored files (src, docs, app.json, eas.json, .maestro, .github, scripts) with strict UTF-8 decode and mojibake patterns (Â·, â€, Ã, U+FFFD). No invalid UTF-8, no mojibake. Only hit: docs/build-reports/M6/chunk-04-calendar.md line 47 contains a literal U+FFFD inside prose describing an old bug (also in HEAD); not corruption.

Commands
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npx jest --silent` (full): Test Suites 74 passed / 74; Tests 885 passed / 885. No failures (Calendar/Glass did not time out this run).

## Fix (Opus)
Lead's ruling: on flat/raised/outline, page text sits straight on the blobs (13 px sub lines, accent links like "‹ Profile", error text), so ink, muted, accent and danger must all hold 4.5:1 there. Chunk 3's 3:1 allowance applies only to text on a frost card over the palest glass blob.

Why one smaller number does not work:
- On the light palettes, accent on bare bg is already at the line: Mist 4.55, Sunrise 4.53, Lagoon 4.55, Lavender 4.57. Any blob darker than bg pushes accent below 4.5.
- Measured: the largest single strength (mixed toward bg) that passes is 0–1% on Sunrise and 1% on Mist, Lagoon and Lavender. Even a per-palette number leaves those four with no visible colour. Mono passes up to 35% and Night up to 36%.

What I did instead (`src/theme/buildTheme.ts`, `calmPageBlob`):
- The calm base is whichever of bg or surface is farther in luminance from ink. Light palettes use surface (#fff), so the blob keeps its hue and stays at least as light as the page. Night uses bg.
- Each blob gets the highest strength from `PAGE_BLOB_STRENGTH` (still 45, now a ceiling) down to 0 that keeps ink, muted, accent and danger at 4.5:1 or above. This runs per palette × tint × blob, so only a dark blob next to borderline text is calmed further.
- Strengths that result:
  - Mono and Night: mostly 45 (Night clear/arctic about 31–38).
  - Mist, Lagoon and Lavender: 11–45, about 15–25 for typical tints. Match, accent, milk and arctic stay at 45.
  - Sunrise: 9–45, about 12–20 typical. Midnight is the lowest at 9.
- Lowest ratios over all palettes × tints × flat/raised/outline × blobs:
  - ink 7.05 (night/candy)
  - muted 4.50 (mono/midnight)
  - accent 4.50 (mist/midnight)
  - danger 4.73 (mono/midnight)
  Before the fix: ink 5.71, muted 3.65, accent 3.23, danger 3.90.
- Glass surfaces are unchanged: full-strength blobs, frost, and chunk 3's rules.
- Comment fixed: the 45% is applied to the glass blob, which is already mixed at the tint's own `bs`. So the tint's effective share is at most bs × 0.45, and lower where the contrast guard steps in.
- Caveat: blob centres on light palettes are now slightly paler than bg (tinted white), not darker. If more colour is wanted on Sunrise and similar palettes, the remaining lever is darkening those palettes' `accent` and `muted` tokens. That is a palette change for the lead to decide; this fix does not make it.

Tests:
- `contrast.test.ts`: on non-glass surfaces, ink, muted, accent and danger must be at least 4.5 (AA) over every blob. A new assertion checks the blobs are calmed (not equal to the glass blobs). The decision comment now states that 3:1 is only for text on a frost card.
- `theme.test.ts`: dropped the self-comparisons. It now checks that glass `backdrop.blobs` equals `glass.blobs`, flat blobs differ from glass blobs, raised and outline equal flat, and the chain on raised, outline and flat equals the chain on glass.

Commands:
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npx jest src/theme`: 4 suites, 58 tests passed.
- Full `npx jest --silent`: 74 of 74 suites and 885 of 885 tests passed, with no failures.

## Re-check
**Verdict: PASS.**

Errors: none.

Verified
- `calmPageBlob` is deterministic: pure integer loop s = 45..1, colorMix/contrastRatio only, no randomness; falls back to the base colour (a valid hex) if nothing passes. Strength is always an integer in [1,45], so no NaN or negative. A scan of all 6 palettes x all tints (flat) found every blob a valid #rrggbb and min muted/accent ratio 4.5001.
- Cost: worst case 45 steps x 4 contrasts x 3 blobs = 540 contrast calls per buildTheme (typically far fewer, it exits at the first passing strength). Measured 168 builds in about 1.4 s including jest warm-up (about 8 ms each worst, probably less warm). Acceptable, but not free: buildTheme runs on every look change, so memoising per (pal, glass) would be a cheap optimisation if look changes ever feel slow. Not blocking.
- Glass untouched: `isGlass ? blobs : ...calmPageBlob`; `glass.blobs` and frost unchanged.
- contrast.test: for every palette x glass tint x flat/raised/outline, asserts ink/muted/accent/danger >= 4.5 over every backdrop blob, solid card, and that blobs differ from the glass blobs. If calmPageBlob were removed, blobs would equal glass blobs and contrast would fail (previous report: muted 3.65, accent 3.23). The 3:1 SECONDARY only applies in the glass-tint test (text on frost card over blob).
- theme.test: glass backdrop.blobs equal glass.blobs; flat blobs differ from glass; raised/outline equal flat; chain equal across surfaces; different tint changes blobs. Meaningful (the calm-vs-glass inequality would fail without the fix).
- Hand check 1: mist/midnight flat, accent #397c68 (L about 0.1627) on blob #f1f5f8 (L about 0.9078): (0.9578)/(0.2127) = 4.50, matches the computed 4.5001. Hand check 2: same accent on the lighter blob #f5f5f9 computed 4.536 (consistent, lighter blob gives higher ratio).

Commands
- `npx tsc --noEmit`: clean (exit 0).
- `npm run lint`: clean (exit 0).
- `npx jest --silent` (full): Test Suites 74 passed / 74; Tests 885 passed / 885. No failures.
