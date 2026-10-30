# M5 · Chunk 3 · Close screen + Today additions

## Build (Sonnet)

### Purpose
The screen where the user closes the day by hand (summary, a Move/Let-go choice per unticked task, the lid swinging shut, then "Plan tomorrow"), plus Today's soft chain, a "Close today" button, and closed-day rows announced as disabled.

### Files
- `src/app/close.tsx` (new, thin) re-exports `src/screens/CloseScreen.tsx`.
- `src/screens/CloseScreen.tsx` (new).
- `src/screens/TodayScreen.tsx` (edited): `Chain` from `useChain()` at the top; "Close today" ghost button (`router.push('/close')`) when today is open and has rows; `Locked` wrapper for closed-day rows. `useMorningRedirect` is NOT called here.
- Tests: `src/screens/__tests__/CloseScreen.test.tsx` (new, 8); `TodayScreen.test.tsx` (+4).

### Connections now
- CloseScreen -> `useCloseSummary` (numbers, unticked rows, `closed`, `tomorrowKey`), `closeToday` + `MissingOutcomesError`, `useSubmitGuard`, `Collection animateLid`, `CloseSummary`, `OutcomePicker`, `weekdayName`, `Haptics.notificationAsync`.
- Routing: "Not yet" / "Back to Today" -> `router.dismissTo('/(tabs)/today')`; "Plan tomorrow" -> `router.replace('/plan/[dayKey]')` with tomorrow's key.
- Today -> `useChain` -> `Chain`; Close button -> `/close`.

### Future connections
- M6 calendar: a day card for a closed day can link to read-only views; the Close screen's closed layout (summary + jar) is the model.
- M7: other collection looks must honour `animateLid` and draw their own "closed" decoration; the Close screen keeps `Collection` mounted so `closed` flips false -> true.

### Decisions
- One screen, two modes driven by data: `closed` (from `useCloseSummary`) switches the body from pickers to "Jar closed" (just closed) or "Today is closed" (opened closed). The jar stays mounted so the lid animates; no navigation on success.
- Empty day (not closed, 0 tasks): "Nothing to close yet" + "Back to Today". A closed empty day shows the closed layout.
- Missing choices: `MissingOutcomesError.missing` outlines those pickers (testID `outcome-missing`, alert red `#d4574e` same as Button's danger) and shows "Choose Move or Let go for N tasks" with `accessibilityRole="alert"` and a warning haptic; choosing a value clears that highlight. Other `ValidationError`s show their message. The guard resets on error so the button works again.
- Double tap: `useSubmitGuard.run` returns a `true` sentinel on success (closeToday returns void); busy stays true after success.
- Closed-day rows: the ui `TaskRow`/`CheckRow` have no disabled prop and ui files were off limits, so Today wraps each closed row in `<View accessible accessibilityLabel accessibilityState={{disabled:true}}>` (labels "Read, 5 minutes, start" / "Sums, not done"). No role on the wrapper, so role queries are unchanged.
- Jar scale 2 on Close.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npm test`: one failure in an earlier run (the double-tap test, since fixed); final `test:coverage`: 49/49 suites, 493/493 tests (CloseScreen 8; TodayScreen +4). Coverage All files 98.29% stmts / 98.61% branches / 96.59% funcs. `coverage/` deleted.
- A TopicsScreen debounce test failed once under load in an earlier run (known flake, carried forward in the README); it passed in the final run.

### Known limitations
- Real a11y of `Locked`: a plain accessible wrapper groups the row on iOS/Android, but the inner Pressable/Checkbox are not told they are disabled (taps are no-ops through `noop`). A proper `disabled` prop on `TaskRow`/`Checkbox` would be cleaner (ui change, not done).
- The double-tap test presses the stale button twice sequentially (overlapping `act()` is unsupported); it fails if the second tap re-ran the close (a second, warning haptic would fire).
- The Collection is mocked in the Close tests to read `closed`/`animateLid` props; the lid animation itself is covered in chunk 2's Jar tests.
- Nothing is prefetched for Plan tomorrow; it reads its own state.

### Exact phone checks
1. Plan today with 2 timed + 2 checks, tick one check, open Today: chain at top, "Close today" visible. Tap it: summary, 1 picker per unticked check, nothing preselected.
2. Tap "Close the jar" with no choices: red outlines + "Choose Move or Let go for 1 task", warning buzz. Choose, close: success buzz, lid swings shut on the big jar, picker area replaced by "Jar closed", "Plan tomorrow", "Back to Today".
3. "Plan tomorrow" opens the plan for tomorrow; pressing back must not return to Close (replace). A "Move" task shows in tomorrow's plan "from Thursday".
4. "Back to Today": one Today, closed banner, no "Close today", rows inert. TalkBack/VoiceOver: closed rows read as dimmed/disabled.
5. Start a timer, then Close: the timer stops at close time.
6. Reduce Motion on: the lid appears closed instantly. Re-open Close on a closed day: lid already closed, no pickers.
7. Layout of the big jar (scale 2) on a small phone, scrolling with 5+ pickers.

## Check (Sonnet)

**Verdict: PASS**

ERRORS: none.

Verified:
1. Layering OK: `close.tsx` is a 3-line re-export; CloseScreen uses only state hooks/actions + ui; no `useMorningRedirect` in Close or Today.
2. Close flow OK: summary, picker per unticked check with value null (no default), missing -> `outcome-missing` outlines + alert message + warning haptic and no write (closeToday throws before applyOps), single close (guard ref; double-tap test would fail on a second warning haptic), success haptic, Collection stays mounted so `closed` flips with `animateLid`, then Plan tomorrow (`replace` plan/[tomorrowKey]) + Back to Today (`dismissTo`). Opening a closed day shows "Today is closed" read-only. Empty day shows "Nothing to close yet". Running timer is ended at close (test asserts `endedAt === t`).
3. End to end (scratch test, deleted): plan Notes (check), Close with Move, then Today shows the closed banner, 0 Edit, 0 Close today, 0 Plan today; PlanScreen for tomorrow shows Notes ticked and "from Thursday".
4. Today: Chain at top (8-link label test), Close today only when open and non-empty, pushes '/close'.
5. Disabled rows: functional guard is present. When closed, TodayScreen passes `noop` for `onOpen`/`onToggle`, so tapping does nothing (no navigation, no toggle, and no haptic since `toggle` is not called). The gap is a11y only (the wrapper is `accessible`, so children are grouped and not individually reachable; the inner Pressable lacks `disabled`). Not an error.
6. Tests assert real behaviour (DB state, haptics, router calls, lid props).
7. Commands: `npm run typecheck` clean; `npm run lint` clean; `npx jest src/screens src/state --runInBand`: 18 suites, 160 tests, all pass. `coverage/` removed.

Non-blocking notes:
- The closed-day test only checks the a11y label/state; it does not assert that pressing a closed row does nothing. Adding that (press a closed idle row -> `mockPush` not called; press Sums -> still unticked) would lock in the noop guard.
- Today still shows "Plan tomorrow" and tomorrow Edit on a closed day; this is intended by the spec (tomorrow is plannable).
- Close's `Collection` is mocked, so the lid animation relies on chunk 2's Jar tests.
