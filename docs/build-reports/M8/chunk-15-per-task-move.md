# Chunk 15 · Delete topic: choose a topic per task

## What it is for
Phone check (2026-10-31), on chunk 14: "it's asking to move all tasks of the topic to just one topic when deleting that topic. For each task give an option to pick which topic to move it to." Chunk 14 had one shared "Move to" picker plus a checkbox per task.

## Connections
- Contract: `contract.md` section "Chunk 15". ADR-013 (amended). Doc 04 §11, doc 05 (Topic edit row).
- Data flow: `/topic/[id]` (`useTopicRemoval(id)` -> tasks + targets) -> `TopicForm` (`onRemove(moves?)`) -> `TopicRemove` -> `removeTopic(id, { moves })` (state) -> `softDeleteTopic(db, id, now, { moves })` (repo, one transaction).

## Files
- Changed: `src/ui/TopicRemove.tsx` (per-task rows), `src/ui/TopicPicker.tsx` (optional `extra`), `src/ui/TopicForm.tsx` and `src/app/topic/[id].tsx` (new `onRemove` shape), `src/state/actions/library.ts` (`removeTopic(id, { moves })`, unused `ValidationError` import dropped), `src/data/repos/topics.ts` (`softDeleteTopic(..., { moves })`), `src/__tests__/topicDeleteMove.test.tsx`, docs 04 §11, 05, 10 (ADR-013), `contract.md`, `README.md`.
- No new files besides this report.

## Build
- First step and empty-topic confirm unchanged.
- Move step: a row per task, button "Read → No topic" (accessibilityLabel "Read, moves to No topic. Change"; deleted: "Read, is deleted. Change"). Tap opens a `TopicPicker` (label "Move Read to") under that row only: No topic, other live topics, then "Delete" (the `extra` option, no color dot). Picking sets the destination and collapses; opening another row closes the first.
- Summary "2 move · 1 is deleted" (singular "1 moves", "is"; "0 move" when all deleted). Buttons "Move and delete topic" and "Back".
- Submit sends `{ taskId, toTopicId }` for every current task not set to Delete. A task removed elsewhere meanwhile is not in the list, so it is skipped and not counted; one added meanwhile shows with the default No topic.
- Repo, inside the transaction and before any write: each target live and not the topic itself; each taskId a live task of the topic; no duplicate taskId. Then tasks are walked in their old `sortOrder` order; each goes to the end of its target (max sortOrder tracked per target), so tasks to the same target keep their relative order. Then the existing cascade deletes the rest. Any throw rolls everything back.
- State: `removeTopic` is now a thin wrapper (the "needs a target" check is gone; the repo validates). Chunk-14 shape (`moveTaskIds`/`toTopicId`) removed, not kept alongside.
- Day rows untouched.

## Tests
- Written first and run against the old code: 8 of 15 in `__tests__/topicDeleteMove.test.tsx` failed: (a) per-task path Read -> Home, Walk -> Delete; (b) UI same-target order; (c) picker contents / one row open; summary singular/plural/0; task removed and added meanwhile; state same-target order; tasks not listed deleted; (g) plan rows (they fail because the new `moves` argument was ignored/refused). Passing before the change, trivially: (d) invalid target and (e) duplicate/foreign id (the old API threw a ValidationError for an unknown shape, so they only became meaningful with the new code), No delete all, Cancel/Back, double press, refusal text, empty topic.
- Updated chunk-14 tests (same file): the old (a) untick-B path and (b) one-target path replaced by (a)/(b) above; (c) renamed "No, delete all"; (d) Cancel/Back kept, now on Read/Sums/Walk; the three (f) state tests became (d), (e), (b) state with the `moves` shape; (g) uses `moves`. `topicRoutes.test.tsx` needed no change (it presses "No, delete all").

## Errors / open
- Moving 0 tasks (all Delete) is allowed; it behaves like "No, delete all".
- Not run on a device.

## Outputs
tsc clean, lint clean, jest 86 suites / 1033 tests pass (was 86 / 1029).

## Check and lead fix
- Checker (Sonnet): PASS, no errors. Warning: a chosen destination topic removed elsewhere while the step is open showed "No topic" but submitted the dead id, failing with a raw-id alert. Nits: a Latin-1 section sign in a topics.ts comment; report Files list (TopicRemove.tsx, useTopicRemoval.ts and topicDeleteMove.test.tsx are new files from chunk 14, not changed ones).
- Lead fix: TopicRemove `where` now falls back to No topic when the chosen destination is no longer a live target (shown and submitted alike). New test "a chosen topic removed elsewhere meanwhile falls back to No topic" failed before the fix and passes after. The section sign in topics.ts is UTF-8 again.
