# Chunk 12 · A task needs no topic

## What it is for
Phone check (2026-10-31): the Plan one-off form required a topic, had no note field, and the Library could not make a task without a topic. This chunk adds the foundation (a built-in "No topic", ADR-012), the state API chunk 13 needs, and the Plan one-off form changes (topic optional, day note). The Library "+ New task" and the topic picker on the library task card are chunk 13.

## Connections
- Contract: `contract.md` section "Chunk 12". ADR-012, ADR-011 (day notes), doc 03 (topics), doc 04 sections 2 and 11, doc 05 (Topics, Plan).
- Data flow: migration -> `topics` row `no-topic` -> `listTopics` (all, for grouping and names) / `listUserTopics` (user topics only). `OneOffForm` -> `PlanScreen` -> `usePlanDraft.addOneOff({ topicId, name, kind, minutes, note })` -> domain `addOneOff` (blank note -> null) -> confirm writes `day_tasks.note`.

## Files
- Domain: `src/domain/types.ts` (`NO_TOPIC_ID`, `NO_TOPIC_NAME`, `ColorKey` + `'none'`), `src/domain/plan.ts` (`addOneOff` takes `note`).
- Data: `src/data/migrations/20261031212212_no_topic/migration.sql` (custom migration, `INSERT OR IGNORE`; the schema SQL does not change, so no snapshot diff), `migrations.js`, `src/data/schema.ts` (enum list + `'none'`), `repos/topics.ts` (`listUserTopics`, refusals, new topics number from the user topics only), `repos/tasks.ts` (topic must be live on create and on move; a move goes to the end of the target).
- Theme: `src/theme/buildTheme.ts` (`PickableColorKey`, `TopicColorKey` + `'none'`; `t.topic('none')`).
- State: `actions/library.ts` (`createTask(topicId | null | undefined, ...)`, `updateTask` doc, `moveTopic` over user topics), `hooks/useTopicsLibrary.ts` (No topic only while it has a task; `useTopic` null for it), `hooks/useOnboarding.ts` (user topics only), `hooks/usePlanDraft.ts` (`addOneOff` note).
- UI: `src/ui/OneOffForm.tsx` (No topic first and selected, Add needs a name, note field, `dayName` prop), `src/screens/PlanScreen.tsx` (passes `dayName`), `src/screens/TopicsScreen.tsx` (header counts user topics, no "⋯" on No topic).
- Docs: 03, 04, 05, 10 (ADR-012), `contract.md`, `README.md`.

## Build
- Field order in the form: Task name, Topic, Length, then "Note for <weekday>" last. Reason: the short pickers stay together under the name, and the multiline optional note does not push them away.
- Why a row and not a nullable `topicId`: every grouping keeps working; see ADR-012.
- Sort order: the row is created with sortOrder 1000000 so it lists after user topics on fresh installs and upgrades alike; `createTopic` numbers new topics from the user topics' max.
- Collapsing the No topic fold still works (a view state, `isOpen`); name, colour, order and delete are refused.
- Topic deletion today (Library "Remove"): `removeTopic` soft-deletes the topic AND all its tasks (repo cascade, doc 04 section 11); past days keep their rows. Not changed. No topic is refused, so it never cascades. Open question for the lead: should deleting a topic move its tasks to No topic instead?

## Tests
- Written first, all failed before the code (missing exports, no No topic row, the form still required a topic, no note field): `data/__tests__/noTopic.test.ts` (fresh db, upgrade from the previous migration with no duplicate, refusals, neutral colour not creatable, move between topics, move to a missing or deleted topic), `state/__tests__/noTopic.test.ts` (empty library and onboarding, listed only with a task, Plan topics, create without topic, `updateTask` move, rename/delete refused and `useTopic` null, `moveTopic`), `screens/__tests__/optionalTopic.test.tsx` (name-only add -> No topic group -> confirm stores `no-topic`/`none`; picker order; note stored and shown on the task page next day as "Note for Friday"; blank note null; Library hides No topic while empty and shows it with a task), `domain/__tests__/plan.test.ts` (`addOneOff` note), `theme/__tests__/contrast.test.ts` (No topic colour and fold, every palette and tint).
- Changed existing tests: `topicRoutes.test.tsx`, `OnboardingScreen.test.tsx`, `state/onboarding.test.ts`, `data/topics.test.ts`, `state/library.test.ts` (`listTopics` -> `listUserTopics`: they count the user's topics and the built-in row is now always there), `state/planHooks.test.ts` (`usePlanTopics` also returns "No topic", last), `ui/PlanControls.test.tsx` (OneOffForm: Add needs only a name, new `dayName` prop, `note` in the row).

## Errors
- First idea for the No topic fold colour (muted tinted 14%, then 6%, over the page) failed the contrast audit for muted text on the fold; the fold is now the plain page colour and the dot is the muted ink.

## Outputs
- Not run on a device. tsc clean, lint clean, jest 84 suites / 1005 tests pass (was 81 / 984).
