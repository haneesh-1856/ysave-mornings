# M7 · Chunk 1 · Saved look + theme plumbing

## Build (Sonnet)

### Purpose
The look mix is saved to SQLite settings and restored at startup (no default-look frame), the theme can be overridden for a subtree, cards drop the blur under iOS Reduce Transparency, and collection nouns are available as pure helpers.

### Files
- `src/state/actions/look.ts` (new) — `saveLook(patch)`, `loadLook()`.
- `src/theme/ThemeProvider.tsx` — optional `look` override prop; reads/listens to Reduce Transparency.
- `src/theme/buildTheme.ts` — `opts.reduceTransparency`; `glass.blur`.
- `src/ui/Card.tsx` — `BlurView` only when `t.glass.blur`.
- `src/ui/collectionNoun.ts` (new) — `collectionNoun`, `unitNoun`.
- `src/app/_layout.tsx` — `loadLook()` once migrations succeed, before `ready`.
- `src/screens/ProfileScreen.tsx` — "Try a look" uses `saveLook`.
- Tests: `src/state/__tests__/look.test.ts` (5), `src/ui/__tests__/collectionNoun.test.ts` (2), `src/ui/__tests__/CardBlur.test.tsx` (3).

### Connections now
- `saveLook`: `useLookStore` -> `normalizeLook` -> `setSetting(db, 'look')` -> store -> `bump('settings')`.
- `loadLook`: `getSetting(db, 'look')` -> `normalizeLook` -> store. Called from `RootLayout`; splash stays until it ran.
- `ThemeProvider` -> `AccessibilityInfo` (`isReduceTransparencyEnabled`, `reduceTransparencyChanged`) -> `buildTheme(look, { reduceTransparency })` -> `Card`.

### Future connections
- Chunk 5 replaces the Profile list with the Look screen, which uses `saveLook` and `<ThemeProvider look={draft}>` for its preview.
- Collection renderers (chunks 2-4) use `collectionNoun` / `unitNoun`.

### Decisions
- `loadLook` runs during render with the "adjust state while rendering" pattern (`if (migrated && !lookLoaded) { loadLook(); setLookLoaded(true) }`): an effect would let the first frame render with the default look and the lint rule forbids setState in an effect.
- On a migration error `ready` skips the look wait, so the error screen renders with the default look.
- `useLookStore` lives in `theme/ThemeProvider.tsx`, so `state/actions/look.ts` imports it from there (state -> theme, no cycle).
- `isReduceTransparencyEnabled?.()` is optional-called so platforms/mocks lacking it stay false; rejection is ignored.
- Nouns read straight from `tokens.collectionNouns` (already "stamp card"); only the leaf plural is special-cased.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- Targeted jest (look, collectionNoun, CardBlur, src/theme, ProfileScreen): 5 suites, 26 tests passed.

### Known limitations + phone checks
- Not run on a device; Reduce Transparency is only exercised through a mocked `AccessibilityInfo`. `_layout.tsx` has no automated test.
- Check 1: In Profile pick another look, force-close and reopen: the saved look shows from the first frame (no flash of Night/glass).
- Check 2 (iOS): Settings > Accessibility > Display > Reduce Transparency on, glass cards stay tinted but unblurred; toggling while the app is open updates live.

## Check (Sonnet)

**Verdict: PASS.** typecheck clean, lint clean, targeted jest 4 suites / 15 tests passed (look, collectionNoun, CardBlur, ProfileScreen).

### ERRORS
None.

### Verified
- `saveLook` normalizes (`{...current, ...patch}` through `normalizeLook`), `setSetting('look')`, store update, `bump('settings')`. `loadLook` goes through `getSetting` (absent/corrupt return undefined, never throws) then `normalizeLook`.
- `buildTheme` adds `glass.blur = !reduceTransparency`. `Card` skips `BlurView` when false and keeps the frost tint. Nouns come from `tokens.collectionNouns`, with 'leaves' and 'stamp card'/'stamps'. Profile calls `saveLook`. No screen or ui file imports `src/data` or `getDb`.
- Startup: `setDb` runs before `loadLook`. `ready` needs fonts plus `lookLoaded`, so the splash stays until the look is loaded and `null` is returned before that, so no app frame has the default look. On a migration error `ready` ignores `lookLoaded` and `MigrationError` still renders with the default look. The guard `migrated && !lookLoaded` with `setLookLoaded(true)` runs once. `setState` on the component's own state during render is the sanctioned pattern, so there is no loop. The zustand `setState` fires while `ThemeProvider` and the screens are not mounted (`ready` is false and nothing else subscribes to `useLookStore` in app code), so there is no "update a component while rendering another" warning. In StrictMode the double render calls `loadLook` twice, which is idempotent. A render discarded before commit does no harm either.
- Reduce Transparency hook: the `live` flag stops the late promise from setting state after unmount, `sub.remove()` cleans up, and the initial value is false until the async result arrives. `?.()` plus the rejection handler keep Android and mocks safe. The override provider still calls the hook, so it picks up Reduce Transparency, and `useMemo` on `[look, reduceTransparency]` rebuilds only when needed.

### NOTES
1. `CardBlur.test.tsx` covers the initial async value but not the `reduceTransparencyChanged` listener (live toggle) or its cleanup. That is untested, though the code reads correctly.
2. The "full saved mix" test in `look.test.ts` uses `objectContaining` on pal and art only. It does not check that font and shape round-trip, so it is weaker than the contract's "full JSON" case.
3. The ProfileScreen test shows the UI switching but not that `saveLook` persisted, so only `look.test.ts` covers persistence. The `_layout.tsx` ordering has no automated test (the builder says so).
4. A `ThemeProvider look={...}` override with an inline object literal rebuilds the theme on every parent render, because `useMemo` depends on object identity. Chunk 5 should memoize its draft.
5. `useLookStore` is still exported with `setLook`, and the comment in `ThemeProvider.tsx` ("persisting arrives in M1") is stale.
