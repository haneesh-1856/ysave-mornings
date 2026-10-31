# M8 build run — Polish + ship

Started 2026-10-30. Done when (roadmap): a friend can install the preview build and get through the welcome flow,
the golden path and a day close without help.

Same process: Sonnet builder → separate Sonnet checker → Opus fixer only on errors → Sonnet re-check.
Interfaces: contract.md (written before the code chunks).

| # | Chunk | Depends on | Report | Result |
|---|---|---|---|---|
| 0 | App icon + splash (assets and config only, no code) | — | this file | Done by lead, checked visually |
| 1 | Onboarding state (needs-onboarding rule, finish/skip actions) | M0–M7 | [chunk-01](chunk-01-onboarding-state.md) | PASS (no fix needed) |
| 2 | Welcome flow UI (SunMark, 5 steps, index redirect) | 1 | [chunk-02](chunk-02-welcome.md) | PASS (no fix needed) + lead: dev preview mode |
| 3 | Accessibility pass (contrast per palette, labels, 44 pt, font scale 1.3) | 2 | [chunk-03](chunk-03-a11y.md) | PASS after 1 Opus fix (error-text contrast → danger tokens) |
| 4 | Performance pass (Run tick, lists, blur on low-end Android) | 3 | [chunk-04](chunk-04-perf.md) | PASS after 1 Opus fix (Glass screen shows the low-end blur state; Confirm counts as a choice) |
| 5 | Carried fixes from M6/M7 (+ GlassScreen/CalendarScreen load timeouts) | 4 | [chunk-05](chunk-05-carried.md) | PASS after 1 Opus fix (Save/Discard draft back fallback) |
| 6 | Release plumbing (eas.json, CI, Maestro golden path, docs) | 5 | [chunk-06](chunk-06-release.md) | PASS (no fix needed; actions kept on v4 knowingly) |
| 7 | Color & glass split (tint = whole-app colour; glass = frost + blur only) | phone check | [chunk-07](chunk-07-color-glass.md) | PASS after 1 Opus fix (page text ≥ 4.5:1 over the blobs: per-blob calming) |
| 8 | The colour colours the whole app (accent, background, cards, chain) + palettes in the colour list | 7 | [chunk-08](chunk-08-whole-app-color.md) | PASS after 1 Opus fix (selected tint keeps accent ≥ 4.5:1) |
| 9 | Default changes after planning move the tick (both ways) | phone check | [chunk-09](chunk-09-default-after-plan.md) | PASS after 1 Opus fix (latest confirm wins: days.planUpdatedAt) |

## Chunk 0 · App icon + splash
**Choice (user, 2026-10-30):** "The Unfinished Sun", from the user's own reference image: a sun whose ring has one
missing segment. "The missing piece is intentional: an imperfect day is still a day that counts." Picked after the
icon rounds on the icon-lab page (https://claude.ai/artifact/3i7cKXxUFYuDvNwhqHw46Z).

**What it is for:** the app's identity on the home screen, store, Android themed icons and the launch screen.
**Connections:** `app.json` only. No `src/` file reads these assets.
**Future connections:** EAS preview build (M8) is the first place the icon and splash are visible; Expo Go always
shows its own. Store listing graphics can reuse `assets/brand/unfinished-sun.svg`.

Outputs:
- `assets/brand/unfinished-sun.svg`: the source mark, measured from the user's reference (yellow `#f7d45e` on
  charcoal `#28271d`; ring with an 85° opening at the top left; six rays, none at 45° or 225°).
- `scripts/make_icons.py`: draws every asset from that geometry (4× supersampled). Re-run with
  `python scripts/make_icons.py` after changing the geometry.
- `assets/images/icon.png` 1024 opaque (iOS and default; the OS rounds the corners).
- `assets/images/android-icon-foreground.png` 1024 transparent, mark at 86 % so it sits inside the adaptive safe zone;
  background is the solid colour `#28271d` in `app.json`.
- `assets/images/android-icon-monochrome.png` 1024 white mark for Android 13+ themed icons.
- `assets/images/splash-icon.png` 512 transparent, shown at 120 dp on `#28271d`.
- `assets/images/favicon.png` 48.

Config: `ios.icon` (template Icon Composer bundle `assets/expo.icon`) removed so iOS uses `icon.png`;
`android-icon-background.png` removed in favour of the background colour. The app's own root background stays
`#12151c` (Night owl); only the splash uses the icon's charcoal.

Checks: `npx expo config --type public` resolves every path; each asset composited and inspected (rounded square,
adaptive circle, themed tint, splash, favicon). Not yet seen on a device: needs the preview build.

Errors: none.

App ID (user, 2026-10-30): `com.han1856.ysavemornings` for both `android.package` and `ios.bundleIdentifier`. Permanent once
a build is shared.

## Phone checks
- **Welcome flow (chunk 2), passed 2026-10-30** in Expo Go via the dev-only Profile row "Preview welcome flow"
  (saves nothing). The real flow shows once, only on a never-used install; the preview row is `__DEV__`-only and
  absent from preview/production builds.

## Result (2026-10-30)
Chunks 0–6 done: 1, 2, 6 PASS on the first check; 3, 4, 5 PASS after one Opus fix each (error-text contrast →
danger tokens; Glass screen shows the low-end blur state; Save/Discard draft back fallback).
Lead re-ran: typecheck ✓, lint ✓, `npm run test:coverage` ✓: 74 suites, 875 tests, 98.4 % lines, domain 100 % lines.
No screen, route or ui file imports `src/data` or `getDb` (only the root `_layout.tsx` wires the db, as before).
CI actions stay on `@v4` knowingly (checker saw `@v7` in the READMEs; v4 still works).

Still open: Sunrise accent decision (burnt orange vs coral for shapes); Expo account → `! npx eas-cli@latest login`
→ preview APK build; phone check on the APK (icon, splash, first open, golden path); Maestro run on a device.

## Phone check · M8 list (2026-10-30)
- **Bug found, lead fix:** Done on a new task with no name closed the card and silently dropped the draft (the red
  "A task needs a name" only appeared after typing and clearing). Now `TaskCard` Done with a blank name stays open and
  shows the message; "Delete task" backs out of a draft. Tests: TaskCard (new), TopicsScreen (2 updated to the new rule).
- **Decision (user):** keep Sunrise's accent as burnt orange `#af5a3f`.
- **Color & glass (chunks 7–8), passed 2026-10-31** on the phone: palettes and colours colour the whole app.
- **Bug found 2026-10-31 (M5 check 2 path):** a checklist task closed with "Move to Saturday" did not show in the next
  day's plan. Under investigation as bug-01 (likely: next day already held the task in a draft/plan, so the move was
  skipped silently).
- **bug-01 fixed 2026-10-31** ([report](bug-01-moved-task.md)): the user's path was Saturday planned AND confirmed on
  Friday, then Friday closed with "Move to Saturday". When the next day's plan or draft already held the same task,
  `closeByHand` skipped the move silently. It now marks that row as forwarded ("from Friday"); otherwise it inserts it,
  as before. Checker PASS (re-traced the user's exact path for both cases). 76 suites / 917 tests. Carried: a stale
  Plan screen left open with unsaved edits across the close could drop the forwarded row on confirm (narrow; cheap
  hardening: keep forwarded rows in confirmPlan).
- **bug-02 fixed 2026-10-31** ([report](bug-02-moved-one-off.md)): user's exact path = one-off checklist A added in
  today's plan, tomorrow confirmed, today closed with "Move to tomorrow", then looked at the **Today tab**. A was saved
  for tomorrow (Plan, Planned, Calendar showed it) but the closed Today tab only said "Tomorrow is planned · N tasks".
  Now it lists tomorrow's tasks ("from <weekday>" for moved ones) and today's moved rows read "moved to <weekday>".
  Screen-level test of the exact path fails without the fix (checker reverted it to confirm). 77 suites / 924 tests.
