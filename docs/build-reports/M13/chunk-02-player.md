# M13 chunk 2 · Player wrap-up

**What it is for:** every moment is now drawn, so the placeholder card goes, and the player is checked to keep only one
3D scene alive at a time.

**Connections now:** `MomentsPlayer.tsx` `MomentBody` is an exhaustive switch over `Moment['kind']` with a `never`
default (adding a kind fails tsc); `MomentFrame` keyed by kind; `Placeholder.tsx` deleted; docs 05 `/close` row
describes all six scenes.

## Build (Sonnet), parallel with chunks 1 and 3
Measured: only `moments[index]` is mounted (the yellow wipe is an overlay, not a second body), so at most one
`Scene3D` pool (Week 56, Streak 66, Best 50, Month 14 paths) exists at once. No change needed.
Tests: all six moments with one consistent "today" (Sunday 2026-11-01; 150 min is the same value in day, best, week
and month), each body in `MOMENT_ORDER`, chrome `n / 6`, exactly one body mounted per step (reduced path), Skip and
Continue end the run.

## Check A (code, Sonnet): PASS with minor findings, all applied
Key on the frame; exact one-body assertion; consistent fixtures (lead found the month fixture still described Nov 30
and sent it back); docs wording for Personal best and Monthly goal.
