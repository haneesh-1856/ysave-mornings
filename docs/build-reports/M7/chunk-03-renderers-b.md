# M7 · Chunk 3 · Collection renderers B

## Build (Sonnet)

### Purpose
The last five collection looks (cairn, lights, honey, shelf, stamp card), so all 12 looks render and `Collection` has no fallback left except `normalizeLook`'s default (glass jar).

### Files
- `src/ui/collection/Cairn.tsx`, `Lights.tsx`, `Honey.tsx`, `Shelf.tsx`, `StampCard.tsx` (new), each a `Frame` from the chunk 2 kit (kit unchanged; no new helper).
- `src/ui/collection/Collection.tsx`: dispatches all 12 looks.
- `src/ui/collection/__tests__/renderers.test.tsx`: five more rows in the per-renderer suite, dispatch cases for all new looks (+ glass), the 12-look table test, and a stronger overflow assertion.

### Connections now
- `Collection` reads `useTheme().look.art`; geometry from the prototype `EXTRA_ART` (`var(--p-x)` -> `t.c.x`, topic color -> `t.topic(item.colorKey).color`, `small`/`gold` from the item).
- Capacity / closed decoration / arrival / test ids: cairn 9 / top stone `cairn-top` / drop; lights 12 / moon `lights-moon` / flicker; honey 12 / bee `honey-bee` / pop; shelf 8 / bookend `shelf-bookend` / drop; card 10 / "DAY CLOSED" `card-stamp` / stamp. Overflow ids `<art>-overflow`; gold: `gold-<i>` (cairn, honey, shelf) or `gold-ring` (lights, card).

### Future connections
- Chunk 4 places `Collection` in the layouts and may switch `collectionLabel` to `collectionNoun.ts`.
- Chunk 5's Look preview renders `Collection` under `<ThemeProvider look={...}>` (covered by the table test).

### Decisions
- Cairn: the prototype stack (up to 9 x 13 units) would pass the viewBox top. Stone half-heights are multiplied by one factor `min(1, 89 / total)` so the top stone fits (only bites at about 7+ big stones). The top stone sits at the top of the drawn stack.
- Shelf: 8 big books + gaps (92) plus the 13-wide bookend would pass the shelf end (x 104). Widths and gaps are squeezed by `min(1, 79 / total)` (only at 8 big books, ~86%).
- Lights and honey positions repeat (`i % n`), but cap equals the table length so nothing overlaps.
- "+N" positions are my choice: cairn (96,60), lights/honey (100,84), shelf (96,20), card (96,72).
- Card spots, cairn/shelf/honey gold marks etc. follow the prototype; `#fff` highlights kept as in the prototype.
- Tests: the chunk 2 checker note 2 is addressed by counting `pointerEvents="none"` views in the rendered JSON (overlay present at cap, fewer when over cap). Note 3 (a11y hiding of descendants) and note 1 not touched (outside this chunk).
- Table test uses `render` + `ThemeProvider look` directly (one mount at a time; `unmount` must be awaited or act calls overlap).

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `timeout 300 npx jest src/ui/collection`: 3 suites, 118 tests passed.

### Known limitations + phone checks
- Not run on a device; animations are only tested through the mocked `animate`.
- Check 1: pick each of the five looks (Profile > Try a look) with 1, 5 and a full set of tasks; nothing leaves the 110 x 96 box (cairn at 9 and shelf at 8 especially).
- Check 2: closing the day adds the accent top stone / moon / bee / bookend / "DAY CLOSED" stamp.
- Check 3: a new item drops (cairn, shelf), pops (honey), stamps (card) or flickers (lights); Reduce Motion makes all instant.
- Check 4: gold items show the dashed sun mark.

## Check (Sonnet)

**Verdict: PASS**

Independent runs: `npm run typecheck` clean, `npm run lint` clean, `npx jest src/ui/collection` 3 suites / 118 tests pass.

### ERRORS
None.

### NOTES
1. Contract points verified against the code. Capacities are cairn 9, lights 12, honey 12, shelf 8, card 10. Closed decorations are the accent top stone, the moon, the bee, the bookend and the "DAY CLOSED" text. Arrivals are cairn and shelf drop, honey pop, card stamp, lights flicker. All five use the unchanged kit `Frame`. `Collection` dispatches all 12 looks, with `glass` as the default jar and `line` and `paper` as jar variants. Colors come from the theme only, apart from the `#fff` highlight on cairn stones.
2. Cairn squeeze math is correct.
   - ROOM is 89, so the stack top is at 84 - 89 = -5 at the worst case.
   - The top stone is then at cy = -8 with ry 4, so its top edge is exactly -12, on the viewBox edge.
   - The squeeze is a no-op up to 6 big stones (78 units). It first bites at 7 big stones (91 units), as documented.
   - Gold rings and the highlight stay inside.
3. Shelf squeeze math is correct.
   - At 8 big books the total is 92 and f = 79/92, so the end is 12 + 79 = 91.
   - The bookend spans x 92 to 104, which is the shelf end (6 + 98).
   - It is a no-op up to 6 big books (69 units); 7 big books (80.5) squeeze slightly.
   - The tallest book tops out at y 27, inside the viewBox.
4. Honey, card and lights geometry matches the prototype. Honey's extents (x about 26 to 102.5, y about 10 to 82) and the bee at y -8 are inside the viewBox. The card's "DAY CLOSED" text and the "+N" at (96,72) sit side by side on the same line when both show. This is tight but not clipped.
5. Lights are faithful to the prototype, including a prototype quirk. The bottom row's bulbs (wire base 70, y = 77.5 + 9) have centre y 86.5, so their glow (r about 10) and the lower half of the bulb extend past the viewBox bottom at y 86 and are clipped. The builder kept this to match the prototype. It is a possible cosmetic nit on a device but not a defect against the contract.
6. The card's `SvgText` uses `rotation` and `origin` props. These pass typecheck, but I could not confirm the -4 degree tilt renders on a device. It is worth a check on a device.
7. Test gaps, not contract failures.
   - No test checks the squeeze geometry, so a regression in `stack()` or `row()` would pass. Exporting and asserting that the cairn top and shelf bookend stay inside the viewBox would be stronger.
   - Per-art gold test ids (`gold-<i>` and `gold-ring`) are not asserted. The gold test only checks that the item renders.
   - The table test's label assertion uses `collectionLabel` itself, so it is partly tautological. The separate dispatch table does assert literal strings.
   - The table test's jar caps are listed as 8, but a cap + 1 count overflows regardless.
   - The overflow-overlay assertion via `pointerEvents` count is meaningful.
8. Labels are "Cairn/Lights/Honeycomb/Shelf/Stamp card with N stone/light/cell/book/stamp(s)[, closed]". They match the kit's wording. Accessibility is the kit's `accessible` View with `role=image`, unchanged.
