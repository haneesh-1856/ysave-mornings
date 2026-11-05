# M12 contract · Monthly goal (3D) + the monthly goal setting

Same rules as M9 to M11 (`../M9/contract.md`): layering, worklets, the kit stays unchanged.

**Data rule (user, 2026-11-02):** everything shown is the user's real stored data. Empty days are 0.

Rules (doc 04 §12 item 6): `monthlyGoalHours` 1-744 or none. With a goal, the moment plays at the first close where
the month's focus reaches it; without one, a "month in review" plays when closing the month's last day. Once per month.

Look (bench `month` scene, `scratchpad/moments3d.js` lines 122-172): the month's focus climbs a cylinder as a curtain,
one turn per month (31 ticks), the goal floats as the sun's ring with its opening and closes when the climb passes it,
one pulse goes out; review: the ring marks the total and stays open. Running total `X.X H` at the climbing head.

Chunks 1 and 2 are independent and are built in parallel; chunk 3 needs 1.

## Chunk 1 · Month data
Files: `src/domain/moments.ts`, `src/domain/__tests__/moments.test.ts`, `src/state/__tests__/monthData.test.ts` (new).
```ts
| { kind: 'month'; monthKey: MonthKey; monthFocusMs: number; goalHours: number | null; daysShowedUp: number;
    /** Focused ms of each day of the month from the 1st to today (index 0 = the 1st). 0 for a day with no row. Sums to monthFocusMs. */
    dailyMs: number[] }
```
- From `input.monthBundles` keyed by `dayKey`, only keys of this month up to today (the M9 lesson: filter to the keys
  drawn, so totals always match). Length = today's day of month.
- Domain tests: length, order, missing days 0, sum = `monthFocusMs`, a bundle from another month is ignored everywhere.
- **Data trace test** with the real actions: a goal month where the goal is reached mid-month (plays once, `dailyMs`
  covers 1st..that day; a later close the same month plays nothing), a no-goal month closed on its last day (review,
  31 entries for October or 30 for November), gaps, a checklist-only day, a running session at the close, the DST day
  2026-11-01 in a November case. Hand-worked values in comments.

## Chunk 2 · Monthly goal setting
Files: `src/state/actions/settings.ts` (`setMonthlyGoal(hours: number | null)`, wraps the repo, `bump('settings')`),
a hook in `src/state/hooks/` for reading it (match the existing settings hooks), `src/screens/MonthlyGoalScreen.tsx`,
`src/app/settings/monthly-goal.tsx`, a `SettingRow` "Monthly goal" in `ProfileScreen.tsx` (value `40 h` or `None`),
tests for the action, hook and screen, `docs/05-screens-and-navigation.md` one line.
- Screen follows `DayStartScreen` / `GlassScreen` patterns and theme. Choose hours with a stepper or preset list plus
  "No goal"; whole hours 1-744 only (repo validation); the current value is shown selected. No judging copy.
- Changing the goal does not re-play or reset a month already celebrated (markers untouched).

## Chunk 3 · Month scene
Files: `src/ui/moments/monthScene.ts`, `src/ui/moments/Month.tsx`, `MomentsPlayer.tsx` (`month` -> `Month`), tests.
```ts
export const MONTH_SLOTS: number; export const MONTH_STILL_AT: number;
export function monthDraw(lt: number, size: Size, data: number[]): Prim[]; // data = [goalMs or -1, ...dailyMs]
```
- The curtain from the cumulative real `dailyMs`; height scale `top = max(goal, total) * 1.08`; the ring at the goal
  (or at the total in review). The ring closes only when the real total >= goal. One prim per line set via
  `pushSegments`; curtain faces may be grouped per few days to keep prims low.
- Labels: running total `formatHours(total)` style `X.X H` (the end value equals `monthFocusMs` exactly to one
  decimal), `GOAL N H` (or `X.X H THIS MONTH` in review); headline and detail from `momentText`.
- Apply the M10/M11 lessons: camera eases to a stop then freeze; measured slots with a test; fit 0.16h..0.68h; labels
  clamped and clear; mutation-strong tests; lead looks at renders (goal met, review) at 390x844 and 320x568.
