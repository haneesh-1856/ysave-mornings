# Chunk 8 · Clock, startup wiring, coverage gate

## Build (Sonnet)

### Purpose
Last M1 chunk: the single time source, id creation, migrations at app start, and the coverage gate.

### Files
- `mobile/src/state/clock.ts` (+ `__tests__/clock.test.ts`): `now()`, `setClockOverride(fn | null)`. Only reader of `Date.now()`.
- `mobile/src/state/ids.ts` (+ `__tests__/ids.test.ts`): `newId()` via `expo-crypto` `randomUUID()`. `expo-crypto ~58.0.7` added with `npx expo install`.
- `mobile/src/app/_layout.tsx`: `useMigrations(db, migrations)`; splash stays up until fonts AND migrations are done (or either errored); on migration error renders a themed `Screen` with the message.
- `mobile/src/data/db.ts`: `migrations` now exported with a cast (see Decisions).
- `mobile/src/data/__tests__/testDb.ts`: tracks opened in-memory handles and closes them in an `afterEach` (no test files needed changing).
- `mobile/package.json`: jest `collectCoverageFrom` + `coverageThreshold`.

### Connections now
- `_layout` -> `data/db` (db, migrations) -> Drizzle `useMigrations`.
- `state/clock` imports only the `Epoch` type from domain. `state/ids` imports only `expo-crypto`. Nothing calls them yet.

### Future connections
- M2-M5 `src/state` actions call `now()` and `newId()` and pass results into repos/domain (domain stays id/time-free).
- M5: rollover on start and on foreground, at the TODO comment in `_layout.tsx` (after migrations succeed).
- Dev fast-forward menu uses `setClockOverride`.

### Decisions
- Migrations typing: drizzle-orm 1.0.0-rc.5's `useMigrations` typings demand a `journal`, but its runtime only reads `migrations` (verified in `node_modules/drizzle-orm/expo-sqlite/migrator.js`) and drizzle-kit generates no journal. Cast in `db.ts` with a comment instead of faking a journal.
- If fonts fail we still render (system font), as before; if migrations fail we show the error view, not the app.
- Error copy: "Your data is safe on this phone; please restart the app. This screen does not delete anything." The only promise is that this screen itself does not delete data.
- jest-expo stubs `expo-crypto` (`randomUUID` returns undefined), so `ids.test.ts` mocks it with Node's `crypto.randomUUID` and asserts v4 shape. This means the real native call is only exercised on a device.
- Coverage threshold applies to `./src/domain/` only (95 on all four); `src/data` is collected and reported but ungated. Excluded: `__tests__`, `src/data/migrations`, `src/data/db.ts`. `coverage/` was already in `.gitignore`.
- Test DB cleanup is registered by importing `testDb.ts` (module-level `afterEach`).

### Command outputs (from `mobile/`)
- `npm run typecheck`: pass, no output.
- `npm run lint`: pass, 0 errors, 0 warnings.
- `npm test`: 17 suites, 200 tests passed (~6 s); no "worker failed to exit gracefully" warning.
- `npm run test:coverage`: pass, threshold met.
- `npx expo-doctor`: 1 check failed, only patch-version drift (11 packages: @expo/ui, expo, expo-constants, expo-font, expo-image, expo-linking, expo-router, expo-splash-screen, expo-system-ui, jest-expo, react-native 0.88.0 vs 0.88.1). Not touched; fix later with `npx expo install --check`.
- `npx expo export --platform android`: succeeded (one Hermes bundle, 3.6 MB; migration `.sql` inlined). Output deleted; `mobile/coverage` deleted.

Coverage (src/domain and src/data):

```
File            | % Stmts | % Branch | % Funcs | % Lines
All files       |   97.77 |    97.19 |   96.57 |   98.28
 data           |   80.64 |      100 |      40 |      80
  errors.ts     |     100 |      100 |     100 |     100
  relations.ts  |     100 |      100 |     100 |     100
  schema.ts     |    64.7 |      100 |       0 |    64.7   (lines 30,59-74,88-93)
  types.ts      |       0 |        0 |       0 |       0
 data/repos     |   96.58 |    93.37 |     100 |    98.8
  days.ts       |     100 |    94.73 |     100 |     100
  mappers.ts    |     100 |    96.42 |     100 |     100
  ops.ts        |     100 |      100 |     100 |     100
  sessions.ts   |     100 |      100 |     100 |     100
  settings.ts   |     100 |    94.11 |     100 |     100
  tasks.ts      |   89.55 |    87.71 |     100 |   96.07   (lines 112-113)
  topics.ts     |     100 |      100 |     100 |     100
 domain         |     100 |      100 |     100 |     100   (all 8 files 100%)
```
(schema.ts uncovered lines are column default callbacks; types.ts is type-only.)

### Known limitations (phone-only verification)
Nothing in `_layout` is unit-tested (no jest test renders it); real SQLite, the real `expo-crypto` call, and splash timing are only checked on a device.

Manual phone test:
1. From `mobile/`: `npx expo start`, open on the phone (Expo Go if it supports the modules, otherwise a dev build: `npx expo run:android`).
2. Fresh install (or clear app data): splash shows, then the app opens to the normal tabs with no error screen and no blank flash. Splash should not hide before content appears.
3. Kill and reopen the app: it opens again normally (migrations are a no-op the second time).
4. Error path (optional): temporarily edit the SQL file in `src/data/migrations/*/migration.sql` to invalid SQL on a fresh install. You should see "Couldn't open your data", the error text, and the "Your data is safe on this phone; please restart the app" line, themed. Revert the edit afterwards.

## Check (Sonnet)

### Verdict: PASS

No real defects. Non-blocking notes below.

### ERRORS
None.

### Findings per check item
1. Clock: grep of `Date.now`, argless `new Date(`, `performance.now`, `CURRENT_TIMESTAMP`, `unixepoch`, `strftime`, SQL/Drizzle defaults across `src/` (non-test) hits only `src/state/clock.ts:7`. `dayKey.ts:13` is `date.getFullYear()` etc., not a clock read. Override is re-evaluated per call and `null` restores real time (tests cover both).
2. `ids.ts`: `expo-crypto` exposes a synchronous `randomUUID()` (v4); the builder's note that jest-expo stubs it to undefined is the reason for the mock. Mock using Node `crypto.randomUUID` is reasonable (hoisting via `mock` prefix is correct). Real native call is device-only, acknowledged.
3. `_layout.tsx`: hooks unconditional (`useFonts`, `useMigrations`, `useEffect` before the early return). `if (!ready) return null` means `Stack` (all routes) is not mounted until `migrated || migrationError` and fonts settled, so no screen can touch the db before success; on migration error only `MigrationError` renders (Stack never mounts). Splash hides only when `ready` (fonts done-or-failed AND migrations done-or-failed), so the error view is visible. Fonts fail + migrations succeed: renders app with system font (intended). Error view uses `ThemeProvider`, `Screen`, `T`; ThemeProvider has no db dependency. Migrator source (`drizzle-orm/sqlite-core/async/session.js` `migrateSync`, used by `expo-sqlite/migrator.js`): `BEGIN`, run every pending migration's statements plus the bookkeeping INSERT, `COMMIT`; on any throw `ROLLBACK` (its own failure swallowed) and rethrow. SQLite DDL is transactional, so a failed migration leaves the db at its previous version. The copy "Your data is safe on this phone ... does not delete anything" is therefore honest for migration failures. Caveats (non-blocking): if the ROLLBACK itself fails, or the error is not a migration error (open failure, disk full), the "safe" wording is a soft assurance rather than a guarantee; and the error text is the raw SQLite message.
4. Cast in `db.ts`: confirmed safe at runtime. `expo-sqlite/migrator.js` `readMigrationFiles({ migrations })` destructures only `migrations`; `journal` appears only in the `.d.ts` (line 13). Keys are `<14-digit timestamp>_<name>` which `formatToMillis(key.slice(0,14))` needs; the generated `migrations.js` matches. Less hacky options: none worth it (a fake `journal: { entries: [] }` is no better; a typed local wrapper is what exists). Re-check on each drizzle bump; consider a one-line test that `migrations.migrations` keys match `/^\d{14}_/`.
5. Coverage gate: key `./src/domain/` is a directory path, so jest aggregates all matched files under it and applies all four metrics. Verified empirically: `npx jest --coverage --coverageThreshold='{"./src/domain/":{"lines":101}}'` printed "Coverage for lines (100%) does not meet "./src/domain/" threshold (101%)" and exited 1. `collectCoverageFrom` excludes `__tests__`, `src/data/migrations`, `src/data/db.ts`. Note: a new untested file under `src/domain/` is included in collection (it matches `src/domain/**/*.ts`), so the gate would catch it. `src/state` is not collected (non-blocking; add `src/state/**/*.ts` later if wanted).
6. Test cleanup: `testDb.ts` registers a module-level `afterEach` that closes every tracked handle; it is excluded from test discovery via `testPathIgnorePatterns`. Full `npm test` output contains no "worker failed to exit" warning.
7. Manual test: step 1 is fine in Expo Go: `expo-sqlite` and `expo-crypto` are bundled in the SDK 58 Expo Go client (both are Expo SDK modules in Go; the dev-setup doc already tells the user to use Go). Step 4 is NOT good advice: it edits a generated migration, contradicting "never edit a shipped migration", risks being committed, and on a non-fresh db an edited file would not even rerun (already recorded). Use the corrected steps below.
8. Commands: see below.

### Non-blocking notes
- Future table-rebuild migrations emit `PRAGMA foreign_keys=OFF`, which is a no-op inside the migrator's transaction; handle when such a migration appears (M2+).
- `useMigrations` runs migrations synchronously inside an async function on mount; fine at this size.
- `_layout.tsx` has no test; accepted and documented.

### Corrected manual steps (error path)
Do not touch `src/data/migrations/**`. Instead, on a fresh install (clear app data):
1. Temporarily in `src/data/db.ts` change the export to
   `export const migrations = { migrations: { ...migrationsFile.migrations, '99999999999999_bad': 'SELECT * FROM nope;' } } as unknown as Parameters<typeof useMigrations>[1];`
2. Reload: expect the themed "Couldn't open your data" screen with the SQLite error text and the safe-data line; no tabs.
3. Revert with `git checkout -- src/data/db.ts` (or undo the edit), clear app data once (the failed run rolled back, so nothing is half-applied), reload: app opens normally.
Steps 1-3 of the builder's list (fresh install, kill and reopen) stay as written.

### Command outputs (run from mobile/)
- `npm run typecheck`: pass, no output.
- `npm run lint`: pass, no warnings.
- `npm test`: 17 suites, 200 tests passed (5.7 s), no worker warning.
- `npm run test:coverage`: pass; All files 97.77 / 97.19 / 96.57 / 98.28; `domain` 100 on all four. Forced 101 threshold: fails with exit 1 (above). `mobile/coverage` deleted.

### Doc 04 coverage map (all in mobile/src)
- §1 Day boundary: `domain/__tests__/dayKey.test.ts` (dayKeyOf, dayStartOf/EndOf, DST, H boundary); snapshot per day: `rollover.test.ts` ("own dayStartHour snapshot"), `data/__tests__/days.test.ts` (dayStartHour validation). "Changes take effect next day": covered by the snapshot rule tests.
- §2 Plan generation: `plan.test.ts` (table, filtering/ordering, confirmed plan, editors, addOneOff, canConfirm, confirmPlan, plannableDays).
- §3 Unplanned day: `plan.test.ts` (prefillUnplanned, prefilled rows) + `rollover.test.ts` ("rollover: today").
- §4 Timer: `timer.test.ts` (focused/remaining, completionTime, overtime/gold, labels, timerState, startDecision, pendingCompletions) + rollover (open session closed at day end). "Leaving Run screen does not pause" is a UI behaviour, no rule code (M3).
- §5 Checklist: `timer.test.ts` toggleCheck.
- §6 Closing a day: `rollover.test.ts` (missingOutcomes, closeByHand, auto-close, today, idempotent).
- §7 Collection items: `collection.test.ts`.
- §8 Calendar glow: `calendar.test.ts` (glows).
- §9 Soft chain: `calendar.test.ts` (chain).
- §10 Stats: `stats.test.ts` (dayNumber, counts, focusedHours, topicWeeklyMinutes, weekDots).
- §11 Deleting: `data/__tests__/tasks.test.ts`, `topics.test.ts` (soft delete), `days.test.ts` ("soft-deleted tasks keep their day_tasks snapshot"), `plan.test.ts` (deleted task rows stay).
No doc 04 rule lacks a test, apart from the UI-only "leaving Run screen does not pause" and "confirm text says past days keep items", both screen-level (M2/M3).
