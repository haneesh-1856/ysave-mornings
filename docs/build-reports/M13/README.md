# M13 build run · Moments wrap-up

Started 2026-11-02 after M12. Last of the moment milestones before M14 Insights (table in `../M9/README.md`).

Done when: Moments can be turned off and on in Profile, every moment is drawn (no placeholder), one close can play all
six in order, and the end-to-end cases carried from M8 chunk 19 are tested with the app's own actions.

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Moments on/off control in Profile | M8 chunk 19 repo | [chunk-01](chunk-01-on-off.md) | PASS + 1 test added |
| 2 | Player wrap-up: Placeholder removed, all six, only the visible scene mounted | M9-M12 | [chunk-02](chunk-02-player.md) | PASS + fixes |
| 3 | Moments end to end: all six from one close, late close, off then on | M9-M12 data | [chunk-03](chunk-03-end-to-end.md) | PASS (A, B) + selector cross-check |

## Lead verification
tsc clean, lint clean, `Test Suites: 110 passed, 110 total`, `Tests: 1351 passed, 1351 total`. No probe files, no
`Placeholder` left in `src`. Nothing committed.

## Phone check (user)
Profile: the "Moments at close" switch turns moments off (a close by hand plays nothing) and back on. All six can
play in one close (e.g. a Sunday that also reaches the monthly goal); only one scene runs at a time, so it stays smooth.
