# M13 chunk 1 · Moments on/off

**What it is for:** lets the user turn the close moments off and on (the repo setting existed since M8 chunk 19 but had
no control).

**Connections now:** `setMomentsEnabled(on)` in `src/state/actions/settings.ts` (repo setter imported as
`saveMomentsEnabled`; `bump('settings')`; markers untouched), `useMomentsEnabled` hook, a "Moments at close" switch in
`ProfileScreen` under "Monthly goal" (the app's `Switch`: role switch, checked state, 44 pt). Docs 04 §12 and 05.
**Future connections:** none planned; `computeMomentsAfterClose` already reads the setting at each close.

## Build (Sonnet), parallel with chunks 2 and 3
Tests: on by default, persists, markers unchanged; hook re-reads; off -> `closeToday` returns `[]` with markers
unchanged, on again -> the next close plays; Profile switch toggles and persists.

## Check A (code, Sonnet): PASS
Applied: a CloseScreen test that turns moments off and on through the action after render, then closes: the player opens.

## Lead verification
See the M13 README.
