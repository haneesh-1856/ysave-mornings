# M10 contract · Streak (3D)

Binding interfaces between chunks. Same rules as M9 (`docs/build-reports/M9/contract.md`): `src/ui` and screens never
import `src/data` or `getDb`; only `src/state` calls repos, `now()`, `newId()`. Every function an animated callback
calls is a worklet (`src/ui/__tests__/momentsWorklets.test.ts`). Reuse the M9 kit (`three.ts`, `Scene3D`, `Label3D`,
`parts.tsx`); do not change its interfaces.

**Data rule (user, 2026-11-02):** everything a moment shows is the user's real stored data. No sample, padded or
invented values.

The streak moment already carries what it needs: `{ kind: 'streak'; days: number; endDayKey: DayKey }`. `days` is a
multiple of 7 (`STREAK_STEP`), `endDayKey` is the day just closed. Nothing is added to the moment.

## Chunk 1 · Streak data
Files: `src/domain/moments.ts`, `src/domain/__tests__/moments.test.ts`, `src/state/__tests__/streakData.test.ts` (new).

```ts
// src/domain/moments.ts
/** Steps the stair draws: the last min(days, STREAK_MAX_STEPS) days of the run. */
export const STREAK_MAX_STEPS = 21;
/** Weekday (0 = Monday .. 6 = Sunday, `weekdayIndex`) of each drawn step, oldest first; the last is endDayKey. */
export function streakWeekdays(m: Extract<Moment, { kind: 'streak' }>): number[];
```
- Length `min(days, 21)`, always ending with `weekdayIndex(endDayKey)`; consecutive entries step by +1 mod 7.
- Domain tests: 7, 14, 21, 28 (capped at 21, still ends on endDayKey), an endDayKey on every weekday.
- **Data trace test** `src/state/__tests__/streakData.test.ts`: builds runs through the app's own actions
  (`createTopic`, `createTask`, `reconcile`, `startTask`/`stopTask`, checklist ticks, `closeToday`, `at()` with real
  hours across the 2026-11-01 DST change), same fixture style as `momentsData.test.ts`. Asserts, with the hand-worked
  values in comments:
  1. Seven days in a row, each with at least one item (one of them checklist-only), closed by hand on day 7: exactly
     one streak moment, `days` 7, `endDayKey` day 7, `streakWeekdays` matches the real weekdays.
  2. Day 6 closed: no streak moment. A day with no item (app not opened, or opened but nothing done) breaks the run:
     the next 7 days start from 1 again.
  3. Closing day 7 again (re-open path if the app has one, else a second hand close the same day) does not play it
     twice (markers).
  4. Day 14 plays `days` 14.
- Nothing in ui changes.

## Chunk 2 · Streak scene
Files: `src/ui/moments/streakScene.ts` (pure worklets), `src/ui/moments/Streak.tsx`, `MomentsPlayer.tsx`
(MomentBody: `streak` -> `Streak`), tests `src/ui/__tests__/streakScene.test.ts`, `src/ui/__tests__/Streak.test.tsx`.

```ts
// src/ui/moments/streakScene.ts
export const STREAK_SLOTS: number;     // worst case (21 steps) fits; the test asserts it at every frame
export const STREAK_STILL_AT: number;  // from here nothing moves; Scene3D freezes the frame
/** The stair at local time lt for `n` steps (1..21), as prims. The top step (today) is gold. */
export function streakDraw(lt: number, size: Size, n: number): Prim[];
/** Label3D `at` for step i (0 = oldest) of n: [x, y, opacity, colour]; today's label is yellow. */
export function streakLabelAt(lt: number, i: number, n: number, screen: Size): [number, number, number, string];
```
- Look: the bench's `streak` scene (`drafts/celebrations/close-moments-3d-v1.html`, source
  `scratchpad/moments3d.js` lines 47-79): one step per day on a spiral stair, one turn per 7 days, steps land in
  order, today's step on top in GOLD, an amber thread climbs through the step tips, the central axis and floor ring.
  `RISE` 0.62 for n <= 7 else 0.5. Change from the bench: the camera's yaw eases to a stop at `STREAK_STILL_AT`
  (about 2.6 s) instead of turning to the end, so the frame can freeze (M9 lesson: prims per frame and freeze).
- Lines go through `pushSegments` (the ring and the thread are one prim each, not one per segment).
- Labels: each step's weekday letter from `streakWeekdays(moment)` (`WEEK_LETTERS`), today's as `<letter> · TODAY` in
  yellow, the rest steel. Headline `momentHeadline`, detail `momentDetail`.
- Tests: n = min(days, 21) steps drawn, top step gold and only it, letters are exactly the real weekdays (e.g.
  endDayKey a Wednesday ends `W · TODAY`), slot count fits at every frame for n = 1, 7, 21, the frame does not change
  after `STREAK_STILL_AT`, the player shows `Streak` for a streak moment, reduced motion draws the final frame, the
  worklet test passes.
