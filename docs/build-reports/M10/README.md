# M10 build run · Streak (3D)

Started 2026-11-02 on "resume". Second of the five moment milestones (table in `../M9/README.md`). Same process as M9:
Sonnet builder per chunk from `contract.md`, Sonnet checker A (code and contract), Sonnet checker B (data audit and
performance), Opus only for a test that fails more than twice, lead runs tsc, lint, full jest.

Done when: closing the 7th day in a row by hand plays `7-DAY STREAK.` as the spiral stair, with one step per real day
and each step's weekday letter the real weekday (checked by a data trace test that builds the run through the app's
own actions).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Streak data: `streakWeekdays` + a data trace test | M8 chunk 19 | [chunk-01](chunk-01-streak-data.md) | PASS (A: PASS, B data audit: PASS with warnings) + 5 fixes |
| 2 | Streak scene: the stair from real data, wired into the player | 1, M9 chunk 2 | [chunk-02](chunk-02-streak-scene.md) | PASS (A: warnings, re-check PASS; B: data exact, layout fixed) + fixes |

M10 built and checked 2026-11-02: tsc clean, lint clean, 100 suites / 1237 tests pass. Left: the phone check (see
chunk-02). Nothing committed.
