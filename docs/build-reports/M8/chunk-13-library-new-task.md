# Chunk 13 · Library: new task and topic picker

## What it is for
Phone check (2026-10-31): "in the library there should also be not just add new topic, also add new task". Chunk 12 made the topic optional in the state layer; this chunk gives the Library the UI: a "+ New task" button that works with no topics, and a Topic picker on the task card to choose or change a task's topic.

## Connections
- Contract: `contract.md` section "Chunk 13". ADR-012. Doc 05 (Topics row).
- Data flow: `TopicsScreen` (draft state, folds, picker options) -> `TaskEditor` (saves) -> `createTask(topicId, ...)` / `updateTask(id, { topicId })` -> `TaskCard` Back -> `TopicPicker`. `TaskCard` stays presentational: it gets `topics`, `value.topicId`, `topicError` and reports `onChange({ topicId })`.

## Files
- New: `src/ui/TopicPicker.tsx` (the "Topic" radiogroup moved out of `OneOffForm`: No topic first, colour dot, 44 pt, radio state, optional error text), `src/screens/__tests__/libraryNewTask.test.tsx`.
- Changed: `src/ui/OneOffForm.tsx` (uses `TopicPicker`, same behaviour), `src/ui/TaskCard.tsx` (`topicId` in the value, `topics`/`topicError` props, picker above Repeats), `src/screens/TaskEditor.tsx` (draft topic, move, errors), `src/screens/TopicsScreen.tsx` ("+ New task", stand-in fold, picker options), docs 05, `contract.md`, `README.md`.

## Build
- Placement of the draft: a **"No topic" fold that appears while the draft is open** (a stand-in entry added in the screen when No topic has no task). Chosen over a card under the buttons because the draft is then the same component instance before and after it is named: when the task is created the fold simply becomes the real group, so the card does not remount and the keyboard stays. If the No topic fold exists but is collapsed, "+ New task" opens it.
- Order in the card back: Task name, Topic, Repeats, Kind... (the topic next to the name, like the Plan form).
- Draft topic: the editor holds the choice; `createTask` uses it once the draft gets a name. If it differs from the fold the draft sits in, `onCreated(id, topicId)` moves the draft to that topic's fold (a remount; the card stays open and flipped).
- Existing task: `updateTask(id, { topicId })`, the task moves to the end of the target group, `onMoved` opens that fold if collapsed, the card stays open where the task now is. Moving the last task out of No topic hides the group (hook rule from chunk 12).
- Errors: a `ValidationError` from a move or from creating the draft shows "That topic no longer exists. Pick another." as alert text under the picker; the next good choice clears it. Anything else still throws.
- Not changed: flip animation, delete, note, repeat, default, header counts.

## Tests
- Written first, run, and all 8 failed (no `library-new-task`, no picker on the card): `screens/__tests__/libraryNewTask.test.tsx`: (a) empty library -> New task -> name -> Done -> under No topic, then shown in Plan for a Friday; blank draft backs out with Delete task and leaves no group; (b) with topics, New task, pick Study -> created in Study (picker order No topic, Study, Move); draft keeps the pick before it is named; (c) Study task -> No topic, counts update; (d) last task out of No topic hides the group; (e) "+ Add task" in Move defaults the picker to Move; deleted-meanwhile topic shows the error and a good choice clears it.
- Changed existing: `ui/__tests__/TaskCard.test.tsx` (`topicId` in the value, `topics` prop, one new picker test). `OneOffForm` tests pass unchanged.

## Errors / open
- If creating a named draft fails because its topic was deleted, the typed name is not retried by itself (the user picks another topic and retypes or edits the name). Narrow; the error text says why. *(Fixed in "Check and fix" below: the next good pick creates it.)*
- Not run on a device.

## Outputs
tsc clean, lint clean, jest 85 suites / 1014 tests pass (was 84 / 1005).

## Check and fix
Checker verdict: **FAIL**, 2 errors plus nits.

**Error 1: "+ New task" again after naming the draft renamed the first task.** Empty library, "+ New task", type "First", "+ New task" again, type "Second": the library held only "Second" ("First" overwritten).
- Root cause: the draft editor had a fixed React key (`draft`), so the second draft reused the same `TaskEditor` instance in the same No topic fold, and its `idRef` still held First's id; the new name went to `updateTask(First)`.
- Fix: `Draft` gets a `seq` that each `addTask` bumps; the draft editor is keyed `draft-<seq>`. A new draft is a new instance (blank, no id); the old one unmounts (flushing anything pending) and, since `createdId` is reset, "First" shows as a saved card. "+ Add task" inside a topic is hidden while a draft is open there, so that path needs Done first and was already fine; a test now guards it.

**Error 2: a typed name was lost when the chosen topic had been deleted.** Draft, pick Move, Move removed elsewhere, type "Typed": the error showed; picking Study cleared it but saved nothing, and Done closed the card with no task.
- Root cause: `flush` cleared `pending` before `createTask` threw, so the name was gone; the draft branch of `onChange` never retried creation; `onDone` closed regardless.
- Fix (`TaskEditor`): on a `ValidationError` while creating, the pending name (and note) is put back; after a draft's picker change, if a name is still pending, `flush` runs again so the draft is created once with the new topic and its earlier choices; `onDone` stays open (error shown) when a named draft is still not created.
- Not changed: flipping to another card or leaving the screen while the topic is gone still drops that draft (the card unmounts and there is nowhere to show the error). Narrow.

**Nit (docs):** doc 04 §11 now says moving a library task to another topic does not change existing day rows (snapshots). Doc 04's line endings were mixed after an earlier chunk; each unchanged line now has HEAD's exact bytes, so `git diff --stat` equals `git diff --ignore-cr-at-eol --stat` (HEAD itself is mostly CRLF with a few LF lines, not all LF).

**Tests** (`screens/__tests__/libraryNewTask.test.tsx`, "check and fix", written first; 3 failed before the fix, the "+ Add task" guard passed): second "+ New task" keeps "First" and creates "Second"; "+ Add task" after Done in Study makes a second task; name typed with the topic gone is created in Study once a good topic is picked, and Done keeps it; Done before the debounce with the topic gone keeps the card open with the error, then picking No topic creates it.

Final: tsc clean, lint clean, jest 85 suites / 1018 tests pass.
