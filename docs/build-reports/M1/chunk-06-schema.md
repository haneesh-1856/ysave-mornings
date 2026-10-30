# Chunk 6 · SQLite schema + migrations + db

## Build (Sonnet)

### Purpose
Give the app durable storage: Drizzle schema for the six doc-03 tables, the first generated migration, a
driver-neutral `DB` type for repos, the expo-sqlite `db` instance, and a reusable in-memory test db.

### Files & installed packages
Packages (versions resolved): `expo-sqlite 58.0.14` (via `expo install`), `drizzle-orm 1.0.0-rc.5`,
dev: `drizzle-kit 1.0.0-rc.5`, `better-sqlite3 13.0.3`, `@types/better-sqlite3 ^9.6.0`, `babel-plugin-inline-import ^3.0.0`.
The `@rc` tags were used because the current Drizzle Expo docs install `drizzle-orm@rc` / `drizzle-kit@rc` (npm `latest` is 0.45 / 0.31).
`expo install` also added the `expo-sqlite` config plugin to app.json.

Files (all under `mobile/`):
- `drizzle.config.ts`, `babel.config.js` (inline-import for `.sql`), `metro.config.js` (adds `sql` to sourceExts); script `db:generate`; jest `testPathIgnorePatterns` entry so `testDb.ts` isn't run as a suite.
- `src/data/schema.ts`, `src/data/relations.ts`, `src/data/types.ts`, `src/data/db.ts`
- `src/data/migrations/20261029160948_nappy_microbe/{migration.sql,snapshot.json}` and generated `migrations/migrations.js`
- `src/data/__tests__/testDb.ts` (`createTestDb()` returns `{ db, sqlite }`), `src/data/__tests__/schema.test.ts`

### Connections now
- `schema.ts` imports only TYPES from `domain/types` (enums via `satisfies readonly ColorKey[]` etc., so a union change breaks the build).
- `db.ts` is the only file importing expo-sqlite; opens `ysave.db` with `enableChangeListener: true`, runs `PRAGMA foreign_keys = ON`, exports `db` and `migrations`.
- Generated SQL contains both partial indexes: `day_tasks_day_task_unique ON (dayKey, taskId) WHERE taskId IS NOT NULL` and `sessions_one_open ON sessions ((endedAt IS NULL)) WHERE endedAt IS NULL`. drizzle-kit expressed both natively, so no custom migration was needed. Also non-unique indexes on `day_tasks(dayKey)` and `sessions(dayTaskId)`.
- Tests run the same migration SQL through drizzle's better-sqlite3 migrator.

### Future connections
- Chunk 7 repos take `db: DB` first and use `createTestDb()` from `src/data/__tests__/testDb.ts`.
- Chunk 8 wires `db` + `migrations` into `src/app/_layout.tsx` with `useMigrations(db, migrations)` from `drizzle-orm/expo-sqlite/migrator`.
- Later sync relies on text UUID ids, `createdAt`/`updatedAt` on every row, and `deletedAt` soft deletes (note: `days.dayKey` and `settings.key` are natural keys).

### Decisions & doc conflicts
- Drizzle v1 (rc) differs from what older docs/memory say: `BaseSQLiteDatabase` no longer exists; the type is `SQLiteAsyncDatabase<'sync', unknown, TRelations>`, and `drizzle(client, { relations })` replaces `{ schema }`. So `DB = SQLiteAsyncDatabase<'sync', unknown, typeof relations>`, with a minimal `relations.ts` (`defineRelations(schema)`, no relations declared).
- Drizzle v1 migrations are folders (`<ts>_<name>/migration.sql`) plus a generated `migrations.js`, not flat `.sql` files.
- Drizzle v1 wraps driver errors as `Failed query: ...`; the SQLite message is on `error.cause`. Tests use a small `sqliteError()` helper. Repos that want to detect constraint violations (e.g. second open session) must inspect `cause`.
- Doc 03 says only library tables have `deletedAt`; settings/sessions/days/day_tasks have `createdAt/updatedAt` only, per task instructions. Doc 03 lists `schemaVersion` in settings "managed by migrations": not implemented (Drizzle tracks its own migrations table).
- `day_tasks.topicId` has no FK (doc says plain "topicId", FK only noted for taskId/dayKey); `forwardedFromDayKey` has no FK.
- `settings.value` is nullable text (JSON-encoded) since doc allows `onboardedAt` null.
- Booleans use `integer({ mode: 'boolean' })`.

### Command outputs summary
- `npx drizzle-kit generate`: 1 migration generated.
- `npx tsc --noEmit`: clean (includes type-level proof that both `BetterSQLite3Database` and `ExpoSQLiteDatabase` are assignable to `DB`).
- `npx expo lint`: clean.
- `npx jest src/data`: 6 tests pass (all tables/columns, one open session, many closed sessions, duplicate (dayKey, taskId) rejected, two one-offs allowed, FK violations). Full `npx jest`: 8 suites, 136 tests pass (includes other builders' work at that moment). `coverage/` not created.
- Bundling check: temporarily imported `db.ts` from `_layout.tsx` and ran `npx expo export --platform android` to the scratchpad: succeeded (3.6MB hbc), so the `.sql` inline-import and Metro config work. The temporary import and file were removed; `_layout.tsx` is unchanged.
- `npx expo-doctor`: 1 check failed, only "11 packages out of date" (pre-existing SDK patch drift, unrelated to this chunk); expo-sqlite is bundled in Expo Go, so no dev-build requirement is introduced.

### Known limitations
- Not run on a device/Expo Go: the expo-sqlite path (`useMigrations`, PRAGMA, change listener) is verified only by typecheck and bundling.
- Drizzle is on a release candidate (1.0.0-rc.5); API may shift before 1.0 final.
- `PRAGMA foreign_keys` is set via `execSync` (docs only show the async form); expo-sqlite's connection is shared, so it should persist.
- Partial index SQL emitted by drizzle-kit uses table-qualified columns in WHERE (`"day_tasks"."taskId" IS NOT NULL`); works in better-sqlite3 (verified by tests), expected fine in Android/iOS SQLite.

## Check (Sonnet)

**Verdict: PASS**

ERRORS: none.

Verified:
1. Schema vs doc 03: all 6 tables, column names, types, nullability, PKs, FKs (day_tasks.dayKey -> days, day_tasks.taskId nullable -> tasks, tasks.topicId -> topics, sessions.dayTaskId -> day_tasks), createdAt/updatedAt everywhere, deletedAt only on topics/tasks, booleans as integer boolean mode, enum unions tied to domain types with `satisfies`. Generated SQL has `UNIQUE (dayKey, taskId) WHERE taskId IS NOT NULL` and `UNIQUE ((endedAt IS NULL)) WHERE endedAt IS NULL`. Real better-sqlite3 inserts (existing tests) prove: second open session rejected, many closed sessions OK, duplicate (dayKey, taskId) rejected, multiple null-taskId one-offs OK, FK violations rejected. No FK on day_tasks.topicId: matches doc (plain "topicId", snapshot); harmless since topics are soft-deleted. settings.schemaVersion not implemented: acceptable (Drizzle's own migrations table tracks it); nothing reads it.
2. Contract: expo-sqlite imported only in db.ts (grep; schema.test.ts imports only a drizzle type). DB = SQLiteAsyncDatabase<'sync',...>; both better-sqlite3 db and ExpoSQLiteDatabase assign (tsc clean). Scratch test (deleted) proved sync `.all()/.get()/.run()` and `db.transaction` (commit and rollback) typecheck and work on a `DB`-typed better-sqlite3 db; expo session.d.ts declares sync `transaction<T>(...): T`. migrations.js shape `{migrations:{<folder>: sql}}` matches useMigrations. PRAGMA foreign_keys ON in db.ts (execSync) and createTestDb (verified = 1).
3. drizzle-orm and drizzle-kit both 1.0.0-rc.5; current Drizzle Expo docs say `drizzle-orm@rc`, `drizzle-kit@rc`. expo-sqlite ~58.0.14 not listed by `expo install --check` (only unrelated pre-existing patch drift: expo, expo-router, react-native, etc.). Risk: rc API may shift; versions use ^ so `npm update` could move rc; consider pinning exactly (non-blocking).
4. babel.config.js (babel-preset-expo + inline-import for .sql) and metro.config.js (sourceExts += sql) match the docs; jest works.
5. Layering: src/data imports only `../domain/types` (type-only) plus its own files.
6. Commands: `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npx jest` 8 suites / 136 tests pass; no coverage/ dir. Scratch test removed.

Non-blocking notes:
- Prefer exact pins for drizzle-orm/drizzle-kit rc versions (caret on a prerelease).
- `jest.global-setup.js` / testPathIgnorePatterns entry fine.
- Device path (useMigrations, execSync PRAGMA) unverified by runtime; builder disclosed this.
