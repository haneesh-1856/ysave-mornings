# Maestro flows

`golden-path.yaml` walks the main path: onboarding, plan today, start a task, back to Today, close the day,
plan tomorrow.

## Needs
- A **development or preview build** installed on an emulator or phone (not Expo Go: the app id is
  `com.han1856.ysavemornings`). Build the preview APK as described in `docs/08-dev-setup-and-release.md`.
- The [Maestro CLI](https://docs.maestro.dev/) installed.

## Run
```bash
maestro test .maestro/golden-path.yaml
```
The flow clears app data first, so it always starts as a fresh install.

## Limits
- It does not drive the fake clock or the timer's completion. It starts the task and leaves; the day then
  closes with the task unticked ("Let it go"). Timer completion and rollover are covered by the unit tests.
- Not run in CI (CI needs an emulator and a build). Run it by hand before a release.
- Elements are found by `testID` (invisible, no visual change), for example `onboarding-next`,
  `plan-confirm`, `task-row`, `close-confirm`.
