# M9 build run · Week complete (3D)

Started 2026-11-02. The first of five moment milestones (user request: one milestone per animation, built from the
independent parts to the connected ones):

| Milestone | Moment | New data it needs |
|---|---|---|
| **M9** | Week complete: the safe dial, one wedge per day, locks on Sunday | each day's focus this week |
| M10 | Streak: the spiral stair, one turn per week | the days of the run (weekday letters) |
| M11 | Personal best: the skyline breaking the glass at your best | the last 13 days' focus |
| M12 | Monthly goal: the climb to the sun's ring (+ the monthly goal setting) | each day's focus this month |
| M13 | Wrap-up: moments on/off setting, Placeholder removed, all six together | none |
| M14 | Insights (user choice 2026-11-02, option 1): on-device statistics in Profile, no model, nothing leaves the phone; describes only, never judges or suggests (non-goals stand) | the stored days, tasks and sessions |

Visual reference (approved 2026-11-02): `drafts/celebrations/close-moments-3d-v1.html`,
https://claude.ai/artifact/G4r7PGSYysbJxqt3TVYWE5. The bench uses sample history; **the app shows only real data**.

Done when: closing a Sunday by hand plays WEEK COMPLETE. as the 3D dial, and every number and every wedge on it is
the user's real week (checked by a data trace test that builds the week through the app's own actions).

## Process (user's words: "double or triple check the build ones")
1. Sonnet builder per chunk, from `contract.md`.
2. Sonnet checker A: contract, code, tests, layering, worklet rules.
3. Sonnet checker B (data audit): traces every number and shape on screen back to stored days, tasks and sessions,
   and recomputes them by hand from the test fixture.
4. A test that fails more than twice: Opus fixes that one error only, then back to Sonnet for the re-check.
5. Lead: tsc, lint, full jest, report section.

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 1 | Week data: each day's focus on the week moment + a data trace test | M8 chunk 19 | [chunk-01](chunk-01-week-data.md) | PASS (A: warnings, B data audit: PASS) + lead fixes |
| 2 | 3D kit: worklet camera, solids, painter's order, `Scene3D` renderer (shared by M9-M12) | M8 chunk 20 | [chunk-02](chunk-02-3d-kit.md) | PASS (A and B: warnings) + 10 fixes by the builder |
| 3 | Week scene: the dial from real data, wired into the player | 1, 2 | [chunk-03](chunk-03-week-scene.md) | PASS (A and B: warnings; data exact) + fixes (218 -> 49 shapes, freeze when still) |

## Paused 2026-11-02 04:01 (user: "pause the run")
- Done: chunks 1-3 built, checked twice and fixed. tsc clean, lint clean, `Test Suites: 97 passed, 97 total` /
  `Tests: 1203 passed, 1203 total`. Nothing running. Nothing committed.
- Left for M9: the phone check (Expo Go): close a Sunday by hand, watch the dial, readouts and smoothness after the lock.
- Next on resume: M10 Streak (contract, then chunks), unless the phone check needs fixes first.
