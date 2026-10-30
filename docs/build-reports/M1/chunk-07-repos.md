# Chunk 7 · Repositories + applyOps

## Build (Sonnet)

### Purpose
The storage API the state layer will call: one repo file per area (topics, tasks, days, sessions, settings) plus
`applyOps`, the single bridge from domain `Ops` to SQLite. All functions are synchronous, take `db: DB` first,
take `now` (and `newId`) explicitly, and return domain types only.

### Files (under `mobile/src/data/`)
- `errors.ts`: `ValidationError(field)`, `ConflictError`, `NotFoundError`, and `sqliteMessage(error)` (walks `error.cause`).
- `repos/mappers.ts` (private): row -> domain mappers (`toTopic/toTask/toDay/toDayTask/toSession`, nullable `?? null`) and the `Executor` type.
- `repos/topics.ts`: `listTopics, getTopic, createTopic, updateTopic, softDeleteTopic`.
- `repos/tasks.ts`: `listTasks, getTask, createTask, updateTask, setTaskNote, softDeleteTask` (+ limit constants).
- `repos/days.ts`: `getDay, listDays, loadDayBundle, loadOpenPastDays, saveConfirmedPlan, setCheckCompleted, setCompletedAt`.
- `repos/sessions.ts`: `getOpenSession, startSession, endSession`.
- `repos/settings.ts`: `getSetting, setSetting, getDayStartHour, setDayStartHour`.
- `repos/ops.ts`: `applyOps(db, ops, newId, now)`.
- Tests in `__tests__/`: `topics, tasks, days, sessions, settings, ops` (`.test.ts`, node env, `createTestDb()`): 30 new tests.
- No barrel file: callers import the repo file they need (keeps the surface explicit).

### Connections now
- Imports: `drizzle-orm`, `../schema`, `../types` (DB), and TYPES/consts from `domain/types`, `domain/plan` (type of `confirmPlan` result), `domain/rollover` (type `Ops`). No `src/state`, no clock, no `expo-sqlite`.
- Tests also call the real domain functions (`buildPlan/confirmPlan/rollover/closeByHand/startDecision`) against loaded data.
- Drizzle v1 API verified against the installed typings by compiling: `db.select().from().where().orderBy().all()/.get()`, `insert().values().onConflictDoNothing()/onConflictDoUpdate({target,set})`, sync `db.transaction(tx => ...)` (throw = rollback), `max/inArray/isNull/lt/gte/lte` from `drizzle-orm`. `tx` is typed via `Pick<DB, 'select'|'insert'|'update'|'delete'>` (`Executor`).

### Future connections
- Chunk 8 and later `src/state` actions call these with `clock.now()` and a uuid `newId` (see Known limitations for the source).
- M2 Topics CRUD: `listTopics/createTopic/updateTopic/softDeleteTopic`, tasks CRUD, `setTaskNote`. Catch `ValidationError` to show field errors.
- M3 Plan: `loadDayBundle` + `listTopics/listTasks` -> `buildPlan` -> edits -> `confirmPlan` -> `saveConfirmedPlan`.
- M4 Timer: `getOpenSession` -> `startDecision` -> `startSession({closeSessionId})`; `endSession` for pause/stop; `setCompletedAt` for `pendingCompletions`; `setCheckCompleted` for `toggleCheck`. Catch `ConflictError` and re-read.
- M5 Close/rollover: `loadOpenPastDays` + `loadDayBundle` -> `rollover` / `closeByHand` -> `applyOps`.
- Sync later: every row has `createdAt/updatedAt`, library rows `deletedAt`; every write here bumps `updatedAt` with the passed `now`.

### Decisions & contract/doc conflicts
- Signature shapes: `createTopic(db, {name,colorKey}, now, newId)`, `createTask(db, input, now, newId)`, `updateTopic/updateTask(db, id, patch, now)`, `softDelete*(db, id, now)`, `setTaskNote(db, id, note, now)`. Contract only fixed `applyOps(db, ops, newId, now)` and the "db first, now explicit" rule.
- Text limits (doc 07 requires limits, gives no numbers except what the task set): topic name 1-24, task name 1-40 (both trimmed), cue/treat <= 80 (trimmed; empty becomes null), note <= 1000. The cue/treat/note numbers are my choice; change the constants in `tasks.ts` if the UI wants others.
- `minutes` is validated 5-180 step 5 for both kinds (the column is NOT NULL and a check task keeps a default for its row).
- `getTopic/getTask` return deleted rows too (history). `listTasks` is ordered by topicId then sortOrder; `listTopics` by sortOrder.
- Appended `sortOrder` = max + 1 over ALL rows (including soft-deleted) so ordering never collides with hidden rows.
- `softDeleteTopic` only stamps rows whose `deletedAt` is null, so a repeat delete keeps the first timestamp.
- `loadDayBundle`: `sessionsByDayTask` has an entry (possibly `[]`) for every day task; tasks sorted by `sortOrder, id`; sessions by `startedAt, id`.
- `saveConfirmedPlan`: order is days row (insert-or-ignore, so an existing row keeps its own `dayStartHour`) -> deletes (scoped to that dayKey) -> inserts -> updates -> `planConfirmedAt = now` only `WHERE planConfirmedAt IS NULL`. Update rows rewrite all non-key fields of the DayTask.
- `startSession`: closes `closeSessionId` (only if still open) then inserts, in one transaction. Any error whose chain contains "UNIQUE constraint failed" becomes `ConflictError`; the stale-`closeSessionId` case therefore also surfaces as `ConflictError` and rolls back. Other errors (e.g. FK) pass through unchanged.
- `endSession` is idempotent (a closed session keeps its original `endedAt`); returns the Session; `NotFoundError` if absent.
- `setSetting(undefined)` stores JSON `null`. `getSetting` returns `undefined` when absent, null-valued, or corrupt JSON. `getDayStartHour` also falls back to 4 on a corrupt stored value.
- `applyOps` uses a plain insert for `createDays` (not insert-or-ignore) so a duplicate day surfaces as an error rather than silently hiding a rollover bug; the whole transaction then rolls back.
- Domain rule on deleted tasks (doc 04 section 11): the day's rows are untouched by `softDeleteTask`; but `buildPlan` only keeps a deleted task's row if the `tasks` it receives include that task. The state layer must pass `listTasks()` plus `getTask(id)` for deleted tasks referenced by the day's rows (the days test does exactly this). No contract/doc conflict found.

### Command outputs
- `npx tsc --noEmit`: exit 0.
- `npx expo lint`: exit 0, no output.
- `npx jest`: 15 suites, 195 tests pass (data: 7 suites, 36 tests; 30 new this chunk: topics 4, tasks 5, settings 5, sessions 5, days 8, ops 3; schema.test.ts has the other 6). Jest printed "A worker process has failed to exit gracefully" at the end of the full run (open in-memory better-sqlite3 handles are not closed in tests; no failures). `mobile/coverage` not created.

### Known limitations
- **uuid source for chunk 8:** `expo-crypto` is published for SDK 58 (`expo-crypto@58.0.x` on npm) but is NOT installed in this project yet. Recommend `npx expo install expo-crypto` and `newId = () => Crypto.randomUUID()` in `src/state` (synchronous, v4, Expo-maintained, works in Expo Go). Avoid `Math.random` ids and a `uuid` package (needs a `getRandomValues` polyfill on Hermes). Repos stay agnostic: they only take `newId`.
- `topicId` of a task/day_task is not checked to exist in the repos beyond the DB's own FK (tasks.topicId FK; day_tasks.topicId has no FK per chunk 6).
- `updateTask` can move a task to another topic (`topicId` in the patch) but does not re-sort it there.
- `saveConfirmedPlan` trusts the `confirmPlan` result (it does not re-run the "keep rows with progress" rule); the FK on sessions is the backstop if a caller deletes a row that has sessions.
- Repos not exercised on a device/Expo Go (expo-sqlite sync transaction path verified only through types and better-sqlite3).
- Tests do not close their in-memory databases (see jest warning above).

## Check (Sonnet)

### Verdict: PASS (no blocking defects)

### ERRORS
None.

### Verified
1. Layering: all repos take `db: DB` first; no `Date.now`/`new Date`; ids only via `newId`; no `any`, no React/`src/state` imports (grep clean). Exported signatures use domain types (row types stay in mappers.ts, private). Value imports from domain are only `MINUTES` and `DEFAULT_DAY_START_HOUR` (both in `domain/types.ts`, allowed). Type-only imports of `confirmPlan` (domain/plan) and `Ops` (domain/rollover) are erased at runtime but literally exceed "domain/types ONLY" (see notes).
2. Mapping: nulls via `?? null`, booleans/enums via typed columns; sortOrder = max+1; `listTopics/listTasks` filter deletedAt; `getTopic/getTask` return deleted rows (scratch test confirmed).
3. Validation matches doc 03: topic 1-24, task 1-40 (trimmed), minutes 5-180 step 5 integer, repeatMask 0-127, dayStartHour 0-23, kind/colorKey enums. Scratch tests: 25-char topic and minutes=7 throw.
4. Transactions: softDeleteTopic cascades in one txn (topic + tasks stamped, scratch confirmed). saveConfirmedPlan order matches spec (ensure day, deletes scoped to dayKey, inserts, updates, planConfirmedAt only WHERE null; existing day keeps its own H via onConflictDoNothing). startSession closes then inserts in one txn. applyOps order is createDays, closeSessions, completions, outcomes, closeDays, insertDayTasks, with ids and createdAt/updatedAt stamped. Rollback test is genuine: I ran the same ops minus the bad insert in a scratch test and the earlier steps DID take effect (session closed, task completed, day created); the forced FK failure (day_tasks.dayKey -> days, foreign_keys ON) is on the last step, and the real test asserts all three tables unchanged. Drizzle v1 better-sqlite3 `transaction` wraps `client.transaction(...)` (throw = rollback). expo-sqlite session does `begin` / `commit` / `rollback` via sync `run` in try/catch, so throw = rollback there too; nested calls use savepoints.
5. updatedAt bumped on every update path, including soft deletes, applyOps, setCompletedAt, setCheckCompleted, endSession, setSetting upsert.
6. ConflictError: `sqliteMessage` walks 4 levels of `error.cause`; second open session test (scratch) throws ConflictError and leaves one session. Nonexistent dayTask FK error passes through unchanged and the closeSessionId close is rolled back (original session stayed open).
7. Settings: JSON encode/decode, undefined -> null, corrupt JSON -> undefined, bad stored hour -> 4.
8. Jest worker warning: did not reproduce in my run (clean exit). Plausible cause is unclosed better-sqlite3 handles. Trivial fix: have `createTestDb()` callers track `sqlite` and `afterEach(() => sqlite.close())` (or register closing in testDb.ts via a module-level list closed in a shared afterEach/setupFilesAfterEnv).

### Non-blocking notes
- `ReturnType<typeof confirmPlan>` / `Ops` type-only imports from plan.ts/rollover.ts: no runtime coupling, but contract text says domain/types only. Cleaner: move `ConfirmResult` (and `Ops`) into `domain/types.ts`, or amend the contract to allow type-only imports. Recommend amending the contract.
- `listTasks` orders by topicId (a uuid) then sortOrder, not topic sortOrder; callers wanting display order must group by topic. Fine, but document.
- `updateTopic/updateTask` succeed on soft-deleted rows; `softDeleteTopic/Task` on a missing id is a silent no-op (inconsistent with NotFoundError elsewhere).
- `createTask`/`updateTask` do not check the topic exists/not deleted (FK only); `updateTask` topicId patch is not re-sorted.
- Cue/treat/note limits (80/80/1000) are the builder's choice; doc has no numbers.
- contract says `applyOps(db, ops, newId)`; implementation adds `now` (required for createdAt/updatedAt). Reasonable; update contract text.
- Coverage gaps are minor: tasks.ts lines 112-113 (updateTask sortOrder non-integer branch), days.ts:38, mappers.ts:49, settings.ts:25 (branch-level only).

### Commands
- `npx tsc --noEmit`: exit 0. `npx expo lint`: exit 0, no output.
- `npx jest`: 15 suites, 195 tests pass, no worker warning this run.
- `npx jest src/data --coverage ...`: 7 suites, 36 tests pass. Data repos: 96.58% stmts, 93.37% branch, 100% funcs, 98.8% lines (ops/sessions/topics 100%; days 94.7% branch; tasks 87.7% branch). errors.ts 100%. db.ts 0% (expo-sqlite, expected). `mobile/coverage` deleted; scratch test deleted.
