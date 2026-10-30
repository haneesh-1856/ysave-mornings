# M7 build run — Look settings

Started 2026-10-30. Done when (roadmap): every style-lab option is pickable in Profile and applies everywhere.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors → Sonnet re-check.
Interfaces: [contract.md](contract.md).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Saved look + theme plumbing (persist, load before first frame, preview override, reduce transparency, nouns) | M0–M6 | [chunk-01](chunk-01-look-state.md) | PASS (no fix needed) |
| 2 | Collection renderers A (kit, jar variants, garden, plant, sky, bracelet) | M3–M5 ui | [chunk-02](chunk-02-renderers-a.md) | PASS (no fix needed) |
| 3 | Collection renderers B (cairn, lights, honeycomb, shelf, stamp card) | 2 | [chunk-03](chunk-03-renderers-b.md) | PASS (no fix needed) |
| 4 | Apply everywhere (Today layouts, nouns in copy, theme audit) | 1, 3 | [chunk-04](chunk-04-apply.md) | PASS (no fix needed) |
| 5 | Look + Glass screens, Profile rows | 1, 3 | [chunk-05](chunk-05-screens.md) | PASS (no fix needed) |
| 6 | Phone check: favourites (max 5, automatic, pinnable) + confirmLook state | 1, 5 | [chunk-06](chunk-06-favourites.md) | PASS (no fix needed) |
| 7 | Phone check: drop-down per aspect with Confirm; Glass draft + Confirm | 6 | [chunk-07](chunk-07-dropdowns.md) | PASS (no fix needed) |

## Requirements carried in
- From M6: `setDayStart` one `at`; live Plan→Edit test on Calendar; more Profile/DayStart tests; Day start
  `router.back()` fallback; Calendar cells < 44 pt below ~340 dp; CalendarScreen test timeouts under load;
  NOT_PLANNABLE copy; empty-draft hint; stale test title CalendarScreen.test.tsx:180. Profile tests are taken into
  chunk 5 (same file); the rest stay carried unless a chunk touches the file.
- M5 check 2 and M6 check 16 are still open with the user (phone).

## Run-level decisions
See contract: looks apply instantly (no confirm); options only from tokens; `expand` stays a fade.

## Requirements carried forward
- Fixed in chunk 7: ChipSet `clearable={false}` on Look/Glass; layout hint follows the noun.
- Tests: ChipSet default clear path; favourites can't be reseeded once stored as [] (intended).
- GlassSwatch: comment the white inner border literal; gradient ids repeat across swatches (fine on native).
- Tests: preview-follows-tap; DIMS order; squeeze geometry (cairn/shelf); live reduce-transparency listener;
  `_layout.tsx` startup; arrival replay if `animateLast` flips with the same item; inner SVG not explicitly hidden
  from screen readers (outer view carries the label).
- Device checks: tilted "DAY CLOSED" stamp text; bottom row of fairy lights clipped like the prototype; dock is now
  a floating card in the current surface (visual change).

## Result (2026-10-30)
All 7 chunks PASS on the first check (6–7 from the user's phone check); no Opus fix needed. Lead: 1 stale comment fixed (ThemeProvider).
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 66 suites, 788 tests (after chunk 7), 98.4 % lines, domain 100 % lines.
No screen, route or ui file imports `src/data` or `getDb`. **Phone check passed 2026-10-30 (after chunks 6–7). M7 done.**

Phone check (2026-10-30): user asked for a drop-down + Confirm per aspect, no "Your saved mix", and an
automatic favourites list of 5 (seeded, pinnable) → chunks 6–7.
