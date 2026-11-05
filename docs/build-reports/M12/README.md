# M12 build run · Monthly goal (3D) + the monthly goal setting

Started 2026-11-02 after M11. Fourth of the five moment milestones (table in `../M9/README.md`). Same process.

Done when: setting a goal in Profile, then reaching it with real focus, plays `MONTHLY GOAL.` as the climb whose curtain
is the month's real days and whose ring closes at the real goal; with no goal, the month's last close plays the review.

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Month data: `dailyMs` for the month + data trace test | M8 chunk 19 | [chunk-01](chunk-01-month-data.md) | PASS (A + 1 required fix, B PASS) |
| 2 | Monthly goal setting: action, hook, screen, Profile row | M8 settings repo | [chunk-02](chunk-02-goal-setting.md) | PASS (A, B: UX fixes applied) |
| 3 | Month scene: the climb and the ring, wired into the player | 1, M9 chunk 2 | [chunk-03](chunk-03-month-scene.md) | PASS (A + re-check, B: data exact, camera fix) |

M12 built and checked 2026-11-02: tsc clean, lint clean, 108 suites / 1342 tests pass. Left: the phone check.
Nothing committed.
