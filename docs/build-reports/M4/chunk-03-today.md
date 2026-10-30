# M4 · Chunk 3 · Today screen

## Build (Sonnet)

### Purpose
Replace the M3 Today placeholder with the real Today screen: planning entry cards, topic folds with timed and checklist rows, a pinned dock with today's jar, and the "n of m done" header. Only a running row ticks.

### Files
- `mobile/src/app/(tabs)/today.tsx`: now a thin re-export of `TodayScreen`. The TEMPORARY comment is gone.
- `mobile/src/screens/TodayScreen.tsx` (new): `TodayScreen` plus internal `TimedRow`, `RunningRow`, `TimedRowAt`, `CheckTaskRow`.
- `mobile/src/screens/__tests__/TodayScreen.test.tsx` (new, 10 tests).
- `mobile/src/screens/__tests__/PlannedScreen.test.tsx`: the old "Today entry points (temporary placeholder)" describe and its `TodayScreen` import were removed. Those cases now live in `TodayScreen.test.tsx`, rewritten against the real screen (Planned tests are untouched, 8 remain).
- No change to `src/state` or `src/ui`. `PlannedList` is no longer used by Today (the folds show the rows); Planned still uses it.

### Connections now
- Hooks: `useToday` (rows, done/total, items, closed), `usePlannableDays` (Plan today / Edit gating), `useDayPlan` (today and tomorrow `planConfirmedAt` and counts), `useNow` and `useCompletionWatcher` (from `useRunTask.ts`), action `toggleCheckTask`.
- UI: `Fold`, `TaskRow`, `CheckRow`, `Dock`, `Header`, `Button`, `Card`, `Screen` (the dock is the Screen `footer`), `weekdayName`, `minutesLeftText`, `extraText`.
- Navigation: tap a timed row calls `router.push({ pathname: '/run/[dayTaskId]', params })`. Plan, Planned and tomorrow-card buttons are unchanged from M3 (`push`, Today is the stack base).
- No `@/data` or `getDb` in the screen. `ValidationError` comes from `@/state/errors`.

### Future connections
- M5: the chain above the folds, the Close button (closed day already renders the read-only banner and hides Edit), the Morning screen.
- M6: a calendar day card can reuse the entry-card pattern.
- M7: the dock is the `layout: 'dock'` jar; corner and hero layouts replace `Dock` here. The `bar` variants are Run's concern.

### Decisions
- Header: title "Today", note "n of m done" (the `Header` component's own pattern). The note is omitted when there are no rows.
- Entry cards sit above the folds. Order: closed banner; Plan today (unplanned, open) or "Today is planned · n tasks" with See and Edit (Edit only while the day is plannable and open, ADR-009); tomorrow card with See and Edit; Plan tomorrow (primary unless tomorrow is planned).
- Empty state: "Nothing planned for today" sits below the buttons, alongside the Plan today button.
- Each `TimedRow` is `memo`ed. A running row renders `RunningRow` (own `useNow` at 1 Hz plus `useCompletionWatcher(row)`, called once per running row, per the chunk 1 fix). Idle, paused, overtime and stopped rows compute their text once at render time and do not tick.
- Closed day: timed rows and checks get a no-op handler (no push, no toggle, no haptic). Rows still show their state.
- Toggle: light impact haptic, then `toggleCheckTask`; a `ValidationError` (day closed meanwhile) is swallowed, anything else rethrows.
- Forwarded checklist rows pass `weekdayName(forwardedFromDayKey)` to `CheckRow`, which renders "from Wednesday".
- a11y labels for timed rows: `Read, 5 minutes, start`; `Read, 4 min left, running`; `Read, 3 min left, paused`; `Read, done, +2 min extra, gold`; `Read, done, gold` (gold only when the ring is earned).
- Fold open state is local (`useState`, default open, resets when the screen remounts). Fold subtitle is "x of y done".
- Dock gets `items` from `useToday` and `closed`; the new marble drops through the Jar's own `animateLast`.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npm test`: Test Suites 43 passed; Tests 445 passed (includes chunk 4's current files; none ignored).
- `npm run test:coverage`: 43 suites, 445 tests passed; All files 98.29 / 98.6 / 96.59 / 98.29, gate held.
- `mobile/coverage`: deleted.
- Targeted: `TodayScreen.test.tsx` 10 tests, `PlannedScreen.test.tsx` 8 tests, all pass.

Tests cover: header counts and fold subtitles, labels and "from Wednesday"; timed tap pushes `/run/[dayTaskId]`; check tap toggles, haptic, count goes 0 to 1 and back; running row ticks (5 to 4 min left) while the idle row's render count stays the same; the watcher flips the row to done when the clock passes the budget (count 1 of 4, "+0 min extra"); paused row; entry cards per state (none planned plus empty state, planned with See/Edit per ADR-009, tomorrow card); mounted Today updating when today is planned; closed day read-only (no Edit, no Plan today, taps do nothing).

### Known limitations and phone checks
- Test-environment quirk: under Jest fake timers, letting fake time pass beyond the completion instant inside the same `act()` never returned. The test advances exactly to the watcher timeout. I did not find a cause in app code (the same flow with real device timers is just a timeout plus a re-render); worth a glance by the checker.
- Jar drop animation and the Fold animation are mocked to `reduce` in tests.
- Fold open state is not persisted.
- The tab bar and dock: the dock is the Screen footer, so it sits above the tab bar space; check the spacing.
- Phone checks:
  1. Plan today, return to Today: folds in topic order with the right colours; header "0 of n done".
  2. Tap a timed row: Run opens (needs chunk 4). Start it, go back: that row alone shows "n min left" and counts down; others stay still.
  3. Let the task reach 0 with Today open: the row flips to done or "+0 min extra", the header count rises, a marble drops into the dock jar once.
  4. Tick a checklist item: light buzz, the check fills, the count updates; untick works. A forwarded item says "from <weekday>".
  5. Screen reader: timed rows read like "Read, 12 min left, running" and, when done, "done, gold" where earned.
  6. Today planned and open: Edit shows and reopens Plan with saved choices. Tomorrow planned: "Tomorrow is planned · n tasks" with See and Edit; Plan tomorrow turns ghost.
  7. Nothing planned: "Nothing planned for today" plus Plan today.
  8. Lock the phone during a 5-minute task and unlock after it should have ended: the row shows done and the count is right (relies on reconcile on foreground).
  9. Android back from Run returns to Today (Run uses dismissTo in chunk 4).

## Check (Sonnet)

**Verdict: PASS.** No real defects found in scope. No source or test files changed (scratch probe test created and deleted; `mobile/coverage` absent).

### ERRORS
None.

### Root cause of the fake-timer hang (item 1): test-environment only
- The hypothesis (app clock frozen, watcher re-arming) is NOT the cause. Probes (scratch test, deleted):
  - A: frozen clock set past the budget, `advanceTimersByTime(10 min)` in one act: hangs under default fake timers.
  - B: `setClockOverride(() => Date.now())` under modern fake timers (clock advances with fake time), same 10-minute advance: ALSO hangs.
  - Stepping 1 s at a time in B: all steps up to 299 s fine; the step that crosses completion (300 s) succeeds, then the next advance never returns. After completion `jest.getTimerCount()` stays at 1 and each `advanceTimersToNextTimer()` leaves the fake clock at 300000 with one timer pending: a same-instant (0 ms) self-rescheduling chain, so `advanceTimersByTime(n)` never reaches its end.
  - `doNotFake: ['setImmediate']` still hangs; `doNotFake: ['nextTick']` still hangs; `doNotFake: ['queueMicrotask']` PASSES, for both A (frozen clock) and B (advancing clock), with a 10-minute advance and "1 of 4 done" asserted.
- So the chain is made of `queueMicrotask` calls that Jest's modern fake timers turn into 0 ms fake timers. In this repo only react-native-reanimated/react-native-worklets (`reanimated/src/mappers.ts` queueMicrotask, `worklets` jest mocks with rAF as `setTimeout(0)`) use `queueMicrotask`; app code does not (grep: none in `src`). The chain starts at completion (Jar/Dock shared-value write when the marble is added, and the row re-render). I did not pin the single offending call (mocking Dock + reanimated mock did not remove it; I did not bisect further), but the `queueMicrotask`-faking mechanism is demonstrated.
- The watcher itself is fine: with a frozen clock `left` is constant, so it re-arms at `left + 25 ms` (not every 25 ms), which is bounded. With an advancing clock it fires once and sets the guard. The watcher computes `remaining` from the `sessions` captured with its `key`; a state change changes the key and re-arms, so stale closure is not a risk. Sessions with a future `startedAt` or a budget change both change `key`/`budgetSec` and re-arm correctly (not exercised, reasoning from code).
- The builder's workaround (stop exactly at the watcher timeout) does not hide an app bug; it just avoids the post-completion microtask chain. Recommended test fix: `jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })` and advance the whole span in one act, advancing `t` together with the timers (or use `setClockOverride(() => Date.now())` with `useFakeTimers({ now: NOW, ... })`). Then the "stop exactly" comment can go. Apply the same option in any other fake-timer test that crosses a completion (RunScreen).

### Verified OK
- Layering: no `@/data` or `getDb` in `TodayScreen.tsx`; route is the 3-line re-export; placeholder gone. `PlannedScreen.test.tsx` has no `TodayScreen` import or "temporary" block left; its 7 remaining tests are meaningful (list/Edit/Done tomorrow, removed topic, ADR-009 Edit for open planned today, no Edit for closed today, no-plan, past day, bad key).
- Entry cards: unplanned open -> Plan today; planned open -> "Today is planned · n tasks" + See + Edit (Edit gated by `days.includes(todayKey) && !closed`); closed -> banner, no Edit, no Plan today, See still shown; tomorrow card with See/Edit plus Plan tomorrow (ghost when planned). Header note "n of m done" (omitted when empty); empty state text plus Plan today.
- Rows: topic order comes from `useToday`; consecutive-topic grouping is correct because rows arrive sorted by topic. Only running rows own `useNow` and `useCompletionWatcher` (once per running row). Idle/paused/overtime/stopped compute at render only. `TimedRow`/`CheckTaskRow` are memoed, so the Quiz render-count assertion is valid. Timed tap pushes `/run/[dayTaskId]`; check tap = light haptic then `toggleCheckTask` (ValidationError swallowed); closed day passes no-op handlers. Forwarded label via `weekdayName(from)`. A11y labels include state and ", gold" / "done".
- Dock: `items` and `closed` from `useToday`, marble drop through the Jar's own `animateLast`.

### Non-blocking notes
1. Overtime rows (done, session still open) compute "+N min extra" and gold once at render, so the text does not grow while the app sits on Today. Spec says only running rows tick, so this is within contract; it refreshes on the next data change. Worth a phone check.
2. New day while the app stays open: `useToday` memoises `todayKey` on the data version only and nothing ticks across the day start, so Today keeps showing the old day until a data change, foreground reconcile (which bumps only when it changed something) or remount. This is `useToday` behaviour (chunk 1), not a chunk 3 defect; consider a day-boundary timer in M5.
3. `weekdayName(from)` is called without a locale (device default), the same as PlannedScreen/PlanScreen. Tests pass in en-US. The carried README item says "with locale"; acceptable if the device locale is intended.
4. Builder report says PlannedScreen has 8 tests; there are 7. Cosmetic.
5. One-frame-flash of the dropping marble (Jar writes `y.value = -distance` in an effect after first paint) cannot be seen in tests because motion is mocked to `reduce`; keep it as a phone check.
6. A closed day's rows still announce as buttons / checkboxes although they do nothing; consider `accessibilityState={{ disabled: true }}` later.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean (exit 0).
- `npm run lint`: clean (no warnings printed).
- `timeout 600 npx jest src/screens src/state src/ui/__tests__ --runInBand`: Test Suites 25 passed, Tests 213 passed (82 s), no hang.
- `mobile/coverage`: not present (deleted).
