# 10 · Decision log (ADRs)

Short records of technical decisions: the context, what we chose, and the trade-off we accepted.
New decisions get appended; old ones get *superseded*, never edited away.

### ADR-001 · Expo + React Native + TypeScript (2026-10-27, accepted)
**Context:** one person building for both platforms, on Windows without Android Studio or a Mac.
**Decision:** Expo managed workflow, TypeScript strict.
**Trade-off:** slightly less low-level control than native and a JS bridge cost. That's acceptable for a list +
timer + SVG app; Reanimated covers the animation needs. Flutter was the alternative (similar
power, but a heavy SDK install and a language the prototypes don't share).

### ADR-002 · Local-first, no backend in v1 (accepted)
**Context:** solo features don't need a server; teams are later.
**Decision:** all data in on-device SQLite; no accounts, no network.
**Trade-off:** no backup or multi-device until sync ships. We get: privacy, offline, zero running cost.
Rows are sync-ready (UUIDs, timestamps, soft delete).

### ADR-003 · SQLite + Drizzle over AsyncStorage/MMKV key-value (accepted)
**Context:** the calendar, stats and history need queries across days ("all completed items this week").
**Decision:** relational SQLite with typed Drizzle schema and migrations.
**Trade-off:** more setup than a JSON blob. The win: correct queries, schema evolution, and data that
doesn't need to fit in memory.

### ADR-004 · The timer is computed from stored timestamps, never counted down (accepted)
**Context:** phones suspend and kill apps; a `setInterval` that subtracts 1 every second loses time.
**Decision:** store sessions (`startedAt`/`endedAt`); remaining time and completion moment are pure
functions of them and `now`.
**Trade-off:** slightly more math, but it's exact after locks, kills, reboots and clock reads.

### ADR-005 · History is snapshotted (accepted)
**Context:** "past days keep their marbles" even after renames and deletes.
**Decision:** `day_tasks` copies name, color and budget at planning time; the library uses soft delete.
**Trade-off:** some duplication. In return, history is immutable and simple to render.

### ADR-006 · Derived values are computed, not stored (accepted)
Collection items, glow, chain and stats are computed from sessions/day_tasks, so they can never disagree
with each other. If performance ever demands it, cache with an explicit invalidation rule.

### ADR-007 · Every style-lab option ships as a user setting (product decision, 2026-10-23)
**Consequence:** all visuals go through `useTheme()`; components never hard-code colors, radii or durations.
This costs more up front and is the reason the theme layer exists.

### ADR-008 · Pure domain layer with injected time (accepted)
Rules live in `src/domain` without React or SQLite, and receive `now` as a parameter, so the
trickiest logic (day boundary, rollover, timer) is fast to test and easy to reason about.

### ADR-009 · Today's plan stays editable while the day is open (product decision, 2026-10-29)
**Context:** in the M3 phone check the user found today's plan couldn't be changed once confirmed.
**Decision:** today can be re-planned until the day closes. Started or finished tasks are always kept, and the
planning marble keeps its original time.
**Trade-off:** unticking an unfinished task late in the day still lets the day glow. That follows the locked
rule that the user is responsible for honesty; the app doesn't police it.

### ADR-010 · Plan ahead with drafts (product decision, 2026-10-30)
**Context:** in the M6 phone check the user wanted to add a plan for any later day from the Calendar, the way
tomorrow can be planned, without that meaning the day is planned.
**Decision:** any day after tomorrow can hold a **draft plan**. A draft is not a plan: no planning marble, no
"planned" state. When the day becomes tomorrow, the evening's "Plan tomorrow" opens the draft and confirming it
**finalizes** the plan as usual. If a draft day arrives without being finalized, the draft is its starting plan
(today stays editable per ADR-009) and the day counts as unplanned.
**Trade-off:** one more column (`days.planDraftedAt`) and a draft mode on the Plan screen; in return the existing
plan, confirm and rollover rules stay unchanged for confirmed plans.
