# 08 · Dev setup & release

## What you need (Windows)

- Node.js LTS (this PC has v22.15) and npm.
- Git.
- On your phone: the free **Expo Go** app (Play Store / App Store). You don't need Android Studio, Java or a Mac.
- Phone and PC on the **same Wi-Fi** (or use `--tunnel` if the network blocks it).

## Run it

```bash
cd mornings/mobile       # the Expo project folder
npm install
npx expo start           # prints a QR code
```

Scan the QR with Expo Go (Android) or the Camera app (iPhone). Saving a file reloads the app on the phone.

Useful: `npx expo start --tunnel` (different networks), `npx expo start -c` (clear cache),
press `w` for a quick browser preview (layout only: blur and haptics differ).

## Dev menu extras (only in development builds)

The "Clock" panel sets a fake time / fast-forwards 1 min, 10 min, to day end. It replaces the
prototype's "Skip to 2 min" and makes testing rollover and auto-close quick.

## When Expo Go isn't enough

If a later native module isn't in Expo Go, switch to a **development build**:
`npx expo install expo-dev-client`, then `eas build --profile development --platform android`
(this builds in the cloud, so it still needs no Android Studio).

## Release (EAS)

Everything below is free. `eas.json` is already in the repo, so there is no setup step in the code.

1. Create a free account at https://expo.dev/signup.
2. In Claude Code, type this yourself (it asks for your password, so Claude cannot run it):
   `! npx eas-cli@latest login`
3. Only if EAS asks to link the project: `npx eas-cli@latest build:configure`. It may add an
   `extra.eas.projectId` to `app.json`. That id is not a secret and is fine to commit.
4. Build the installable Android app in the cloud:
   `npx eas-cli@latest build -p android --profile preview`
   It takes a while in a queue. When done you get a link and a QR code.
5. Open the link on your phone and install the APK (allow "install unknown apps" for the browser once).

### Profiles (`eas.json`)
- `development`: dev client build (needs `expo-dev-client`, see "When Expo Go isn't enough").
- `preview`: internal APK to install directly or share with friends.
- `production`: the store build (AAB). `autoIncrement` raises the Android version code on each build.
- `cli.appVersionSource` is `remote`: EAS keeps the build numbers, so they never clash or need commits.
- `app.json` has `runtimeVersion: { policy: "appVersion" }`: a future EAS Update only reaches builds with
  the same `version`. Bump `version` whenever native code changes.

### Icon and splash: Expo Go vs your build
In Expo Go the phone shows the Expo Go icon and splash. In the preview APK you see the real thing: the
YSave Mornings icon (adaptive icon on the dark background), the dark splash with the sun mark, and the app
name under the icon. Check these on the first open after install.

### CI
`.github/workflows/ci.yml` runs on every push and pull request to `main`: `npm ci`, typecheck, lint, and
the tests (Node 22). It needs no secrets. The tests pin their own time zone (America/New_York), so they
pass on any machine.

### End-to-end flow (Maestro)
`.maestro/golden-path.yaml` drives the main path on a dev or preview build. See `.maestro/README.md`.
It is run by hand, not in CI.

### Store and checklist
- Store needs: app icon + splash, privacy policy page ("no data collected"), screenshots, Play
  data-safety form ("no data collected or shared").
- Release checklist: typecheck, lint, tests, Maestro golden path, manual checklist ([07](07-quality-security-testing.md)), bump version, changelog.
- Later: **EAS Update** for JS-only fixes over the air, gated to the same runtime version.

## Repository

- `git init` at the project root. `main` is always runnable, with short-lived feature branches per milestone.
- On GitHub, an Actions workflow runs typecheck + lint + test on every push and pull request.
