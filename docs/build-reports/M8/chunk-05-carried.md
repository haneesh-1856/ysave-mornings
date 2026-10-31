# M8 chunk 5 · Carried fixes

## What it is for
Closes the small items carried forward from M6 and M7 so they do not follow the app into release.

## Connections
- `setDayStart` (settings action) now hands its single instant to `reconcile`.
- Day start and Plan screens use `router.canGoBack()`; Plan is reached by `router.replace` from onboarding and has no history on first run.
- The Plan screen owns the NOT_PLANNABLE and draft-hint copy. Calendar and Glass tests only changed in title and timeout.

## Files
`src/state/actions/reconcile.ts`, `src/state/actions/settings.ts`, `src/screens/DayStartScreen.tsx`, `src/screens/PlanScreen.tsx`;
tests: `src/state/__tests__/dayStart.test.ts`, `src/screens/__tests__/{DayStartScreen,PlanScreen,OnboardingToPlan,CalendarScreen,GlassScreen}.test.tsx`, `src/ui/__tests__/Controls.test.tsx`.

## Build
1. `reconcile(at = now())` gained an optional instant; `setDayStart` reads `now()` once and passes it to reconcile and both writes. Test: a clock that advances on every read is read exactly once.
2. DayStart and Plan Back: `canGoBack()` ? `back()` : `replace('/today')`. Tests for both branches on both screens (mocks gained `canGoBack`/`replace`).
3. NOT_PLANNABLE now: "You can plan today until it closes, or tomorrow. Days further out can be drafted from the Calendar with "Plan ahead"." Updated PlanScreen and OnboardingToPlan tests.
4. Draft hint "A draft is saved for later. You confirm it the evening before." Placement: the M6 note gives no position, so it sits at the top of the Plan screen in draft mode (under the date line) while the day has no saved draft (`!hasDraft`). Tests: shown when unsaved, hidden once saved.
5. CalendarScreen test at line 180 renamed to: a far-future day reads "Not planned yet." and offers neither Plan nor Edit.
6. Calendar and Glass files: motion was already mocked and setup shared, and the tests pass alone in ~27 s total; no cheap leaner change found, so each file got `jest.setTimeout(15000)` with a comment.
7. ChipSet: new test for the default path (hint "Double tap to clear", deselect gives `null`) and that `clearable={false}` has no hint and does not clear. (A basic clear assertion already existed.)

## Outputs
`npx tsc --noEmit` clean; `npm run lint` clean; full `npx jest --silent` run 1: 74 suites, 873 tests, all passed; run 2: 74 suites, 873 tests, all passed. No failing tests in either run.

## Errors
None open.

## Check

### Verdict: FAIL (one error)

**Errors**
1. `PlanScreen.tsx` `saveDraft` (line ~155) and `discardDraft` (line ~167) still call `router.back()` directly. A draft day (Plan ahead, a day after tomorrow) is reachable with no history: the app has the URL scheme `ysave` and the route `src/app/plan/[dayKey].tsx`, so a cold deep link `ysave://plan/<far-future-day>` opens Plan in draft mode as the first screen. Save draft then does nothing visible and the user stays on the screen (Discard draft likewise, after the data is already deleted). Fix: use the same `goBack()` (canGoBack ? back : replace('/today')) in both handlers, and add a no-history test for each.

**Verified OK**
- `reconcile(at = now())`: all other callers (close.ts, run.ts, useDayBoundary, useReconcileOnForeground, useRunTask) call `reconcile()` with no argument, so behaviour is unchanged; none passes a stored `at`. `setDayStart` reads `now()` once (new test with an advancing clock asserts exactly 1 read).
- Back fallback is correct on DayStart and Plan (BackButton); tests cover both branches on both screens.
- Copy: NOT_PLANNABLE and DRAFT_HINT agree with ADR-010 (draft is not a plan; confirmed the evening before, when it is tomorrow) and are calm. Hint is gated `isDraft && !plan.hasDraft` (hasDraft = planDraftedAt set and not confirmed); tests show it when unsaved and hide it once saved.
- ChipSet test is meaningful (hint text, deselect gives null, `clearable={false}` removes the hint and does not clear).
- No `any`; layering fine (screens use hooks/actions only).

**Notes**
- The DayStart error text now uses `color="danger"` instead of a hard-coded `#d4574e`: a good fix, but not listed in the contract.
- The 15 s `jest.setTimeout` is limited to CalendarScreen and GlassScreen tests, as asked, with a comment and a recorded reason (pass alone, flake under parallel load). The comment mentions "28 tints", which fits Glass but not Calendar; wording nit. GlassScreen.test.tsx also contains chunk 4 low-end tests, not chunk 5.
- Stale test title at CalendarScreen.test.tsx renamed as the contract required.

**Commands**
- `npx tsc --noEmit`: exit 0, no output.
- `npm run lint`: exit 0, clean.
- `npx jest --silent`: 74 suites passed, 873 tests passed, 0 failed.

## Fix (Opus)

**Change**
- `src/screens/PlanScreen.tsx`: `saveDraft` and `discardDraft` now call the existing `goBack()` helper (canGoBack ? `router.back()` : `router.replace('/today')`) instead of `router.back()`. No logic duplicated; the only remaining `router.*` calls are inside `goBack()` and the confirm `replace` to Planned.
- `src/screens/__tests__/PlanScreen.test.tsx`: added "Save draft with no history (cold deep link) goes to Today" and "Discard draft with no history (cold deep link) goes to Today" (each asserts no `back`, exactly one `replace('/today')`, and the data written/deleted). The with-history Discard test now also asserts `replace` was not called; the with-history Save draft test already did.
- `src/screens/__tests__/CalendarScreen.test.tsx`: timeout comment now says "a full month grid of day cells" (the "28 tints" wording belongs to the Glass file).

**Results**
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, clean.
- `npx jest src/screens/__tests__/PlanScreen.test.tsx --silent`: 21 passed.
- `npx jest --silent`: 74 suites, 875 tests, all passed. No failing tests.

## Re-check

### Verdict: PASS

**Errors**: none.

**Notes**
- `saveDraft` (line 155) and `discardDraft` (line 167) in PlanScreen now call `goBack()`. Grep: the only `router.back()` calls in PlanScreen and DayStartScreen are inside their `goBack` helpers (each with `canGoBack ? back : replace('/today')`); no unguarded call remains.
- New no-history tests (Save draft, Discard draft) set `canGoBack` false and assert `back` not called and exactly one `replace('/today')`, plus the data effect. With the old bare `router.back()` they would fail (`back` called, `replace` not). Verified by reading, not by mutation.
- CalendarScreen.test.tsx comment wording corrected.

**Commands**
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0, clean.
- `npx jest --silent`: 74 suites, 875 tests passed, 0 failed.
