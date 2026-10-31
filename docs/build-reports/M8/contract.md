# M8 contract — Polish + ship

Binding interfaces between chunks. A chunk may add private helpers; anything another chunk uses is listed here.
Layering stays: screens/ui never import `src/data` or `getDb`; only `src/state` calls repos, `now()`, `newId()`.

Done when (roadmap): a friend can install the preview APK and use it from first open.

## Chunk 0 · App icon + splash (done, lead)
See README. Assets only; `assets/brand/unfinished-sun.svg` is the mark's source geometry.

## Chunk 1 · Onboarding state
Files: `src/state/actions/onboarding.ts`, `src/state/hooks/useOnboarding.ts`, tests in `src/state/__tests__/`.

```ts
// src/state/hooks/useOnboarding.ts
/** True when the welcome flow should show: no `onboardedAt` AND no topics AND no days rows.
 *  Existing installs (any topic or day) are treated as onboarded, so nobody already using the app sees it. */
export function useNeedsOnboarding(): boolean;
export function needsOnboarding(): boolean; // same rule, non-hook (for index redirect and tests)

// src/state/actions/onboarding.ts
export interface OnboardingInput {
  dayStartHour: number;                         // 0..23
  topic: { name: string; colorKey: ColorKey };  // name trimmed, 1..24 chars (repo rules)
  task: { name: string; minutes: number | null }; // null = checklist task (kind 'check'); else timed minutes (repo MINUTES: 5..180, step 5)
}
/** Sets the day start, creates the topic and one task (repeats every day, isDefault true so it is pre-ticked),
 *  records `onboardedAt = now()`. Validation errors throw before anything is written. Returns today's key so the
 *  caller can open Plan(today). Bumps settings, topics, tasks. */
export function finishOnboarding(input: OnboardingInput): { todayKey: DayKey };
/** "I'll set things up myself": records `onboardedAt` only. */
export function skipOnboarding(): void;
```
`ONBOARDED_SETTING = 'onboardedAt'` (already a known settings key, doc 03).

## Chunk 2 · Welcome flow UI
Files: `src/ui/SunMark.tsx`, `src/screens/OnboardingScreen.tsx`, `src/app/onboarding.tsx`, `src/app/index.tsx`.

```ts
// src/ui/SunMark.tsx — the app icon's mark drawn with react-native-svg from assets/brand/unfinished-sun.svg geometry
export function SunMark(props: { size: number; color?: string /* default theme accent-safe yellow #f7d45e */ }): JSX.Element;
```
- `index.tsx`: `needsOnboarding()` → `/onboarding`; otherwise the existing Morning/Today rule.
- Steps (one screen, internal step state, back goes to previous step):
  1. Welcome: SunMark, "YSave Mornings", one line on the idea, privacy line "Everything stays on this phone.
     Uninstalling the app deletes it." Buttons: "Start", "I'll set it up myself" (→ `skipOnboarding()` → `/today`).
  2. Day start: reuse `HourPicker`; default 4 AM; copy explains a day ends at this hour.
  3. First topic: name + 6 colour swatches (reuse `TextField`, `ColorSwatches`).
  4. First task: name + Checklist / 15 / 30 / 45 / 60 / 90 (reuse `ChipSet`).
  5. "Plan today" → `finishOnboarding(...)` → `router.replace('/plan/' + todayKey)`.
- Next is disabled until the step is valid. All copy calm, no pressure.

## Chunk 3 · Accessibility pass
- New `src/theme/__tests__/contrast.test.ts`: every palette's body text and muted text against its bg and card
  surfaces (glass included) ≥ 4.5:1 (muted ≥ 4.5 if used for body copy, else ≥ 3:1 for large/secondary). Fix tokens
  in `src/theme` that fail; list every change in the report.
- Every touchable in `src/ui` and `src/screens` has `accessibilityRole` + `accessibilityLabel` (test or audit list).
- Targets ≥ 44 × 44 pt (incl. carried: Calendar cells below ~340 dp: allow hitSlop or row height).
- Font scale 1.3: text that can clip gets `numberOfLines`/wrapping; screens scroll. `T` stays scalable.
- No new public interfaces.

## Chunk 4 · Performance pass
- Run screen: the 1 Hz tick re-renders only the number/bar (verify; add a render-count test).
- Lists that can exceed 30 items use `FlatList` (Topics library, Plan list): audit, convert only if needed.
- Glass on low-end Android: `src/theme` gets `lowEndDevice: boolean` input to `buildTheme` options; when true and the
  user has not chosen a blur level, default blur is off. Detection in `src/state` via `expo-device`
  (`Device.totalMemory < 3 GB` or `deviceYearClass < 2019`), passed through ThemeProvider. No change to saved looks.
- Report: what was measured, what changed, what needs a real device.

## Chunk 5 · Carried fixes (M6/M7 lists)
`setDayStart` uses one `at` across reconcile and write; Day start and Plan `router.back()` fallback to `/today` when no history (Plan opened by `router.replace` from onboarding);
NOT_PLANNABLE copy mentions planning ahead; empty-draft hint; stale test title CalendarScreen.test.tsx:180;
CalendarScreen and GlassScreen tests leaner or given a modest timeout (both time out under full parallel load, pass alone); ChipSet default clear-path test.

## Chunk 6 · Release plumbing
- `eas.json`: `development` (dev client, internal), `preview` (Android APK, internal), `production`.
  `app.json`: `runtimeVersion: { policy: 'appVersion' }`. No secrets in the repo.
- `.github/workflows/ci.yml`: on push/PR: `npm ci`, typecheck, lint, test (Node LTS).
- `.maestro/golden-path.yaml`: onboard → plan today → start a task → back → close → plan tomorrow, using
  `testID`s added where missing. Runs on a dev/preview build (not Expo Go); documented, not run in CI.
- Docs 08 updated: how to build the preview APK (`eas login`, `eas build -p android --profile preview`).

## User steps
Expo account + `eas login` (user types it), then the preview build. Phone check after chunk 2 (welcome flow in
Expo Go) and after the preview build (icon, splash, install from first open).

## Chunk 7 · Color & glass (phone check, user 2026-10-31)
User: the tint options are the whole app's colour, not a glass feature. Split them:
- **Color** (the `glass` tint key, name kept for saved-data compatibility): the coloured background blobs and the chain
  colours apply on EVERY surface (flat, raised, outline, glass), not only when `surf === 'glass'`. "Match the palette"
  stays the default and looks as today.
- **Glass**: the "Frosted glass" switch only toggles the frosted card surface (`surf` glass ↔ the non-glass surface the
  user had, or `flat` if none) plus the blur level. Turning glass off keeps the chosen colour. Picking a colour no longer
  forces glass on.
- Theme: `buildTheme` exposes the blobs independently of glass (e.g. `t.backdrop: { blobs } | null`, with
  `t.glass` keeping frost/blur/intensity); `Background` draws blobs from it; low-end and Reduce Transparency rules
  unchanged (they only affect blur).
- Screen: title "Color & glass"; sections COLOR · <NAME> (28 tints) first, then GLASS (switch + blur). Profile and Look
  rows read "Color & glass", value "<tint name> · Frosted" or "<tint name> · No frost".
- No change to the saved LookMix shape. Contrast test extended so text on the page and on solid cards stays ≥ the
  existing thresholds over the blobs for every surface.

## Chunk 8 · The colour colours the whole app (phone check, user 2026-10-31)
User (twice): the colour picked in Color & glass is for the whole app, not only glass / the background.
When a tint other than "Match the palette" is chosen, `buildTheme` derives the app's colours from it:
- `accent` (buttons, links, switches, selected chips, tab-bar highlight, focus rings) = the tint's main colour,
  darkened/lightened only as much as needed to reach ≥ 4.5:1 on bg and surface (and under the button label `on`).
- `bg` = the palette bg mixed clearly toward the tint; `surface` (cards) = a light touch of the tint; `line` follows.
  `ink`, `muted`, `danger` are adjusted only if needed to keep ≥ 4.5:1 on the new bg/surface.
- Chain and background blobs follow the tint (as chunk 7). Glass stays frost + blur only.
- "Match the palette" = exactly today's palette colours (no change for anyone who hasn't picked a colour).
- Saved LookMix shape unchanged; Night stays dark (tint mixed into a dark base).
- Contrast test: for every palette × tint × surface, ink/muted/accent/danger ≥ 4.5 on bg, surface and blobs;
  `on` label ≥ 4.5 on accent and dangerFill.
- Glass screen preview and Look preview show the derived colours. Copy: the sub line says the colour is used across the app.
- **Addition (user, 2026-10-31):** the six palettes (Mist, Sunrise, Lagoon, Paper mono, Lavender, Night owl) join the
  COLOR list, first, so all colour choices live in one place. Picking a palette = `pal` + match tint (exactly that
  palette). Picking a tint = current `pal` as the light/dark base + everything follows the tint. The visible "Match the
  palette" tint is replaced by the palette entries (key kept for saved data). Look's Palette aspect stays (same key).
