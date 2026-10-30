# Chunk 4 · Close + rollover

## Build (Sonnet)

### Purpose
Pure domain rules for closing a day: by hand (doc 04 §6, Close screen) and automatically on app start/foreground (rollover), plus ensuring today's row and prefill (§3). Returns an `Ops` description; it never writes, creates ids or reads the clock.

### Files
- `mobile/src/domain/rollover.ts` (exports `Ops`, `missingOutcomes`, `closeByHand`, `rollover`; `DayBundle` imported from `./types`)
- `mobile/src/domain/__tests__/rollover.test.ts`

### Connections now
Imports `dayKey.ts` (`addDays`, `dayEndOf`, `dayKeyOf`), `timer.ts` (`pendingCompletions`), `plan.ts` (`prefillUnplanned`, idempotent) and `types.ts`. No existing file was modified.

### Future connections
- Chunk 7 `applyOps(db, ops, newId)` writes an `Ops` in one transaction and assigns ids (created days first, then inserted day tasks).
- M5 Close screen uses `missingOutcomes` (to ask for choices) and `closeByHand`.
- Root `_layout` runs `rollover` on start and on every foreground; the Morning screen shows when `autoClosed` is non-empty.
- Today's own running timed tasks are NOT part of rollover: the state layer calls `pendingCompletions` for today separately.

### Decisions & contract extensions
- **Contract extension:** `closeByHand`'s `next` param is `{ day: Day | null; dayTasks: DayTask[]; dayStartHour: number }` (was `{ day, dayStartHour }`). It needs the next day's rows for the unique (dayKey, taskId) index and for sortOrder appending.
- A moved task whose non-null `taskId` already has a row in the next day is not inserted (already planned there); its outcome is still `moved`. One-off tasks (null taskId) are always inserted.
- `closeByHand` throws `Error` if the day is already closed or `missingOutcomes` is non-empty (the UI prevents both). Outcomes for ticked/unknown/timed ids are ignored.
- Forwarded rows: budgetSec 0, same taskId/topicId/name/colorKey/kind, cue/treat copied, `forwardedFromDayKey` set, sortOrder after the next day's max. Timed tasks are never forwarded (only unticked check tasks get outcomes).
- Next day created (`planConfirmedAt` null) only when `next.day` is null; a confirmed next day gets no `createDays`.
- Rollover: today = `dayKeyOf(now, input.dayStartHour)`; each past open day ends at `dayEndOf(dayKey, day.dayStartHour)` (its own snapshot), open sessions are closed there, completions reconciled with `now = end`, unticked checks become `let_go`, `closedBy: 'auto'`. Days with no row are not created.
- Today with no row: `createDays` + prefill; with an unconfirmed row: prefill only (missing rows); confirmed: nothing. Idempotency is tested by applying the Ops to in-memory state and re-running.
- Edge: auto-close does not skip check tasks that already have a `closeOutcome`; an open day normally has none.

### Command outputs
- `npx tsc --noEmit`: clean.
- `npx expo lint`: clean (no output).
- `npx jest src/domain`: 7 suites, 148 tests passed (rollover suite: 21 tests).
- Coverage `rollover.ts`: 100% statements / 100% branches / 100% functions / 100% lines. `mobile/coverage` deleted.

### Known limitations
- Assumes sessions in a past day start before its end; a session starting after `end` (H changed oddly) would get `endedAt < startedAt`, which `timer.ts` clamps to 0 length.
- Multiple open sessions are all closed (the DB allows only one open session anyway).
- DST: relies on `dayEndOf`; tested on the 25-hour NY fall-back day (TZ America/New_York).

## Check (Sonnet)

**Verdict: PASS**

### ERRORS
None.

### Non-blocking notes
1. An open session whose day is NOT in `openDays` (day already closed, or not loaded) is never touched by `rollover`. In normal operation it cannot occur: `closeByHand` and `rollover` both close a day's sessions together with the day, and `startDecision` closes any other open session before a new start. It is neither handled nor documented in rollover.ts; chunk 7 / the state layer must pass every day with `closedAt = null` (and not a partial list) as `openDays`.
2. An open session belonging to today is untouched (only `dayKey < todayKey` days are processed). Documented as "NOT covered".
3. Contract text says prefill runs when today is unconfirmed "and no non-forwarded rows"; the code relies on `prefillUnplanned` idempotency instead (existing rows become updates, so only missing rows are returned). Behaviour is tested and consistent.
4. applyOps ordering requirements for chunk 7: single transaction; `closeSessions` before `completions` (completions assume ended sessions); `createDays` before `insertDayTasks` (FK on dayKey). `closeByHand` only inserts into `addDays(dayKey,1)` and creates that day only when absent; `rollover` inserts only into todayKey, created in the same Ops. `insertDayTasks` need ids assigned by newId. `closeDays.closedAt` for auto is the day end, not now.
5. Test gap (minor): no test where a moved task's next-day row is skipped while a different moved task is still inserted with correct sortOrder; no test of `closeByHand` with a session on a check-only day. Logic is simple and covered by 100% branches.

### Verification summary
- Exports/signatures match the contract (including `next.dayTasks`); imports only domain modules; pure (no clock, ids, IO).
- closeByHand: throws on closed day / missing outcomes; sessions closed at `now`; completions via `pendingCompletions` on the closed map (exact instant); outcomes only for unticked checks in sortOrder; timed never forwarded; drafts correct (next day key, forwardedFromDayKey, budgetSec 0, cue/treat, completedAt null, sortOrder after next max); createDays only when `next.day` null with the given H; skip on taskId already present; null-taskId always inserted.
- rollover: todayKey from current H; only past open days, sorted ascending, each closed at `dayEndOf(dayKey, own H)` with sessions cut at that end and completions at `now = end`; let_go outcomes; closedBy auto; today create/prefill/confirmed cases; multiple skipped days; idempotent (second run empty); interplay with closeByHand safe (closed day is excluded; forwarded rows count as existing); DST 25-hour day tested (jest global TZ America/New_York).

### Command outputs
- `npx tsc --noEmit`: clean (excluding the builder's in-progress src/data/repos).
- `npx expo lint`: clean.
- `npx jest src/domain`: 7 suites, 148 tests passed.
- Coverage rollover.ts: 100% statements / 100% branches / 100% functions / 100% lines. `mobile/coverage` deleted.
