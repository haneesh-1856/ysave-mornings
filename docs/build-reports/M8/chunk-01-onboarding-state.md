# M8 chunk 1 - Onboarding state

## What it is for
State layer for the first-run welcome flow: decides whether to show it, finishes it (one atomic write of day start, first topic, first task, `onboardedAt`) or skips it.

## Connections
- `src/data/repos/settings` (setSetting, getSetting, setDayStartHour), `topics` (createTopic, listTopics), `tasks` (createTask), `days` (listDays)
- `src/domain/types` (MINUTES, ColorKey, DayKey)
- `src/state/{clock,dbRef,ids,store,today}`

## Future connections
Chunk 2 UI (index redirect and Welcome screens) uses `needsOnboarding`, `useNeedsOnboarding`, `finishOnboarding` (opens Plan(todayKey)) and `skipOnboarding`.

## Files
- src/state/actions/onboarding.ts (new)
- src/state/hooks/useOnboarding.ts (new)
- src/state/__tests__/onboarding.test.ts (new)

## Build
- finishOnboarding checks the hour up front, then runs setDayStartHour, createTopic, createTask, setSetting('onboardedAt') in ONE db.transaction with one `now()`. Repo validators (topic name 1..24, task name 1..40, minutes 5..180 step 5) run inside it, so any failure rolls back everything; bump happens only after commit. This reuses repo rules instead of duplicating limits.
- Contract says minutes "5..240" but the repo's MINUTES is 5..180 step 5; the repo wins (as instructed).
- Checklist task = kind `'check'` (the TaskKind value; contract's "checklist" is not a kind) with minutes = MINUTES.min (column is required and validated).
- repeatMask 127 = all seven bits set.
- Did not call setDayStart action: it reconciles and rewrites future days rows, which is unneeded and would write a days row (making needsOnboarding false mid-flow). A fresh install has no days rows.
- onboardedAt stores the epoch `now()`.
- needsOnboarding uses `!= null` on getSetting (absent/null both mean not onboarded).

## Outputs
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- `npx jest src/state --silent`: 15 suites, 143 tests passed (new file: 17 tests, incl. 10 invalid-input cases)

## Errors
- Hook test failed: renderHook is async in this testing-library version; fixed by `await renderHook` and `await act(async ...)` as in dayStart.test.ts.

## Check

**Verdict: PASS** (independent check)

### Errors
None.

### Verified
- needsOnboarding: onboardedAt absent/null (getSetting returns undefined for both) AND no topics AND no days rows. The hook subscribes to settings, topics and days. Tested for empty db, skip, topic-only, days-row-only.
- finishOnboarding: the hour is checked before any write; the other validation runs inside one `db.transaction`. A bad input writes nothing. The repo `createTopic`/`createTask` open nested `db.transaction(tx)` calls on the tx handle. On device, drizzle's ExpoSQLiteTransaction.transaction uses SAVEPOINT / RELEASE / ROLLBACK TO, and the outer transaction rolls back on throw (`begin`/`commit`/`rollback` in ExpoSQLiteSession.transaction). Same `tx as typeof db` pattern as `moveTopic` in library.ts. In tests (better-sqlite3 driver) the 10 invalid cases include task-side failures after topic creation (empty or too-long task name, bad minutes), so the rollback is proven, not assumed.
- Task: mask 127 (all 7 bits), isDefault true, kind 'check' or 'timed', minutes MINUTES.min for a checklist, cue/treat null, created in the new topic.
- Day start: `setDayStartHour` is written inside the tx, then `todayKey(t, at)` reads it via getDayStartHour. With no days rows, `currentDayKey` uses the setting, so the returned key uses the new hour. Skipping the setDayStart action is safe: it only reconciles and rewrites future days rows, and none exist on a fresh install. Later `todayKey` and reconcile read the same setting. The `onboardedAt` value is the epoch.
- Bumps: 'settings' (hour and onboardedAt), 'topics', 'tasks'. 'days' is not touched, so no bump is needed.
- Layering: only src/state imports src/data here. No `any`. Style matches the neighbours.
- Tests are meaningful: they check stored rows and the db state after a rejection, and the hook flips after finish.

### Non-blocking notes
1. `listDays(db,'0000-01-01','9999-12-31')` loads all day rows just to test emptiness. It is cheap on a fresh or small db, but it is called by the index redirect on every launch and again on every settings/topics/days bump through the hook. Chunk 2 should read `needsOnboarding()` once at launch (it short-circuits on onboardedAt, so it is cheap after onboarding).
2. `hooks/useOnboarding.ts` imports a constant from `actions/onboarding.ts` (hooks -> actions). There is no cycle today. Keep it that way.
3. No test for the skip-then-days-row path, or for the returned key when the hour is later than now. For example, at 09:00 with hour 12 the key would be the previous day; this follows the domain rule and is not an error.

### Commands
- `npx tsc --noEmit`: clean (exit 0)
- `npm run lint`: clean
- `npx jest src/state --silent`: 15 suites, 143 tests passed
- `npx jest --silent` (full): 67 suites; 65 passed, 2 failed (GlassScreen, CalendarScreen: 3-4 timing failures, 85-99 s each, so load timeouts). Rerun alone: 2 suites, 20 tests passed. Unrelated to this chunk.
