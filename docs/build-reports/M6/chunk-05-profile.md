# M6 · Chunk 5 · Profile + Day start

## Build (Sonnet)

### Purpose
The Profile tab (avatar, lifetime stats, settings list, "Try a look" switcher) and the pushed "My day starts" screen that changes the day-start hour.

### Files
- `src/screens/ProfileScreen.tsx` — screen (also exports `hoursText`). `src/app/(tabs)/profile.tsx` is now `export default ProfileScreen`.
- `src/screens/DayStartScreen.tsx` — screen (also exports `explanation`). `src/app/settings/day-start.tsx` — thin route.
- Tests: `src/screens/__tests__/ProfileScreen.test.tsx` (4), `DayStartScreen.test.tsx` (4).

### Connections now
- Profile: `useProfileStats()` (dayNumber, daysShowedUp, focusedHours, marbles), `useDayStart().hour`; `StatTiles`, `SettingRow`, `Card`, `hourText`. "My day starts" row pushes `/settings/day-start`.
- Look row shows the current preset name ("Custom" if the mix matches none); "Full settings in M7" under it; Glass "Coming in M7", Sounds/Friends & teams "Coming later", Reminders "Not decided". The M0 "Try a look" switcher is kept below the card.
- Day start: `useDayStart()`, `setDayStart(h)` on every pick (ValidationError caught via `@/state/errors` and shown inline), `HourPicker`, `router.back()` for "‹ Profile" and a `BackHandler` that does the same.
- No root-stack registration needed: `RootStack` is an auto-routing `<Stack>` with `headerShown:false`, so `settings/day-start` is picked up from the file.

### Future connections
- M7 replaces the Look/Glass rows with real settings screens (same `SettingRow`s gain `onPress`).
- Sounds / Reminders / Friends rows are placeholders.

### Decisions
- Focused hours: >= 10h rounds to whole ("14h"); under 10h one decimal, trailing zero dropped ("3.5h", "2h", "0h"). 9.99 -> "10h".
- Explanation example hour rule: H=0 -> "Your day starts at midnight, so each day is one calendar day." (no late-night carry-over is true); H=1 -> "12:30 AM"; otherwise "1 AM" (always before the start, so always yesterday).
- "Today still ends at X. From tomorrow, each day ends at Y." shows whenever the hour of `todayEndsAt` differs from the setting (hour only; day-start hours are whole).
- Back uses `router.back()` (screen is pushed from Profile, a normal stack pop), not `dismissTo`.
- Error text uses the same alert red literal as CloseScreen (no theme danger colour exists).

### Command outputs
- `npm run typecheck`: clean. `npm run lint`: clean (0 warnings after `--fix` on test import order).
- Targeted jest: 8/8.
- `timeout 900 npm run test:coverage`: 56 suites, 594 tests passed. `mobile/coverage` deleted.

### Known limitations + phone checks
- Not run on a device; Android back tested via the BackHandler listener.
- Check 1: Profile shows plausible stats; tap "My day starts", pick 6 AM: the line "Today still ends at 4:00 AM. From tomorrow, each day ends at 6:00 AM." appears, and "‹ Profile" / Android back returns to Profile with "6:00 AM" shown.
- Check 2: "Try a look" still changes the theme and the Look row updates its name.
- Check 3: Profile is a tab, so the tab bar is visible there and hidden on Day start.

## Check (Sonnet)

**Verdict: PASS**

Ran: `npm run typecheck` clean; `npm run lint` clean; targeted jest 8/8 in about 17 s total (no slow 'Try a look' test observed: motion is mocked, no real timers). No `coverage/` left behind.

ERRORS: none.

NOTES
1. Contract matches: avatar "Y", "You", "Day N with YSave Mornings"; the three StatTiles with `hoursText`; all SettingRows with the right values and tags; the Look row shows the preset name or "Custom" with "Full settings in M7"; "Try a look" is kept and works (the test confirms the Look row updates). The "My day starts" row pushes `/settings/day-start`.
2. DayStart: HourPicker reflects the stored hour. A pick calls `setDayStart` at once. `useDayStart` re-reads because `setDayStart` bumps 'settings' and 'days'. Errors go through `ValidationError` from `@/state/errors`. The "Today still ends at X..." line shows exactly when `getHours(todayEndsAt)` differs from the setting and hides when it is set back. The route is auto-registered by the Stack.
3. The explanation is true for hours 0-23: H=0 gets a separate midnight sentence. H=1 uses 12:30 AM. H=2..23 use 1 AM, which is before H, so it is yesterday. Verified by reasoning.
4. Layering is clean: no `src/data` or `getDb` imports in screens or routes. a11y is fine (radiogroup/radio, labelled back button, live regions, hidden avatar, header role).
5. Test gaps (not blocking):
   - No test that the "Today still ends" line disappears when the hour is set back.
   - No test for the ValidationError path.
   - No test of non-zero stats or the Look row's "Custom" fallback.
   - The explanation test only spot-checks 0, 1 and 4, not all 24 hours.
6. The `act(async...) without await` console.error comes from the test setup/renderThemed, not the new code. Cosmetic.
7. `router.back()` has no fallback when there is no history (for example a deep link), and the error red `#d4574e` is a literal. Both are minor and noted by the builder.
