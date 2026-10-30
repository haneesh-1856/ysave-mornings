# M7 contract — Look settings

Binding interface between the M7 chunks. Sources of truth: `docs/06-design-system.md` (look mix, surfaces, collection
renderers, motion); `docs/05-screens-and-navigation.md` (`/settings/look`, Profile rows); `src/theme/tokens.ts` (all
option values, ported verbatim in M0); the prototype `../drafts/ysave-style-lab.html` (`jarSVG`, `gardenSVG`,
`EXTRA_ART`, `scrToday` layouts, `scrGlass`, `glassSwatch`, `DIMS`, `PRESETS`, CSS `.p-gpick`, `.p-hero`, `.p-dock`,
`.p-jar`). M1–M6 contracts hold: screens use state hooks/actions only (never `src/data` / `getDb`); errors from
`@/state/errors`; Reduce Motion makes every animation instant (`useMotion`); tests that cross a completion with fake
timers use `doNotFake: ['queueMicrotask']`; run jest with a timeout. Paths are relative to `mobile/`.

**M7 is done when:** every style-lab option is pickable in Profile and applies everywhere.

**Run-level decisions (lead):**
- A look change applies **instantly** and is saved on every tap (no confirm button: it's cosmetic and fully
  reversible; the day-start confirm exists because it changes when days end).
- The 12 option groups and 6 presets come from `tokens.ts` only. No option is invented or dropped. `trans: 'expand'`
  stays a fade (shared-element transitions are later work).
- Builders run only their targeted tests; the lead runs the full suite after each pair of chunks.

## Chunk 1 · Saved look + theme plumbing (`src/state`, `src/theme`, `src/app/_layout.tsx`, `src/ui/Card.tsx`, `src/ui/collectionNoun.ts`)

```ts
// state/actions/look.ts (new)
saveLook(patch: Partial<LookMix>): void
  // next = normalizeLook({ ...current, ...patch }); setSetting(db, 'look', next, now()); store <- next; bump('settings')
loadLook(): void
  // store <- normalizeLook(getSetting(db, 'look'))  (absent/corrupt -> DEFAULT_LOOK, field by field)
// theme/ThemeProvider.tsx
<ThemeProvider look?: LookMix>   // optional override (Look screen's mini preview); without it, reads the store
// theme/buildTheme.ts
buildTheme(look: LookMix, opts?: { reduceTransparency?: boolean })
  // glass gains `blur: boolean` (false when reduceTransparency); blobs + frost unchanged
// ui/collectionNoun.ts (new, pure)
collectionNoun(art: LookMix['art']): string          // 'jar', 'garden', 'sky', … 'stamp card'  (tokens.collectionNouns)
unitNoun(art: LookMix['art'], n: number): string      // n === 1 ? unit : unit === 'leaf' ? 'leaves' : unit + 's'
```
- Startup: after migrations succeed, `loadLook()` runs before the first app screen renders and the splash stays up
  until it has. **No frame may show the default look when a different look is saved.** The migration-error screen
  still renders (default look).
- `useLookStore.setLook` stays for the state layer; screens never call it. The Profile "Try a look" list switches to
  `saveLook` now (chunk 5 replaces the list).
- Reduce transparency: `ThemeProvider` reads `AccessibilityInfo.isReduceTransparencyEnabled()` and listens to
  `reduceTransparencyChanged` (iOS; Android stays false). `Card` skips the `BlurView` when `t.glass.blur` is false and
  keeps the frost tint.
- Tests: saveLook persists and normalizes (unknown keys/values dropped); loadLook with absent, corrupt, partial and
  full JSON; the override provider renders its own look; nouns for all 12 looks incl. 'leaves' and 'stamp card(s)';
  Card without blur under reduce transparency.

## Chunk 2 · Collection renderers A (`src/ui/collection`)

Every renderer is a component taking the existing `CollectionProps` (`items, closed, scale, animateLast, animateLid`)
and is drawn with react-native-svg from the prototype geometry (same viewBox numbers, `var(--p-x)` -> `t.c.x`, topic
color -> `t.topic(item.colorKey).color`, `small` / `gold` from the item).

```ts
// collection/kit.tsx (new, shared by every renderer)
type Arrival = 'drop' | 'grow' | 'pop' | 'stamp' | 'flicker';
useArrival(kind: Arrival, lastKey: string | null, enabled: boolean, scale: number): AnimatedStyle
  // plays once per new lastKey (and once on mount), never on a plain re-render; instant under Reduce Motion
  // drop: from above with the motion easing; grow: scale from the base; pop: 0 -> 1.35 -> 1;
  // stamp: 2.2 -> 0.92 -> 1; flicker: opacity 0 -> 1 -> .3 -> 1
useClosedDecoration(closed: boolean, enabled: boolean): SharedValue<number>
  // 0..1; mounting closed shows it at 1; only a later false -> true flip animates (when enabled); reopening is instant
capOf(items, cap): { shown: CollectionItem[]; overflow: number }   // first `cap` items; "+N" text when overflow > 0
collectionLabel(art, n, closed): string    // "<Noun> with N <units>[, closed]", e.g. "Garden with 3 flowers, closed"
// collection/Jar.tsx: gains `variant: 'glass' | 'line' | 'paper'` (default 'glass'; current drawing unchanged)
// collection/Garden.tsx, Plant.tsx, Sky.tsx, Bracelet.tsx (new)
```
- The newest item is drawn in its own `Animated.View` overlay (the Jar pattern; no animated SVG props). It animates
  only when `animateLast` and `overflow === 0`.
- Sizes: jar variants 70 x 96 pt at scale 1 (viewBox `0 -12 70 98`); every other look 110 x 96 pt (viewBox
  `0 -12 110 98`).
- Capacity (items drawn before "+N"): jars 8 (existing `layoutJar`), garden 7, plant 8, sky 12, bracelet 12.
- Closed decoration per prototype: jars = lid (existing lid logic for all three variants; line variant uses the
  outlined lid), garden = moon, sky = moon, bracelet = closed ring + clasp, plant = bloom. When `animateLid`, the
  decoration animates in with `useClosedDecoration`; otherwise it renders as is.
- Arrival: jars + bracelet = drop; garden + plant = grow; sky = pop.
- `Collection.tsx` dispatches on `t.look.art` for the looks built so far; the rest fall back to the glass jar until
  chunk 3. The accessible label comes from `collectionLabel`.
- Tests per renderer: 0 / 1 / cap / cap + 3 items (overflow text), small + gold variants, open vs closed decoration,
  label text, arrival plays once per new item and not on re-render, instant under Reduce Motion.

## Chunk 3 · Collection renderers B (`src/ui/collection`)

`Cairn.tsx`, `Lights.tsx`, `Honey.tsx`, `Shelf.tsx`, `StampCard.tsx`, using chunk 2's kit unchanged.
- Capacity: cairn 9, lights 12, honey 12, shelf 8, card 10.
- Closed: cairn = top stone (accent), lights = moon, honey = bee, shelf = bookend, card = "DAY CLOSED" stamp text.
- Arrival: cairn + shelf = drop; honey = pop; card = stamp; lights = flicker.
- `Collection.tsx` now covers all 12 looks (no fallback left except `normalizeLook`'s default).
- Tests as chunk 2, plus one table test rendering all 12 looks with 0 and cap + 1 items, open and closed, under
  a ThemeProvider override per look (no crash, correct label).

## Chunk 4 · Apply the look everywhere (`src/screens`, `src/ui`)

- **Today home layout** (`t.look.layout`, prototype `scrToday`):
  - `dock`: as now (collection in the bottom dock, with "Today's <noun> / N <units>" and a small Close button when
    the day can close).
  - `corner`: no dock. Below the task list, a row: "Close today" ghost button on the left; on the right a label
    "TODAY'S <NOUN> · N" over the collection at scale ~0.62.
  - `hero`: no dock. The collection at scale 1 centred under the header with "N in today's <noun>", then the task
    list, then "Close today" at the bottom.
  - Close-button rules (hidden when closed or empty) and the dock's tap behaviour stay as they are now.
- **Nouns** in every user-visible string that names the collection or its items use `collectionNoun` / `unitNoun`:
  Dock and Today, Close, Morning, Planned, Run, Profile's third stat label, Calendar legend and day card, a11y labels.
  Data and domain names (`marbles` fields etc.) do not change.
- **Audit:** no hard-coded radius, font family, surface style or motion duration in `src/screens` / `src/ui` where the
  theme has one (`t.radius`, `T`/`t.font`, `Card`/`t.card`, `useMotion`). Fixed literals that are part of a drawing
  (SVG geometry) or a documented exception (error red `#d4574e`) stay. List every change in the report.
- Tests: Today in each layout (collection position, Close button present/absent), noun copy under at least the
  garden and stamp-card looks, existing screen tests keep passing.

## Chunk 5 · Look + Glass screens (`src/screens`, `src/app/settings`, `src/ui`)

- **`/settings/look`** (`LookScreen`, route `src/app/settings/look.tsx`): "‹ Profile" back (same pattern as Day start).
  - Top: a live mini preview inside `<ThemeProvider look={current}>` (a sample task Card, a `CountdownBar` in the
    current bar style, the collection at small scale with 3 sample items, the tab-bar style). It follows every tap.
  - "Presets": the 6 `tokens.presets` + "Your saved mix" (`DEFAULT_LOOK`) with 4-dot swatches; the matching one is
    marked. Tapping one calls `saveLook(normalizeLook(preset.mix))`.
  - One section per option group in prototype `DIMS` order and wording (title + hint), each a `ChipSet` (or swatches
    for colors) of the option names from tokens. Glass tint and Glass blur are a single "Glass" row that pushes
    `/settings/glass` (value: tint name, or "Off").
- **`/settings/glass`** (`GlassScreen`, route `src/app/settings/glass.tsx`), prototype `scrGlass`:
  - "Frosted glass" switch: on -> `surf: 'glass'`; off -> `surf: 'flat'`.
  - Tint grid of all 28 `glassTints` (a swatch built like `glassSwatch` with the theme's `colorMix`, name under it).
    Picking a tint also turns glass on. Blur: `ChipSet` of the 5 `glassBlurs`.
- **Profile**: "Look" row -> `/settings/look` (value: preset name or "Custom"); "Glass" row -> `/settings/glass`
  (value: tint name or "Off"). Remove the "Full settings in M7" line and the M0 "Try a look" card.
- Every control is a button/switch with an accessible label and selected state; touch targets ≥ 44 pt.
- Tests: each group's chip calls `saveLook` with the right patch and the screen re-renders in the new look; preset
  marking incl. "Custom"; glass switch on/off; tint pick turns glass on; Profile rows navigate and show values;
  Android back returns to Profile.

## Chunks 6–7 · Phone-check changes (user, 2026-10-30)

User decisions: each aspect is its own drop-down with a **Confirm** (replaces the run-level "instant" decision for the
Look and Glass screens); "Your saved mix" goes; the presets list becomes **Favourites**: at most 5 looks, filled
automatically, seeded with the style-lab mix + 4 ready-made presets.

### Chunk 6 · Favourites + confirm state (`src/theme`, `src/state`)

```ts
// theme/favourites.ts (new, pure)
type LookFavourite = { id: string; name: string; mix: LookMix; pinned: boolean; usedAt: Epoch };
const MAX_FAVOURITES = 5;
SEED_FAVOURITES: LookFavourite[]  // in order: 'Night owl glass' (DEFAULT_LOOK), 'Morning mist', 'Sunrise jam',
                                  // 'Lagoon glass', 'Lavender journal' (tokens.presets mixes, normalized); ids 'seed-1'..'seed-5'; usedAt 0
normalizeFavourites(input: unknown): LookFavourite[]  // absent -> SEED; drops invalid entries, normalizes mixes,
                                                      // de-duplicates equal mixes (keeps first), caps at 5
recordFavourite(list, mix, at, newId): LookFavourite[]
  // equal mix already in the list -> it moves to the top (usedAt = at); name and pin kept
  // else new entry at the top { name: autoName(mix), pinned: false, usedAt: at }; if > 5, remove the
  //   least recently used UNPINNED entry; if all 5 are pinned, the list is unchanged (the look still applies)
autoName(mix): string   // '<palette name> · <collection name>', e.g. 'Night owl · Garden' (names from tokens)
setPinned(list, id, pinned): LookFavourite[]
sameLook(a, b): boolean // moved here from ui/lookNames.ts (ui re-exports or imports it)
// state/actions/look.ts
confirmLook(patch: Partial<LookMix>): void   // saveLook(patch) then favourites <- recordFavourite(..., the saved mix)
applyFavourite(id: string): void            // saveLook(fav.mix) + recordFavourite (moves it to the top)
setFavouritePinned(id: string, pinned: boolean): void
// state/hooks/useLookFavourites.ts
useLookFavourites(): LookFavourite[]        // ordered most recently used first; bump('settings') invalidates
```
- Stored under settings key `lookFavourites` (JSON). `saveLook` stays as is (no favourite) for internal callers.
- Tests: seed on absent/corrupt, de-dup, move-to-top, cap with LRU unpinned eviction, all-pinned no-op, pin toggle,
  autoName for a few mixes, confirmLook/applyFavourite persist both look and favourites.

### Chunk 7 · Look + Glass screens with drop-downs and Confirm (`src/screens`, `src/ui`)

- **Look screen** (top to bottom): live mini preview of the **draft** (current look + the open row's pending pick);
  **Favourites**: the list from `useLookFavourites()` (swatch dots, name, the current one marked, a pin button with
  label "Pin <name>"/"Unpin <name>" and selected state); tapping a favourite calls `applyFavourite` (it is a whole
  saved look, so no extra confirm). Then the 12 aspects in DIMS order (Glass tint + blur stay one "Glass" row that
  pushes `/settings/glass`).
- **Each aspect row** is collapsed by default, showing its title and current value (›). Tapping opens it (only one
  open at a time; opening another discards the first's pending pick). Open: the hint, the options, then **Confirm**
  (disabled until the pick differs from the current value) and **Cancel**. Picking only changes the preview.
  Confirm -> `confirmLook({ [key]: value })`, row closes. Cancel / closing the row / leaving the screen discards.
- **Glass screen**: the same draft + Confirm pattern for the whole screen: the switch, tint and blur set a draft
  shown in a small preview card; **Confirm** (disabled when unchanged) calls `confirmLook` with the changed fields;
  leaving without confirming changes nothing.
- **Profile**: Look row value = the name of the favourite equal to the current look, else "Custom".
- Remove "Your saved mix" and the old presets section. Fix the carried notes in these files: Look chips must not
  announce "double tap to clear" (`ChipSet` gets `clearable={false}`), the layout hint follows the collection noun.
- Tests: open/close rows, one open at a time, preview shows the pending pick while the app theme doesn't change,
  Confirm saves + adds a favourite, Cancel discards, favourites tap applies, pin toggles, Glass draft + Confirm, leaving
  discards, Profile value.
