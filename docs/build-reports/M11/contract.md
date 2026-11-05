# M11 contract · Personal best (3D)

Same rules as M9 and M10 (`../M9/contract.md`): layering, worklets, reuse the kit unchanged.

**Data rule (user, 2026-11-02):** everything a moment shows is the user's real stored data. Empty days are 0.

Look (bench `best` scene, `scratchpad/moments3d.js` lines 1-45): a skyline of the 13 days before today plus today, a
glass plane at the previous best, today's gold column rising and breaking through the glass, the sun's ring (with its
opening) spreading on the glass where it broke, `BEST H:MM` on the glass, today's `H:MM` and `+H:MM` beside the column.

## Chunk 1 · Best data
Files: `src/domain/moments.ts`, `src/state/moments.ts`, `src/domain/__tests__/moments.test.ts`,
`src/state/__tests__/moments.test.ts` (only if a fixture needs the renamed input), `src/state/__tests__/bestData.test.ts` (new).

```ts
// MomentsInput: replaces `earlierDayFocusMs: number[]`
/** Focused ms of every earlier day that has any session, keyed by day (from `focusTotalsByDay`). */
earlierFocusByDay: Record<DayKey, number>;

// The best variant gains one field
| { kind: 'best'; todayMs: number; previousBestMs: number;
    /** Focused ms of the 13 days before today, oldest first (index 12 = yesterday). 0 for a day with no sessions. */
    recentMs: number[] }
export const BEST_RECENT_DAYS = 13;
```
- The best rule is unchanged: `earlierBest = max(values)`; plays when `earlierBest > 0 && todayMs > max(earlierBest, markers.bestMs)`.
- `recentMs` comes from `earlierFocusByDay[addDays(todayKey, -13 + i)] ?? 0`. Length always 13. Every value is
  `<= previousBestMs` (a test asserts it: the skyline stands under the glass by the data, never by clamping).
- `computeMomentsAfterClose` passes `focusTotalsByDay(...)` directly.
- **Data trace test** `bestData.test.ts` through the real actions (`at()` real hours, across 2026-11-01 DST): about
  three weeks of history with gaps (no row days, a checklist-only day = 0), a best day more than 13 days ago (so the
  glass is higher than every bar shown, and `previousBestMs` still comes from it), a running session at the close, a
  day that ties the best (no moment), then a close that beats it. Assert `todayMs`, `previousBestMs` and every entry
  of `recentMs` against hand-worked values in comments. Also: beating the best then closing a later day that beats
  yesterday's new best plays again with `previousBestMs` = yesterday.

## Chunk 2 · Best scene
Files: `src/ui/moments/bestScene.ts`, `src/ui/moments/Best.tsx`, `MomentsPlayer.tsx` (`best` -> `Best`), tests
`src/ui/__tests__/bestScene.test.ts`, `src/ui/__tests__/Best.test.tsx`.

```ts
export const BEST_SLOTS: number;      // worst case fits at every frame (test)
export const BEST_STILL_AT: number;   // camera eases to a stop; Scene3D freezes after the ring has faded
/** Column heights in scene units: 14 values (13 recent + today), v / top * 4.4 with top = max(today, best) * 1.1. */
export function bestHeights(recentMs: readonly number[], todayMs: number, previousBestMs: number): { bars: number[]; glass: number };
export function bestDraw(lt: number, size: Size, data: number[]): Prim[];   // data = [...recentMs, todayMs, previousBestMs]
```
- Floor grid, glass edges and the ring each go through `pushSegments` (one prim each). Today's column is GOLD, the
  others GRAPH; a zero day draws no column (never a made-up stub).
- Labels: `BEST ${formatHM(previousBestMs)}` on the glass (steel), `formatHM(todayMs)` (white) and
  `+${formatHM(todayMs - previousBestMs)}` (yellow) beside today's column. Headline `momentHeadline`, detail `momentDetail`.
- Tests: heights proportional to the data, a zero day has no column, today gold and only it, today is the only column
  above the glass, glass height = previous best, label texts exactly the moment's values, slots fit for all frames
  (including 13 non-zero days), frame identical after `BEST_STILL_AT`, the player shows `Best`, reduced motion draws
  the final frame, the worklet test passes. Renders checked by the lead at 390x844 and 320x568.
