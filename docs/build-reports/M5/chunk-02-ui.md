# M5 · Chunk 2 · Close + morning UI

## Build (Sonnet)

### Purpose
The presentational pieces the Close screen and Morning screen (chunks 3-4) compose: a lid that swings shut, the Move/Let go
choice per unticked task, the one-line close summary, the "A fresh page" sunrise card, and an a11y summary on the chain.
No state or routing; all props in, text out.

### Files (under `mobile/src/ui/`)
- `collection/Jar.tsx` (edited): new `animateLid?: boolean` on `CollectionProps`; `useLid` hook; lid overlay.
- `collection/Collection.tsx`: unchanged (spreads props, so `animateLid` passes through).
- `OutcomePicker.tsx`, `CloseSummary.tsx` (also exports `closeSummaryText`), `SunriseCard.tsx`: new.
- `Chain.tsx` (edited): a11y label only; visuals unchanged.
- Tests: `__tests__/CloseUi.test.tsx` (new); `collection/__tests__/Jar.test.tsx` (new `animateLid` describe).

### Connections now
- `OutcomePicker`: `CloseOutcome` from `@/domain/types`, `TopicColorKey`, `t.topic(key).color`, `T`.
- `CloseSummary`: `formatMinutes`, `T` (tabular numerals come from `T`).
- `SunriseCard`: `Card`, `T`, `react-native-svg`; theme tokens `t.c.sun`, `t.glow.fill`, `t.c.surface`, `t.c.line` only.
- `Jar`: `useMotion` (`animate`, `reduce`), same overlay technique as the marble drop.
- Nothing is wired into a screen yet.

### Future connections
- Chunk 3 (Close screen): `<Collection closed={day.closed} animateLid />` kept mounted, so closing flips `closed` false -> true and the lid
  swings; `OutcomePicker` per `useCloseSummary().unticked` with `nextDayName = weekdayName(tomorrowKey)`; `CloseSummary` from
  `done/total/focusedMs/extraMs`. Today: `Chain` with `useChain()`.
- Chunk 4 (Morning): `SunriseCard dayName={weekdayName(todayKey)} dayNumber`.
- M6 calendar mini jars: pass `closed` only (no `animateLid`), the lid shows closed.
- M7 other collection looks must implement `animateLid` (swing/close their own "closed" decoration; instant under Reduce Motion).

### Decisions
- Lid animation: with `animateLid` the lid is not drawn in the SVG; it is an `Animated.View` overlay holding a flat closed lid, posed open
  by a transform (lift 14 units, rotate -16 deg about the hinge) scaled by `1 - progress`. A shared `progress` goes 0 -> 1 via `animate(1)`. This
  avoids animated SVG props (same approach as the drop). Without `animateLid` the static SVG lid is unchanged.
- `useLid` seeds its ref and shared value from the first `closed`; mounting closed never plays. Only false -> true animates; true -> false
  (reopen) is instant. Reduce Motion: progress is set to 1 directly, `animate` not called.
- `testID`s `jar-lid-closed` / `jar-lid-open` are kept in both modes.
- `OutcomePicker`: `topicColor` is a `TopicColorKey` (as in M2-M4 components). The group has `accessibilityLabel={name}`; each radio is labelled
  "<name>: <choice>" with `checked` and `selected` states. The radiogroup View is deliberately not `accessible` so the radios stay focusable.
- `CloseSummary`: minutes are floored from ms (matches the "+0 min extra" rule); the extra part is hidden at 0; the spoken label uses commas
  ("3 of 4 done, 2h 10m focused, 12m extra").
- `Chain` label: "Last 8 days: 6 active, 2 rest"; "active" = every link that is not rest (today counts). The group is `accessible` so it reads as one item.
- `SunriseCard` sun and horizon are plain svg shapes (no testID: the test renderer does not expose svg testIDs here, so the texts and a11y label are asserted).

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npm test` (machine loaded by parallel builders): 46 suites; the only failure was `CloseUi` SunriseCard asserting an svg testID the test renderer does not expose; assertion removed, `npx jest src/ui/__tests__/CloseUi src/ui/collection`: 3 suites, 32 tests passed.
- `timeout 900 npm run test:coverage` (final): 46 suites, 467 of 468 tests passed; the one failure, `TopicsScreen › edits save: debounced name...` (not touched by this chunk), passed on its own (8/8), so it is a timing flake under load. Overall 98.29% statements.
- `mobile/coverage` deleted.

### Known limitations
- Phone checks needed: the feel and timing of the lid swing (theme easing, especially `springy`), that the overlay lid is positioned exactly on the
  jar rim at all scales (hinge maths assumes the 70 x 98 viewBox fits W x H with `meet`), and that it is not clipped on Android.
- The open lid in animate mode is a transform approximation of the static open pose (lift/rotation match the static values, not pixel-verified).
- `react-native-svg` gradient rendering in `SunriseCard` is verified only through the test renderer.
- The overlay lid draws above the glass (like the marble drop), not inside the jar clip.

## Check (Sonnet)

### Verdict: PASS (no blocking errors)

### ERRORS
None.

### Non-blocking notes
1. `Jar.tsx` (useLid): `was.current` is updated before the `enabled` check. If `animateLid` is false when `closed` flips and is switched on later, the progress stays 0 while `closed` is true, so an open lid is drawn on a closed jar. Spec usage (constant prop) never hits it. Hardening: when `!enabled`, set `p.value = closed ? 1 : 0` before returning.
2. `Jar.tsx` overlay pivot: the static open lid rotates about its own lifted top-left corner (17,-10). The overlay rotates about (17,16) before the lift, i.e. 12 units lower (about (17,2) after the lift). The open pose therefore sits about 3 units further left/lower than the static pose. Cosmetic and mid-swing only. At rest closed the transform is identity, so the lid is exactly on the rim at every scale: the `s`/`hingeX` maths is correct and the vertical letterbox offset is 0 because H limits `s` at every scale. The builder already lists this as a phone check.
3. No double lid at rest: the static SVG Rect is not drawn when `animateLid` is true, and only the overlay exists. Mounted closed -> progress 1, mounted open -> overlay posed open, reopen instant, Reduce Motion sets 1 directly (`animate` not called). `animateLast` code and its tests are unchanged (the Jar test diff is additions only). Without the prop the output is identical to before.
4. Chain: "active" counts today. This matches the contract example (8 links, 6 active, 2 rest) and is sensible; "rest" is the only non-active state.
5. OutcomePicker: no default (checked false for both when null), radiogroup/radio roles with `checked`, minHeight 44, texts "Move to <day>" / "Let it go", colours only from the theme. CloseSummary text is exact, the extra part is omitted at 0, minutes are floored and go through `formatMinutes`, and tabular numerals come from `T` (`fontVariant: tabular-nums`). SunriseCard: no hex/rgb literals (grep clean). Texts are correct. The `#fff` highlights are pre-existing in Jar.
6. TopicsScreen "edits save: debounced name..." flake: 5/5 isolated runs passed (8/8 each) and the whole `src/screens` suite passed in band (56/56). I could not reproduce it. Likely cause, test-only: `TaskEditor` debounces with a real 400 ms `setTimeout`, and the test asserts "not saved yet" (line 110) right after `await fireEvent.changeText`. On a heavily loaded machine more than 400 ms can pass before that `expect`, so the name is already saved and `saved()[0].name` is 'Read more'. The component logic (flush on timer/Done/unmount, blank name skipped) is sound and no product defect was found. Test-only fix: use `jest.useFakeTimers()` in that test, assert unsaved, `act(() => jest.advanceTimersByTime(400))`, then assert saved (the same applies to line 81).
7. Tests assert real behaviour: the Jar tests check the `animate` call count and arguments across flips, mount-closed, reopen, Reduce Motion and Collection pass-through. The CloseUi tests check text, a11y labels, checked state and the 44 pt height.

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean.
- `timeout 900 npx jest src/ui --runInBand`: 15 suites, 120 tests passed.
- TopicsScreen x5 in band: 8/8 passed each time. `npx jest src/screens --runInBand`: 56/56 passed.
- `mobile/coverage` deleted.
