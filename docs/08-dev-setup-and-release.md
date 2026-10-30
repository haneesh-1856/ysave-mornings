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

## Release (later milestone)

- **EAS Build** profiles: `development`, `preview` (installable APK / TestFlight for friends), `production`.
- **EAS Update** for JS-only fixes over the air, gated to the same runtime version.
- Versioning: `version` in app config = SemVer for users. `runtimeVersion` policy = `appVersion`.
- Store needs: app icon + splash, privacy policy page ("no data collected"), screenshots, Play
  data-safety form ("no data collected or shared").
- Release checklist: typecheck, lint, tests, Maestro golden path, manual checklist ([07](07-quality-security-testing.md)), bump version, changelog.

## Repository

- `git init` at the project root. `main` is always runnable, with short-lived feature branches per milestone.
- When it goes to GitHub: an Actions workflow runs typecheck + lint + test on every push.
