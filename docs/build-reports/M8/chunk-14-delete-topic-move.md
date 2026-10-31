# Chunk 14 · Delete topic: move tasks first

## What it is for
Phone check (2026-10-31): "When given a scenario where the topic is being deleted, give them a choice if they want to move any tasks in it before deleting, then go ahead with the decision yes or no." Until now Remove soft-deleted the topic and all its tasks at once.

## Connections
- Contract: `contract.md` section "Chunk 14". ADR-013. Doc 04 §11, doc 05 (Topic edit row).
- Data flow: `/topic/[id]` (`useTopicRemoval(id)` -> tasks + targets) -> `TopicForm` (`removal`, `removeError`, `onRemove(move?)`) -> `TopicRemove` (the confirm / move steps) -> `removeTopic(id, { moveTaskIds, toTopicId })` (state) -> `softDeleteTopic(db, id, now, move)` (repo, one transaction).

## Files
- New: `src/ui/TopicRemove.tsx`, `src/state/hooks/useTopicRemoval.ts`, `src/__tests__/topicDeleteMove.test.tsx`.
- Changed: `src/data/repos/topics.ts` (`softDeleteTopic` gets `move?`), `src/state/actions/library.ts` (`removeTopic` gets `move?`), `src/ui/TopicForm.tsx` (uses `TopicRemove`; props `removal`, `removeError`), `src/ui/TopicPicker.tsx` (optional `label`, default "Topic"), `src/app/topic/[id].tsx` (hook, ValidationError shown as text), docs 04 §11, 05, 10 (ADR-013), `contract.md`, `README.md`.

## Build
- No live tasks: `TopicRemove` renders the same `ConfirmBox` as before (same text and "Remove" label).
- With tasks: "<Topic> has N tasks. Move any of them before deleting?" -> "Yes, move tasks" / "No, delete all" (danger) / "Cancel". Yes -> a checkbox per task (all ticked, label = task name), "Move to" `TopicPicker` (No topic first, default; the topic itself is not offered), the line "2 move to No topic · 1 is deleted", "Move and delete topic" (danger) and "Back" (to the question). Cancel from the question closes it.
- Repo, inside the transaction and before any write: target must be a live topic and not the topic itself; every id must be a live task of the topic. Moved tasks are written in their old `sortOrder` order, after the target's max. Then the existing cascade deletes the rest. Any throw rolls everything back.
- State: `removeTopic(id, move)` refuses a move without `toTopicId`. No topic stays refused by the repo.
- Screen: Remove goes through `useSubmitGuard` as before; a `ValidationError` resets the guard and shows as alert text (in either step); anything else rethrows.
- Day rows untouched (snapshots).

## Tests
- Written first and run: 9 of the 11 in `__tests__/topicDeleteMove.test.tsx` failed (no question, no move step, no `move` argument); the 2 that passed were the unchanged empty-topic confirm (e) and the "plan rows stay" guard (g), which holds trivially before the change.
  (a) Study A,B,C: Yes, untick B, No topic -> A and C under No topic in order, B deleted, Study gone, back once; (b) move to Home -> after Home's existing task; (c) No, delete all; (d) Cancel from the question and Back from the move step change nothing; double press acts once; a refusal shows as text and stays; (e) empty topic keeps the plain confirm; (f) bad target (deleted, missing, itself), foreign id, no target, No topic: ValidationError and nothing changed; old order kept whatever order the ids are given; (g) tomorrow's confirmed rows of the moved task unchanged.
- Changed existing: `__tests__/topicRoutes.test.tsx` "remove soft-deletes the topic and its tasks" now presses "No, delete all" (the topic has a task, so the new question appears). The empty-topic double-press test is unchanged.

## Errors / open
- Moving 0 tasks (all unticked) is allowed and behaves like delete all; the line reads "0 move to <X> · N are deleted".
- Not run on a device.

## Outputs
tsc clean, lint clean, jest 86 suites / 1029 tests pass (was 85 / 1018).

## Check and lead fix
- Checker (Sonnet): PASS, no errors. Warning: the ticked set is built at mount, so a task removed elsewhere stays counted. Submit already sends only ticked ids of current tasks (no ValidationError path); the lead fixed the "N move" count to count current tasks only. Nits: a task added meanwhile shows unticked; TopicRemove.tsx is LF like the index.
- After the fix: tsc clean, lint clean, 86 suites / 1029 tests pass.
