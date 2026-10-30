# M4 · Chunk 4 · Run screen

## Build (Sonnet)

### Purpose
The screen where a timed task is run: Start / Pause / Resume / Stop, a big countdown with a bar, the "Done for today" celebration at 0, overtime with a gold note, the jar once done, and an inline note. Leaving never pauses (time comes from stored session timestamps).

### Files
- `mobile/src/app/run/[dayTaskId].tsx` (thin route: re-exports `RunRoute`)
- `mobile/src/screens/RunScreen.tsx` (`RunRoute`, `RunScreen`, `RunBody`, `RunClock`/`LiveFace`/`ClockFace`, `useNoteEditor`, `NoteCard`)
- `mobile/src/screens/__tests__/RunScreen.test.tsx` (14 tests)

### Connections now
- State: `useRunTask` (row, note; already mounts `useCompletionWatcher`), `useToday` (items/day for the jar), `useNow` (only in the ticking child), `useSubmitGuard`, actions `startTask/pauseTask/stopTask`, `setTaskNoteFromPlan`, `ValidationError` from `@/state/errors`.
- UI: `BigNumber`, `CountdownBar` (variant `t.look.bar`), `Celebration`, `Collection`, `TextField`, `Button`, `Card`, `Header`, `Screen`, `T`.
- `expo-keep-awake` ~58.0.3 (API checked in node_modules: `activateKeepAwakeAsync(tag)` / `deactivateKeepAwake(tag)`; `activateKeepAwake` is deprecated).
- Return to Today: `router.dismissTo('/(tabs)/today')`. Today (chunk 3) pushes `/run/[dayTaskId]`; the root Stack picks the route up automatically.

### Future connections
- M5 Close summary uses the same totals (sessions via the same helpers); Stop here ends the overtime session, so the day's focused time is final once stopped.
- M7: other bar styles / collection looks / motion plug in through `t.look.bar` and `Collection` with no change here.

### Decisions
- Ticking: `RunClock` renders `LiveFace` (calls `useNow`) only while a session is open; otherwise a static face. The parent re-renders only on data bumps (verified by a render counter on `useRunTask` that does not move over 70 s of ticking).
- Celebration is always mounted, `visible = completedAt !== null`; reopening a done task mounts it already visible (static text, no haptic). The jar's `animateLast` is true only if the task was not already done when the screen opened.
- Double-tap protection: `useSubmitGuard` plus a 500 ms cooldown reset. Plain "reset when state changes" would let the fast second tap hit the new button (Pause right after Start). `ValidationError` shows inline (e.g. "This day is closed"); other errors rethrow.
- Light haptic on Start comes from `Button` (it fires on every press, so Pause/Resume/Stop also tap lightly). Success haptic only from `Celebration`.
- Keep-awake is held while a session is open (running AND overtime, since overtime is still counting); released on pause/stop/unmount. Failures of the keep-awake call are swallowed.
- Note card shown only for tasks with a library task (`taskId`); one-offs have none. Debounce 600 ms, flushed on "‹ Today", "Back to Today" and unmount. Max 1000 chars (same as TaskCard).
- Gold note "Gold ring earned" only in `stopped` state with overtime >= 60 s.
- The back link is labelled "Today" (a11y) and the done button "Back to Today", so they do not clash.
- Invalid/unknown id, checklist task or missing param: "This task isn't running today" + "Back".
- After a lock past the end, the first frame can show "0 min left" until the watcher/foreground reconcile writes completion (a few ms); then it flips to overtime and celebrates once (it did complete while the screen was open). With the foreground reconcile done first, no celebration (tested).

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors; 1 warning in chunk 3's `TodayScreen.test.tsx` (require import), not mine.
- Run tests: `npx jest src/screens/__tests__/RunScreen`: 1 suite, 14 tests passed.
- Full run with coverage, excluding chunk 3's in-progress `TodayScreen.test.tsx` (the plain `npm test`/`test:coverage` hung for 25+ min because other builders' jest runs were spinning CPU at the same time; I could not stop their processes): 42 suites passed, 435 tests passed, All files 98.29% stmts / 98.6 branch / 96.59 funcs (same as before, domain gate holds). The one `FAIL` line is `src/data/__tests__/testDb.ts`, an artefact of my overriding `testPathIgnorePatterns` on the command line (it is a helper, not a suite). A final plain `npm run test:coverage` should be re-run once chunk 3 is finished.
- `mobile/coverage` deleted.

### Known limitations + phone checks
- Reanimated bar glide and the jar drop were not exercised visually (tests mock Reduce Motion).
- The keep-awake and haptic modules are mocked in tests.
- Phone checks:
  1. Start a 5-minute task on Run, lock the phone for the full 5+ minutes, unlock: the screen shows "Done · still going" with "+N min extra", the jar has the marble, no crash. Repeat leaving the app (home) instead of locking.
  2. While running, leave the phone untouched past the normal screen timeout: the screen must stay on. Pause (or Stop): it must go back to sleeping normally. Leave the screen with "‹ Today" while running: sleep timeout returns, timer keeps going on Today.
  3. Haptics: light tap on Start/Pause/Resume/Stop; one success buzz when the time hits 0 while watching; none when reopening a finished task.
  4. Run a task to 0, wait over a minute, Stop: "Gold ring earned" and a gold-ringed marble.
  5. Edit the note, leave immediately: the note is saved (reopen to check).

## Check (Sonnet)

**Verdict: PASS** (no blocking defects).

### ERRORS
None.

### Verified
1. Layering: RunScreen imports only `@/state/*`, `@/domain/*`, `@/ui/*`, `@/theme`; no `@/data`/`getDb`. `ValidationError` from `@/state/errors`. Route is a one-line re-export.
2. State machine matches doc 04 section 4: Start (idle), Pause (running), Resume (paused, startTask), Stop only in overtime (stopTask also throws if not done), stopped shows only "Back to Today" (no restart). Leave = `dismissTo('/(tabs)/today')`, never pauses. Checklist/invalid/missing id gives message + Back.
3. Ticking: `useNow` only in `LiveFace`; render-counter test proves the parent does not re-render over 70 s. ceil/floor come from `minutesLeftLabel`/`extraMinutesLabel`. Celebration is transition-based (ref seeded from first `visible`), so one haptic on screen, none on reopen/after-reconcile. Gold only in `stopped` with `isGold` (>= 60 s). Jar after done, `animateLast` only if not done at open.
4. Keep-awake: effect keyed on `awake` (running or overtime); cleanup releases on pause/stop/unmount/navigate-away. running -> overtime does not re-toggle (boolean unchanged). Overtime keep-awake is reasonable (the session is still counting and the user is likely watching). API matches expo-keep-awake 58 (`activateKeepAwakeAsync`, `deactivateKeepAwake`; sync `activateKeepAwake` is deprecated). No leak path found.
5. Guard + 500 ms cooldown: success keeps busy until cooldown; ValidationError resets via guard; other errors reset and rethrow; cooldown timer cleared on unmount; every success path resets (including no-op pause). No stuck-busy path.
6. Note: `setTaskNoteFromPlan`, 600 ms debounce, flushed on both back controls and on unmount, card only when `taskId` present; ValidationError shown inline.
7. Haptics: light from Button (every press), success only from Celebration.
8. Tests assert real DB/session state, haptic counts, render counter, keep-awake calls, note persistence.

### Non-blocking notes
- A Pause tapped within 500 ms of Start is ignored (button visibly disabled). Acceptable; a deliberate trade-off against the double-tap bug.
- Error colour `#d4574e` is hardcoded at RunScreen.tsx:143 (same literal exists in Button.tsx and TextField.tsx); consider a shared danger token later.
- Note debounce 600 ms vs 400 ms elsewhere; harmless but inconsistent.
- `ClockFace` in the non-live branch reads `now()` during render (fine, values are static when no session is open).

### Command outputs
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1 warning (TodayScreen.test.tsx:32 require import, chunk 3).
- `timeout 600 npx jest src/screens/__tests__/RunScreen.test.tsx src/state src/ui/__tests__ --runInBand`: 21 suites, 175 tests passed (57 s), no hang.
- `mobile/coverage` deleted.
