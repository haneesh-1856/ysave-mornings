# M7 · Chunk 7 · Look + Glass drop-downs with Confirm

## Build (Sonnet)

### Purpose
The Look screen no longer shows every option at once. Each aspect is a collapsed row that opens into its options with Confirm / Cancel; a Favourites list (max 5, filled automatically) replaces "Presets" / "Your saved mix". The Glass screen uses one whole-screen draft with a single Confirm.

### Files
- `src/screens/LookScreen.tsx`: draft preview, Favourites (apply + pin), 11 aspect rows (10 drop-downs + the Glass row that pushes `/settings/glass`), one open at a time.
- `src/screens/GlassScreen.tsx`: draft (switch, tint, blur), small `GlassPreview` card under a `ThemeProvider look` override, Confirm / Cancel.
- `src/screens/ProfileScreen.tsx`: Look row value from `useLookFavourites()`.
- `src/ui/lookNames.ts`: `LOOK_PRESETS` and `LookPreset` removed; `lookName(look, favourites)` = matching favourite's name else "Custom"; `glassValue` kept. `sameLook` is no longer re-exported (imported from `theme/favourites`).
- `src/ui/ChipSet.tsx`: `clearable` prop (default true = old behaviour).
- Tests: `LookScreen.test.tsx` (rewritten, 21 cases), `GlassScreen.test.tsx` (rewritten, 8), `ProfileScreen.test.tsx` (Look value from favourites). `LookPreview.tsx` and `GlassSwatch.tsx` unchanged (not needed).

### Connections now
- LookScreen -> `useLookFavourites`, `applyFavourite`, `setFavouritePinned`, `confirmLook({[key]: value})`; GlassScreen -> `confirmLook(changed fields)`; ProfileScreen -> `useLookFavourites` + `lookName`.
- Draft = `useMemo(normalizeLook({...look, [open]: pick}))` passed to `LookPreview look={draft}`; the app theme (store) changes only on Confirm / favourite tap.
- Screens import no `src/data` / `getDb`.

### Future connections
- A later "reset favourites" or rename would use the same favourites actions.

### Decisions
- "12 rows": 10 aspects + the merged Glass row = 11 rows (Glass tint and blur are one row, per chunk 5); the contract's "12 aspects" counts tint and blur separately.
- Row title no longer upper-case "label" text; rows read "<Title>, <value>" with `accessibilityState.expanded`.
- Tapping a favourite also closes any open row (discarding its pick).
- Glass Confirm stays on the screen (it disables itself once the look equals the draft); Cancel goes back. Confirm sends only changed fields; the switch only changes `surf` when it differs from the saved state (a saved "Bold outline" is not turned into "flat" by an unrelated blur pick).
- Layout hint uses `collectionNoun(look.art)` of the saved look (not the draft).
- Section label "CHANGE ONE THING" above the rows (small orientation label, not in the contract).
- Pin button is text ("Pin" / "Pinned"), 44 pt, label "Pin <name>"/"Unpin <name>", selected state.
- Tests mock `@/state/ids`: `expo-crypto` `randomUUID` gives no id under jest, so a new favourite was dropped by `normalizeFavourites`.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 300 npx jest LookScreen GlassScreen ProfileScreen src/ui`: 23 suites, 288 tests passed.

### Known limitations + phone checks
- Not run on a device.
- Check 1: open Typeface, pick one: the preview changes, the rest of the app does not; Confirm applies it everywhere and the row closes; Cancel / opening another row reverts the preview.
- Check 2: after a confirmed change a new favourite appears at the top (6th removes the oldest unpinned); pin one and it survives eviction; tapping a favourite applies it at once.
- Check 3: Glass screen: preview card follows the draft; Confirm is greyed until something changes; leaving with Back does not save.
- Check 4: screen reader announces rows "Colors, Night owl, collapsed/expanded" and options as radio buttons with no "double tap to clear".

## Check (Sonnet)

**Verdict: PASS**

Ran: typecheck clean, lint clean, jest (26 suites, 318 tests) pass. Grep: "Your saved mix" appears only in a negative assertion; `LOOK_PRESETS` gone (the remaining "saved mix" strings are a comment and a test title).

ERRORS: none.

NOTES
1. 11 rows (10 + merged Glass) matches the contract's intent (tint + blur merged into one Glass row pushing /settings/glass). Contract's "12" counts them separately.
2. Verified in code: draft is memoized and passed only to LookPreview; Confirm disabled when `!pick || pick === current`; confirmLook({[key]: pick}) then close; opening another row / Cancel / toggle closing / favourite tap (`close()` before `applyFavourite`) all clear the pick, so after applying a favourite the preview equals the app look; leaving unmounts local state. Expanded state, radio/selected, 44 pt present; favourite and pin labels and selected state correct.
3. Glass: surf only changes when the switch differs from saved (outline + blur-only keeps surf); tint pick sets on=true; after Confirm the saved look equals the draft, so Confirm disables again (no stale draft). Edge: with saved surf 'outline', pick tint then switch off ends with on === savedOn, so only the tint is sent and surf stays 'outline'. Harmless.
4. Glass Confirm staying on screen is fine. "CHANGE ONE THING" label is acceptable orientation text, not wrong.
5. Layout hint uses the saved look's collectionNoun (not the draft); fine, since the Collection row's pick is not saved yet.
6. ChipSet default (clearable=true) behaviour is unchanged in code; no dedicated ChipSet test of the default clear path was found, only the `clearable={false}` assertions in the Look and Glass tests (minor gap).
