# M12 chunk 3 · Month scene

**What it is for:** draws the Monthly goal moment as a 3D climb: the month's real cumulative focus rises as a curtain
round a cylinder (31 ticks per turn), the goal floats as the sun's ring and closes with a pulse when the real total
reaches it; with no goal, a month in review where the ring marks the total and stays open.

**Connections now:** `monthScene.ts` (worklets on the M9 kit), `Month.tsx` (`Scene3D` with
`data = [goalMs or -1, ...dailyMs]`, freeze at `MONTH_STILL_AT`; `RunningTotal`, an Animated read-only TextInput whose
`text` prop counts up the real cumulative; `RingLabel`), `MomentsPlayer.tsx` (`month` -> `Month`).
**Future connections:** M13 removes `Placeholder` (no moment uses it now) and plays all six together.

## Build (Sonnet)
`MONTH_SLOTS` 14 (curtain faces grouped 4 days per prim), `MONTH_STILL_AT` 3.0 s (pulse ends by 2.85 s even when the
goal is met on the last day). Ring label above the ring's top (the bench's left-most point hit the ring's front arc).

## Check A (code, Sonnet): PASS, re-check PASS
Kept the Animated TextInput after checking Reanimated 4.7.1 and Fabric sources (`text` goes through a shadow-tree
commit on both platforms); needs one look on a phone. Applied: TextInput styling for iOS centring, hidden from screen
readers (the same figure is in the detail line), tests for goal 0 / no focus and that the animated `text` is wired.
Lead applied the re-check's last item: the label components are keyed by size and data, so their settled-frame cache
cannot go stale on a rotation.

## Check B (data, performance, layout, Sonnet): PASS
Real cases from `monthData.test.ts`: curtain height = cumulative / top x 4.4 at every day (error 0), flat across zero
days, ring at the goal (2 h) or the total (review), closed only in the goal case; labels `2.2 H` / `GOAL 2 H`,
`0.6 H` / `0.6 H THIS MONTH`, `1.1 H` / `1.1 H THIS MONTH`; the running number during the climb interpolates the real
cumulative. Found: the real goal case (12 days) settled with the month's end hidden at the back, a thin spike. Fixed:
the camera settles with the last day facing the viewer (tested for 1, 12, 24, 28, 31 days), the running total sits
above the ring, and the settled labels are cached so the frozen frame costs nothing.

## Lead verification
Viewed the case 1 render before and after: now reads as a curtain rising to the ring. tsc clean, lint clean,
`Test Suites: 108 passed, 108 total`, `Tests: 1342 passed, 1342 total`. No probe files left.

## Phone check (user)
Set a small goal (e.g. 1 h) in Profile, focus past it, close by hand: the curtain climbs with the number counting up,
the ring closes and pulses, the camera stops facing today's end of the curtain. Check the number looks right on both
the climb and at rest.
