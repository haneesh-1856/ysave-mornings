# M2 · Chunk 1 · State plumbing + library actions

## Build (Sonnet)

### Purpose
Give the screens a way to read and change the topic/task library without touching `src/data`: a db handle, a change signal, the write actions, and two read hooks.

### Files
- `mobile/src/state/dbRef.ts`: `setDb`, `getDb` (throws `Database is not ready: setDb() has not been called yet`), plus `clearDb` for tests. Type-only import of `DB`, no expo-sqlite.
- `mobile/src/state/store.ts`: zustand store of per-table version counters; `bump`, `useDataVersion`, `Table` type, `resetStore` (tests).
- `mobile/src/state/actions/library.ts`: `createTopic`, `updateTopic`, `removeTopic`, `moveTopic`, `createTask`, `updateTask`, `setTaskNote`, `removeTask`, `DEFAULT_TASK`.
- `mobile/src/state/hooks/useTopicsLibrary.ts`: `useTopicsLibrary`, `useTopic`, `TopicEntry` type.
- `mobile/src/state/testSupport.ts`: `setupState(at)` / `teardownState()` (fresh in-memory db, clock fixed, store reset). Kept out of `__tests__` so Jest doesn't treat it as a suite.
- `mobile/src/state/__tests__/library.test.ts`, `hooks.test.ts`.
- `mobile/src/app/_layout.tsx`: one line `if (migrated) setDb(db);` plus its import.

### Connections now
Actions call repos (`topics`, `tasks`) with `getDb()`, `now()`, `newId()` and then `bump`. Hooks read repos (`topics`, `tasks`, `days`, `settings`) and the domain (`stats`, `dayKey`). `_layout.tsx` hands the real db to `dbRef`. Nothing in `src/app` or `src/ui` uses these yet.

### Future connections
Chunks 3-4 (Topics screen, topic new/edit) use `useTopicsLibrary`, `useTopic` and the actions. M3-M6 add more actions/hooks on the same store and `dbRef`. M5's rollover, on foreground, bumps `'days'`/`'sessions'` so open screens re-read.

### Decisions
- `setDb(db)` is called in the render body of `RootLayout` (idempotent), not in an effect: an effect would run after children rendered and their hooks would hit `getDb()` unset.
- `useDataVersion(tables)` selects the sum of the listed counters (a primitive), so bumping another table causes no re-render (tested).
- `moveTopic` runs in one `db.transaction`, re-lists topics inside it, swaps the two `sortOrder` values via `updateTopic` (which accepts `sortOrder`, verified), and bumps only if something moved. Unknown id or an end position is a no-op.
- `removeTopic` bumps `topics` and `tasks` (repo cascades). `setTaskNote` returns the updated `Task` via `getTask` since the repo returns void.
- `createTask` spreads `DEFAULT_TASK` under the caller's partial, so only `name` is required.
- Hooks recompute in `useMemo` keyed on `[db, version of topics/tasks/days, dayKey]`; the day key is recomputed each render from `now()` and the day-start hour so a new day refreshes. `useTopic` returns null for removed topics.
- Hook tests use `await renderHook` / `await act(async ...)` (RNTL 14 is async). Week-dot seeding uses `buildPlan`/`confirmPlan`/`saveConfirmedPlan` + `setCheckCompleted` with `isDefault: true` tasks (so they come out ticked).
- Imports inside `src/state` use relative paths (as the existing files do).
- No changes to `src/data` or `src/domain`.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `npm test` / `npm run test:coverage` run over everything: failures only in `src/ui/__tests__/*` (Fold, TextField, Controls, WeekRing, TimeSlider), the parallel builder's in-progress files; ignored as instructed.
- Excluding `src/ui`: 19 suites, 216 tests pass; coverage All files 98.11% stmts / 97.75% branches / 96.57% funcs; domain gate passes. State suites: 4 suites, 21 tests (clock 3+, ids, library, hooks).
- `mobile/coverage` deleted.

### Known limitations
- `src/state` is not in `collectCoverageFrom`, so it has tests but no coverage gate.
- The hook reads synchronously in render; `getDb()` throws if a screen renders before migrations succeed (the layout renders no children until ready, and the error screen shows no hooks).
- Hooks call `getDayStartHour` every render (one small query); fine now, could move into the store later.


## Check (Sonnet)

### Verdict: PASS

ERRORS: none (no real defects found).

### Verification
1. API matches the contract (all signatures, DEFAULT_TASK, DB-unset error, unnamed-task support via name-required createTask). Extras (clearDb, resetStore, TABLES, TopicEntry) are test-only/harmless. Layering OK: state imports data + domain only, no RN/UI imports in actions; only `src/app/_layout.tsx` imports `@/state/*` (dbRef only).
2. `if (migrated) setDb(db)` in RootLayout render: safe. `db` is a module singleton, assignment is idempotent, no state set so no re-render loop, and it runs before `<ThemeProvider>` children render in the same pass, so first-render `getDb()` works. StrictMode double render harmless. An effect would be wrong (children render first), so render-body is the right choice. Impurity is benign (module variable, same value). Alternative (not needed): call `setDb(db)` at module level in `_layout.tsx`/`data/db.ts`, but that would hand out a db before migrations; current choice is better.
3. `useDataVersion` selects a primitive sum of listed counters: stable under zustand v5 (no new object/array identity), counters are monotonic so sums cannot collide; `bump` increments each listed table once (duplicates in args count once). Test confirms unrelated tables cause no re-render.
4. Actions bump the right tables (updateTopic -> topics, removeTopic -> topics+tasks, task writes -> tasks). now()/newId() used. moveTopic swaps in one transaction on the non-deleted list (deleted neighbours skipped by listTopics), no-op at ends/unknown id with no bump. Validation errors propagate before bump (tested). sortOrder is unique-by-construction (max+1), so swap is sound.
5. Hooks: useMemo deps `[db, version, dayKey]`, dayKey recomputed each render from now() + stored day-start hour, so a new day recomputes. Week = weekStartOf(dayKey)..+6. Deleted tasks/topics excluded (listTopics/listTasks filter). Tasks grouped per topic in repo order. Performance: each render of the host component does one settings query + the memo is skipped unless version/day changes, so the 7 loadDayBundle calls only run on data change, not on every render.
6. testSupport.ts is imported only by `src/state/__tests__`; no app code reaches it. `npx expo export --platform android` succeeded (single hbc bundle 3.6MB); output deleted. Note: a cleaner location would be a helpers dir excluded via testPathIgnorePatterns (like testDb.ts is), purely cosmetic.
7. Tests assert real behaviour (ordering, bump counts, cascade, week boundaries 25 Oct/2 Nov excluded, no re-render on unrelated bump). Teardown clears db, clock override and store.
8. Commands: typecheck clean; lint clean; `npx jest src/state src/data src/domain src/theme`: 19 suites, 216 tests pass. `mobile/coverage` deleted.

### Non-blocking notes
- `at = now()` is captured inside the memo, so `weekDots(..., at)` uses a time frozen until the next data/day change. Matters only if collectionItems treats "now" (e.g. a running session) in M4+; revisit then.
- No test covers the "new day recomputes" path (clock advance across day-start hour); logic is correct by inspection.
- `getDayStartHour` is queried on every render of the host component (cheap).
- `src/state` is outside collectCoverageFrom (already noted by the builder).
