# M7 chunk 6 · Favourites + confirm state

## Build (Sonnet)

### Purpose
Data layer for the Look screen's Favourites (max 5, auto-filled, seeded) and the Confirm flow. No screen behaviour changes (chunk 7).

### Files
- `src/theme/favourites.ts` (new, pure): `LookFavourite`, `MAX_FAVOURITES`, `SEED_FAVOURITES`, `sameLook` (moved), `autoName`, `normalizeFavourites`, `recordFavourite`, `setPinned`.
- `src/state/actions/look.ts`: `confirmLook`, `applyFavourite`, `setFavouritePinned` (settings key `lookFavourites`); `saveLook` unchanged.
- `src/state/hooks/useLookFavourites.ts` (new): reads the setting, invalidated by `bump('settings')`.
- `src/ui/lookNames.ts`: `sameLook` now imported from theme/favourites and re-exported.
- Tests: `src/theme/__tests__/favourites.test.ts` (new), `src/state/__tests__/look.test.ts` (favourites block, `ids` mocked).

### Connections now
LookScreen/ProfileScreen still use `sameLook`/`lookName` via `ui/lookNames` (unchanged behaviour). Actions use repos settings, `now()`, `newId()`, `bump`. Nothing calls the new actions/hook yet.

### Future connections
Chunk 7: LookScreen calls `useLookFavourites`, `applyFavourite`, `setFavouritePinned`, `confirmLook`; GlassScreen calls `confirmLook`; Profile's Look value uses the favourite name equal to the current look; then `LOOK_PRESETS`/`lookName` can go.

### Decisions
- Favourites list order in storage is the MRU order (new/moved entry goes to index 0), so the hook returns it as stored and eviction takes the last unpinned entry.
- `usedAt` typed `number` in theme (no domain import, keeps theme pure).
- `normalizeFavourites`: non-array -> seeds; an empty array stays empty (valid user state would not occur, but is not re-seeded); entries with duplicate id or equal mix are dropped.
- `confirmLook`/`applyFavourite` record the post-normalize look from the store; `applyFavourite` with unknown id is a no-op.
- All-pinned + new look: look still applies, list unchanged.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- jest: favourites.test + look.test pass (19); LookScreen and ProfileScreen suites pass (full 5-suite run: 51 pass; the 1 failure was a bad fixture in my new cap test, fixed and rerun green).

### Known limitations + phone checks
- No UI yet; nothing to check on the phone until chunk 7.
- The hook parses the setting on every `settings` bump (cheap; 5 entries).

## Check (Sonnet)
Verdict: PASS

Independently ran: typecheck clean, lint clean, jest (theme, look.test, LookScreen, ProfileScreen) 5 suites / 52 tests green.

ERRORS: none.

Verified against contract: seed order/names/ids seed-1..5/usedAt 0 (Night owl glass = DEFAULT_LOOK, presets normalized); normalizeFavourites (non-array -> seed, invalid dropped, mixes normalized, dedupe by id and equal mix keeping first, cap 5); recordFavourite (equal -> top keeping name/pin; new -> top, autoName, unpinned; >5 evicts last unpinned, which is the LRU since order is most-recent-first and index 0 is never evicted; all pinned -> list unchanged); autoName from tokens; setPinned; confirmLook records the saved (normalized) store mix; applyFavourite no-ops on unknown id and moves to top; key 'lookFavourites'; bump('settings'); hook keyed on settings version; theme file pure, repos/now/newId only in state. Tests exercise each behaviour.

NOTES:
1. A stored [] stays empty (only absent/non-array reseeds). Judged safe and intended: it respects a deliberate empty state and the next confirm adds an entry; only effect is no way to get seeds back short of clearing the setting.
2. SEED_FAVOURITES is not itself de-duplicated; fine today because the 5 looks are distinct (asserted by a test).
3. normalizeFavourites trusts stored order rather than sorting by usedAt; consistent because all writers keep the array ordered.
4. Chunk 7 must still migrate LookScreen off LOOK_PRESETS (it still imports it); out of chunk-6 scope.
