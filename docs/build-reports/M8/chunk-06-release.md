# M8 chunk 6: Release plumbing

## What it is for
Everything needed to ship a preview build and keep the repo healthy: EAS build profiles, a runtime version
for future OTA updates, a CI workflow, and a Maestro end-to-end flow. No secrets, no builds run.

## Connections
- `eas.json` and `app.json` (`runtimeVersion`) are read by EAS CLI.
- `.github/workflows/ci.yml` runs the package.json scripts `typecheck`, `lint`, `test`.
- `.maestro/golden-path.yaml` uses testIDs added to the screens (below) and chunk 2's onboarding ids.
- `jest.global-setup.js` sets `TZ=America/New_York`, so tests do not depend on the runner's time zone.

## Future connections
- User: create a free Expo account, type `! npx eas-cli@latest login`, then
  `npx eas-cli@latest build -p android --profile preview`; install the APK and check icon and splash.
  `build:configure` may add a (non-secret) `extra.eas.projectId` to app.json.
- User: run `maestro test .maestro/golden-path.yaml` on a device with the preview build.
- The `development` profile needs `expo-dev-client`, which is NOT installed (native dependency, user decision).
  Install later with `npx expo install expo-dev-client`; the preview profile does not need it.

## Files
- eas.json (new), app.json (runtimeVersion), .github/workflows/ci.yml (new)
- .maestro/golden-path.yaml, .maestro/README.md (new)
- docs/08-dev-setup-and-release.md (Release section rewritten; Repository line updated)
- testIDs added (no visual change): TextField gets an optional `testID` prop; `onboarding-topic`,
  `onboarding-task` (OnboardingScreen); `plan-confirm` (PlanFooter); `task-row` (TaskRow);
  `planned-done` (PlannedScreen); `today-plan-today`, `today-plan-tomorrow`, `today-close` (TodayScreen);
  `run-start`, `run-back` (RunScreen); `close-confirm`, `close-plan-tomorrow` (CloseScreen).

## Build
- eas.json per https://docs.expo.dev/build/eas-json/ : `development` (developmentClient, internal),
  `preview` (internal, android apk), `production` (default AAB, `autoIncrement: true`).
  `cli.version ">= 16.0.0"`; the docs only show `>= 0.34.0` as an example, so 16 is my choice of a modern minimum.
- `cli.appVersionSource: "remote"`: https://docs.expo.dev/build-reference/app-versions.md recommends remote
  (from EAS CLI 12) with autoIncrement on production. EAS keeps versionCode, so no commits per build.
- `runtimeVersion: { "policy": "appVersion" }` at top level of `expo` (https://docs.expo.dev/eas-update/runtime-versions/
  shows it under a platform key; top level applies to all). Risk: native changes without a `version` bump.
- CI: actions/checkout@v4, actions/setup-node@v4 (Node 22, npm cache), `npm ci`, typecheck, lint, `npm test -- --ci`.
  Read-only permissions. I did not verify these are the latest majors online.
- Maestro: syntax checked only for `launchApp.clearState` against docs.maestro.dev; `tapOn.id`, `inputText`,
  `hideKeyboard`, `optional`, `index` are from memory and were not run. Flow ends on `planned-done` visible.

## Outputs
- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npx jest --silent`: 74 suites, 875 tests pass.
- `npx expo config --type public`: runtimeVersion `{ policy: 'appVersion' }`, android package `com.han1856.ysavemornings`.
- Both YAML files parse with js-yaml.

## Errors
- None blocking. Assumptions not run on a device: tapping "15" matches the chip by its accessibility label; the
  flow after onboarding "Plan today" lands on the plan screen then Planned; "Let it go" is optional.

## Check

### Verdict: PASS (with 2 minor fixes recommended, nothing blocking)

### Errors (minor)
1. `.github/workflows/ci.yml:17-18`: `actions/checkout@v4` and `actions/setup-node@v4` are not the latest majors. The READMEs
   (https://github.com/actions/checkout, https://github.com/actions/setup-node) now show `@v7` in usage examples. v4 still works
   and is not deprecated by anything I saw, so this is only staleness. Fix: bump both to `@v7` (check the release notes for the
   Node-runtime requirement) or leave v4 knowingly.
2. `docs/build-reports/M8/chunk-06-release.md` builder note: "`cli.version` 16 is my choice" is fine, but the eas-json page
   (https://docs.expo.dev/build/eas-json/) shows `version` only as a SEMVER_RANGE, so `">= 16.0.0"` is valid. No fix needed;
   listed so the claim is closed. (Not an error.)

### Verified against docs
- `runtimeVersion: { policy: "appVersion" }` at top level of `expo`: valid. https://docs.expo.dev/versions/latest/sdk/updates/
  shows exactly this under `expo`. The runtime-versions page only shows the platform-key form; platform key overrides top level.
  `npx expo config --type public` resolves it to `{ policy: 'appVersion' }`.
- eas.json: `cli.version` (SEMVER_RANGE), `buildType: "apk"`, `distribution: "internal"` confirmed on the eas-json page.
  `cli.appVersionSource: "remote" | "local"` and `autoIncrement: true` confirmed on https://docs.expo.dev/build-reference/app-versions/
  (autoIncrement with remote is the documented setup; it is not supported with the `nativeVersion` policy, not used here).
- `developmentClient: true` means "this build depends on expo-dev-client" (docs). The docs do not say config validation fails
  without the package; it is needed to build that profile. Not installing it is fine until `--profile development` is run.
- setup-node: `cache: npm` uses the root `package-lock.json` (tracked in git: yes). `npm ci` is therefore valid.
- Maestro (docs.maestro.dev, plus llms-full.txt): `launchApp.clearState`, `tapOn: "text"`, `tapOn.id`, `tapOn.index`,
  `inputText: <string>`, `hideKeyboard`, `assertVisible: "text"` and `assertVisible.id`, `optional: true` (documented as a
  command attribute, "test continues if the step fails") are all valid. Invalid keys found: none. The `appId` header is correct.

### Logic checks
- Flow order matches code: Onboarding finish -> `router.replace('/plan/[dayKey]', today)` -> PlanScreen (mode `plan`, button
  `plan-confirm`) -> confirm replaces with `/planned/today` (`planned-done`) -> `dismissTo(/(tabs)/today)` -> task-row (timed,
  Pressable opens Run) -> `run-start` -> `run-back` (`leave` -> goToday) -> `today-close` (push /close) -> `close-confirm` ->
  `close-plan-tomorrow` (replace to plan tomorrow) -> `plan-confirm`.
- Tomorrow is NOT draft mode (`isDraftable` is only for days after tomorrow), so the final step confirms and lands on
  Planned with `planned-done`. Good (a draft would have shown "Save draft" and gone back).
- Close with a single timed, unfinished task: `useCloseSummary.unticked` only contains `kind === 'check'` rows, and
  `closeToday` only demands outcomes for those, so no outcome is needed and the optional "Let it go" tap is skipped. Correct.
- Every testID in the YAML exists in code: onboarding-start/next/topic/task/finish, plan-confirm, planned-done, task-row,
  run-start, run-back, today-close, close-confirm, close-plan-tomorrow. `TextField` forwards `testID` to the TextInput (line 31).
  `today-plan-today`/`today-plan-tomorrow` are added but unused (harmless).
- "15" is unambiguous on the first-task step: only the ChipSet chip has text/label "15" (selected chip would read "✓ 15", the
  default is 30). Maestro text is a full-string regex, so "15" does not match "150" etc.
- Residual risks (not run, cannot be verified without a device): first-open permission dialogs on Android 13+, and whether the
  plan screen pre-ticks the new daily task (domain doc 04 section 3 says defaults are included; OnboardingToPlan test exists).
- CI on ubuntu: `git ls-files` matches on-disk paths exactly (no case-only differences, checked by diffing both lists); no
  `.env`/secret files tracked (the only "key" hits are `dayKey` file names). Workflow has `permissions: contents: read`, no
  secrets. Jest `globalSetup` sets `process.env.TZ` in the parent before workers spawn, which works on Linux. Node 22 matches
  local v22.15.0. Not run on Linux; `npm ci` not exercised here.
- testIDs add no visual change (props only). No personal data in new files (the app id `com.han1856.ysavemornings` is in
  app.json already and is not a secret).

### Command outputs
- `npx tsc --noEmit`: exit 0, no output.
- `npm run lint`: exit 0, no warnings.
- `npx expo config --type public`: `runtimeVersion: { policy: 'appVersion' }`.
- `npx jest --silent`: 74 suites passed, 875 tests passed.
