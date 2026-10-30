# M5 · Chunk 1 · Close + morning state

## Build (Sonnet)

### Purpose
The state layer for closing a day by hand and for the Morning screen: a `closeToday` action, hooks for the Close
summary, the soft chain and Morning, and a day-boundary timer so an open app rolls over at midnight.

### Files
- `src/state/actions/close.ts` — `closeToday(outcomes)`, `MissingOutcomesError` (extends `ValidationError`, exposes `.missing: string[]`).
- `src/state/hooks/useCloseSummary.ts` — `useCloseSummary()`, types `CloseSummary`, `UntickedRow`.
- `src/state/hooks/useChain.ts` — `useChain()`.
- `src/state/hooks/useMorning.ts` — `useMorning()`, `markMorningSeen()`, `MORNING_SETTING` ('morningShownFor'), type `MorningView`.
- `src/state/hooks/useDayBoundary.ts` — `useDayBoundary()`.
- `src/app/_layout.tsx` — one line `useDayBoundary()` beside `useReconcileOnForeground()` (+ import).
- `src/app/index.tsx` — redirects to `/morning` when `useMorning().due`, else `/today`.
- `src/app/morning.tsx` — PLACEHOLDER (renders null) so typed routes accept `/morning`. **Chunk 4 replaces it.**
- Tests: `src/state/__tests__/close.test.ts` (8), `src/state/__tests__/morning.test.ts` (3).

### Connections now
- `closeToday`: `reconcile()` -> `loadDayBundle` (today + tomorrow) -> domain `missingOutcomes` / `closeByHand` -> `applyOps` -> `bump('days','sessions')`.
- `useCloseSummary`/`useChain`/`useMorning` read through repos + domain (`collectionItems`, `timer.focusedMs/overtimeMs`, `calendar.chain`, `stats.dayNumber`) and re-read via `useDataVersion`.
- `useDayBoundary` -> `reconcile()` + `bump('days')`, `AppState` 'change'.
- Index redirect reads `useMorning().due`.

### Future connections
- Chunk 3: Close screen uses `useCloseSummary` + `closeToday` (catch `MissingOutcomesError`, highlight `.missing`); Today uses `useChain`; "Plan tomorrow" uses `tomorrowKey`.
- Chunk 4: MorningScreen uses `useMorning`, `useChain`, `markMorningSeen()` on mount; replaces `src/app/morning.tsx`. The optional `useMorningRedirect()` (Today pushes `/morning` when `due` flips true) is NOT built here; chunk 3 or 4 can add it on top of `useMorning`.
- M6 calendar: same per-day `collectionItems(loadDayBundle)` approach as `useChain`.
- Profile stats: `dayNumber` as in `useMorning` (first `days` row key).

### Decisions
- Missing-outcomes error: subclass `MissingOutcomesError extends ValidationError` with `.missing` ids (field `'outcomes'`), message "Choose Move or Let go for N task(s)" (singular for 1).
- Already closed: `ValidationError('day', 'Today is already closed')`. No today row (cannot occur after reconcile): "Nothing to close yet".
- `markMorningSeen` lives in `useMorning.ts`; setting value is today's dayKey string; bumps `'settings'`.
- `useMorning.due` uses the earliest `days` row before today; `dayNumber` falls back to today's row when no earlier row. After reconcile the app always has a today row, so first-ever use is not due (no earlier row).
- `useDayBoundary`: fires at `dayEndOf(todayKey, H) + 250 ms`, waits in slices of at most 1 h and only reconciles/bumps once the day key has actually changed since arming; always re-arms; re-armed on AppState 'active'; cleanup clears timer and listener.
- `useChain` loads the 7 earlier days (today is always 'today' per domain); missing day = 0 items.
- Placeholder `morning.tsx` added (see Files).

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npm test`: 46 suites; 45 passed, 1 failed (`src/ui/__tests__/CloseUi.test.tsx`, chunk 2's in-progress file, 6 failing tests, ignored). 462 passed / 468 total. No hangs. Chunk 1's own two suites: 11/11 pass.
- `timeout 900 npm run test:coverage`: same counts; All files 98.29% statements, 98.6% branches, 96.59% functions. `coverage/` deleted.

### Known limitations
- The "Removed topic" fallback test is lenient: soft-deleting a topic also removes its default rows from view paths, so the fallback is exercised only if rows remain.
- Day-boundary tests drive a fake clock and fake timers together in 1 h slices; real-device timer drift is covered by the re-arm on foreground and the 1 h cap, not by a test.
- `useMorningRedirect()` not built (see Future connections).

## Check (Sonnet)

### Verdict: FAIL (2 errors; both small, state-layer / domain)

### ERRORS
1. **Missing `useMorningRedirect()`** (contract chunk 1, `src/app/index.tsx` bullet; M5 "done when: leave the app overnight, the morning shows a fresh page"). Expected: with the app left open (foreground, or backgrounded but process alive), when the day flips Morning is pushed once. Actual: `index.tsx` only redirects at cold launch; `useDayBoundary`/foreground `reconcile()` just bump 'days', `useMorning().due` flips true, and nothing navigates. So the Morning screen is unreachable on a new day unless the OS kills the app. Fix (new `src/state/hooks/useMorningRedirect.ts`, mounted once in an always-mounted component under the router, e.g. `RootStack` in `_layout.tsx` or the `(tabs)` layout; chunk 3/4 may instead call it from Today):
   ```ts
   export function useMorningRedirect(): void {
     const { due } = useMorning();
     const router = useRouter();
     const pathname = usePathname();
     const prev = useRef(due);                       // initial value: no push at mount (index.tsx handles launch)
     useEffect(() => {
       if (due && !prev.current && pathname !== '/morning') router.push('/morning');
       prev.current = due;
     }, [due]);
   }
   ```
   Push only on a false->true edge (markMorningSeen makes due false again, so it fires once per day). Add a test: render with a mocked router, set clock to next day, `reconcile()` inside `act`, expect one `push('/morning')`; call `markMorningSeen()`, expect no second push; re-render same day, no push.
2. **`rollover` prefills a CLOSED today** (`src/domain/rollover.ts:~178`, `if (today.day === null || today.day.planConfirmedAt === null)`; reachable now via `closeToday`). Expected (ADR-009/doc 04 section 6): a closed day is final. Actual (probed): seed defaults, `closeToday(...)` on the prefilled-but-unconfirmed today, then create a new default task and `reconcile()` -> today (closedAt set) gains row `N`; its jar total/unticked change after closing, and `closedAt` stays set. Fix: guard `if (today.day === null || (today.day.planConfirmedAt === null && today.day.closedAt === null))`; add a domain test (closed + unconfirmed day gets no insertDayTasks) and a state test mirroring the probe.

### Verified OK (probed with scratch tests, since deleted)
- closeToday: reconciles first (stale day auto-closed; second close then hits the new day); "already closed" error; MissingOutcomesError count/singular/plural and `.missing` ids; moved rows forwarded (tomorrow row created with dayStartHour, duplicates by taskId skipped, existing planConfirmedAt untouched); timed never forwarded (tomorrow had only C1); running session ended at now (probe: endedAt = close time, closedAt = now, closedBy 'user'); bump is exactly `('days','sessions')`; Today/useCloseSummary show closed and `usePlannableDays` becomes `[tomorrow]`; second call throws with 0 bumps and byte-identical day bundles.
- useCloseSummary: numbers match (focused counts open session to now; extra only timed overtime). The "Removed topic" worry is unfounded: after `removeTopic`, the rows remain in the day (A, C1, C2) and the probe showed both unticked rows with `topicName: 'Removed topic'`, so the builder's test does exercise the fallback.
- useChain: 8 links via 7 loadDayBundle calls, memoized on days/sessions/settings versions (not per render); uses day-start hour; missing days = rest.
- useMorning: first-ever no, new day yes, after markMorningSeen no, next day yes; dayNumber from earliest days row. Index redirect correct; placeholder harmless.
- useDayBoundary: logic review: single timer (arm clears previous), `min(wait, 1h)` slices, reconcile+bump only when key changed vs armedKey, re-arm after fire and on 'active' (the foreground reconcile listener is registered first in `_layout`, so it runs before re-arm), cleanup clears timer and listener; wait is computed from `dayEndOf` (DST-safe). Only edge: changing day-start hour mid-day is picked up at the next slice (<= 1 h), negligible.
- Layering: only `react-native` (AppState) imported in state, same as existing foreground hook; no UI imports.

### Non-blocking notes
- Probe tests logged act() warnings only because my probe bumped outside `act`; not a code issue.
- `closeToday` swallows nothing; reconcile exceptions propagate, fine.

### Command outputs
- `npm run typecheck`: clean. `npx eslint src/state src/app`: clean (full `npm run lint` also exited 0).
- `timeout 900 npx jest src/state src/domain src/data --runInBand`: Test Suites 24 passed / 24; Tests 271 passed / 271.
- `mobile/coverage`: not present (deleted/never created).

## Fix (Opus)

### Errors fixed
1. No in-app route to Morning when a new day starts while the app stays open.
2. `rollover` prefilled a CLOSED today (closed before its plan was confirmed).

### Root cause
1. Only `src/app/index.tsx` read `useMorning().due`, and it runs once at cold launch. `useDayBoundary` and the foreground reconcile bump `'days'`, so `due` flipped to true, but nothing watched for that change.
2. The prefill guard in `rollover` checked only `planConfirmedAt === null`. `closeToday` can close a prefilled day that was never confirmed (`planConfirmedAt` stays null), so the next reconcile treated it as unplanned and inserted missing default rows into a closed day.

### Changes
- `src/screens/useMorningRedirect.ts` (new, L11-21): `useMorningRedirect()` reads `useMorning().due`, `useRouter()`, `usePathname()` (expo-router 58.0.27: `usePathname(): string` and `useRouter(): ImperativeRouter`, checked in `node_modules/expo-router/build/hooks/*.d.ts`). `prev` ref starts at the first `due`, so nothing is pushed at mount (index.tsx handles launch). It calls `router.push('/morning')` only on a false->true edge and only when pathname is not `/morning`. It lives in screens, not `src/state`, because it uses the router.
- `src/app/_layout.tsx:10` import; `:29` one call `useMorningRedirect()` in `RootStack`, after `useReconcileOnForeground()` / `useDayBoundary()`. RootStack is always mounted under the router.
- `src/domain/rollover.ts:146-147`: guard is now `today.day === null || (today.day.planConfirmedAt === null && today.day.closedAt === null)`, with a comment (closed day is final, doc 04 §6).

### Tests
- `src/screens/__tests__/useMorningRedirect.test.tsx` (new, 4 tests, mocked `useRouter`/`usePathname`):
  - The clock moves to the next day and `reconcile()` + `bump('days')` run inside `act`: exactly one `push('/morning')`. After `markMorningSeen()` + rerender, there is no second push.
  - Same-day rerender and reconcile: no push.
  - Mount with `due` already true: no push.
  - Already on `/morning` when the day flips: no push.
- `src/domain/__tests__/rollover.test.ts:234`: a closed, unconfirmed today returns empty `createDays` and `insertDayTasks`.
- `src/state/__tests__/close.test.ts:97`: closes a prefilled today with `closeToday`, creates a new default task N, then runs `reconcile()`. The today bundle stays deep-equal to its state before reconcile.
- Both regression tests fail with the old guard (verified by temporarily reverting: 2 failed) and pass with the fix.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npx jest src/domain src/state src/screens --runInBand`: 23 suites passed; 291/291 tests.
- `timeout 900 npm run test:coverage -- --runInBand`: 47/47 suites, 474/474 tests (the chunk-2 UI suite now passes as well). All files 98.29% stmts / 98.61% branches / 96.59% funcs / 98.29% lines; `domain` 100/100/100/100 (`rollover.ts` 100%). `coverage/` deleted.

### Downstream
- Chunk 4: MorningScreen MUST call `markMorningSeen()` on mount. That makes `due` false again, so the redirect fires once per day and re-arms for the next day. If Morning does not mark itself seen, `due` stays true and no later edge fires, so Morning would not be pushed again on the following day until a cold launch.
- Chunk 4 replaces the placeholder `src/app/morning.tsx`. The `/morning` path the redirect compares against must stay the same.
- Chunk 3/4 must NOT add a second `useMorningRedirect()` on Today (it is already mounted in RootStack). Two mounts would push twice.

## Re-check (Sonnet)

### Verdict: PASS (both fixes verified, no regressions, no remaining errors)

### Remaining errors
None.

### Verified
- `useMorningRedirect`: `prev` ref seeded with first `due`, so no push at mount; pushes `/morning` only on false->true edge and not when pathname is `/morning`. Sole call site is `src/app/_layout.tsx:29` inside `RootStack` (grep: no other callers), which renders under the router.
- End-to-end probe (scratch test, deleted): mounted `useReconcileOnForeground + useDayBoundary + useMorningRedirect` with fake timers (`doNotFake: ['queueMicrotask']`), mocked router, clock override, mocked AppState.
  - Timer path: advancing hourly across the day boundary gave exactly 1 `push('/morning')`; a further hour gave no second push.
  - Foreground path: AppState 'active' on a new day gave exactly 1 push; after `markMorningSeen()`, the next new day pushed again (2 total).
- Rollover guard (`src/domain/rollover.ts:146-147`): tests cover null today (created + prefilled, rollover.test.ts:208), open unconfirmed today (prefilled, :217), closed unconfirmed today (no insertDayTasks, :234). State test close.test.ts:97 mirrors the earlier probe.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npx jest src/domain src/state src/screens/__tests__/useMorningRedirect.test.tsx --runInBand`: 18 suites passed, 239/239 tests.
- `mobile/coverage`: absent. Probe file removed.
