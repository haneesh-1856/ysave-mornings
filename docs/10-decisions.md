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

### ADR-011 · Day notes are separate from the library note (product decision, 2026-10-31)
**Context:** in the phone check the user wanted a note to be addable anywhere but always reflected in Today: the
library note is the task's general note, tomorrow's plan note says what to do tomorrow, today's edit note is an
action for that task. A note typed while planning must not leak into the library.
**Decision:** `day_tasks.note` holds the per-day note, written by Plan (draft/confirm) and by Today. Plan and the
Library editor no longer share one field: the library note stays on `tasks.note`, read-only in Plan. The day note
travels when a task is moved to the next day.
**Trade-off:** one more nullable column (`day_tasks.note`) and one more field in the plan row; in return a
one-off row can carry a note and nobody's library gets overwritten by a one-day remark.

### ADR-012 · A task may have no topic: one built-in "No topic" (product decision, 2026-10-31)
**Context:** in the phone check the user could not add a one-off task without choosing a topic, and wanted the same in
the Library: topics are optional there too.
**Decision:** a single built-in topic row, `id = 'no-topic'` (`NO_TOPIC_ID`), name "No topic", neutral colour `none`,
created by a migration (`INSERT OR IGNORE`, so fresh installs and upgrades both get exactly one) and listed after every
user topic. `tasks.topicId` and `day_tasks.topicId` stay NOT NULL, so every grouping (Plan, Today, calendar, close
summary, stats) works unchanged. It can't be renamed, recoloured or deleted (the repo refuses), has no edit screen, is
offered first and pre-selected in topic pickers, and is never counted as one of the user's topics (onboarding, "No
topics yet", the Topics header). In the Library it is listed only while it holds a live task. A library task can move
between topics (`updateTask` with `topicId`, to the end of the target).
**Trade-off:** one special row that a few screens must know about (filter it from "your topics", hide its edit button);
in return no nullable `topicId`, no migration of old rows, and nothing that groups by topic needs a second code path.

### ADR-013 · Deleting a topic can first move its tasks (product decision, 2026-10-31)
**Context:** in the phone check the user wanted a choice, when deleting a topic, to move any of its tasks before it goes,
instead of losing them all with it.
**Decision:** a topic with live tasks asks "Move any of them before deleting?". Yes lists its tasks, each with its own
destination (amended 2026-10-31, chunk 15: first built as one shared "Move to" picker plus per-task checkboxes). A task
defaults to No topic; tapping it opens a picker with No topic first, the other live topics (never the topic itself) and a
last option "Delete" (removed with the topic). Moved tasks go to the end of their target in their old relative order. No
deletes everything as before; Cancel changes nothing. `removeTopic(id, { moves: [{ taskId, toTopicId }] })` ->
`softDeleteTopic(..., { moves })` do the moves and the cascade in one transaction and validate first (every target live
and not the topic, every taskId a live task of the topic, no duplicates); tasks not listed are deleted. Day rows stay snapshots.
**Trade-off:** one more step on a destructive action and a longer confirm; in return nothing is lost by accident and no
second screen or undo is needed. A topic with no tasks keeps the plain confirm.
