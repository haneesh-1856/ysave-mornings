# 07 · Quality, security, testing

## Test strategy (testing pyramid)

| Level | Tool | What | Bar |
|---|---|---|---|
| Unit | Jest | **All of `src/domain/`**: dayKey (incl. DST and hours 0/4/23), plan generation, timer (`focused`, `completionTime` across multiple sessions, kill-and-reopen), rollover/auto-close, glow, chain, collection order, stats | ≥ 95 % line coverage on `domain/`; every bug fix adds a failing test first |
| Repository | Jest + in-memory SQLite (better-sqlite3 in Node) | Repos + migrations: one-open-session invariant, snapshots survive deletes, replace-plan keeps rows with progress | Main paths covered |
| Component | React Native Testing Library | TaskRow states, WeekRing toggling, Plan confirm enabled/disabled, Close requires outcomes | Key interactions |
| End-to-end | Maestro (from milestone M5) | Golden path: onboard → plan → run (fake clock) → complete → close → plan tomorrow | Runs before every release build |
| Manual | Real phones | Look settings on a low-end Android + an iPhone; background/kill during a running timer | Checklist per release |

**Time is injected everywhere.** No test sleeps. Tests pass `now` values and fast-forward the fake clock.

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`. All four must pass
before a milestone counts as done.

## Security & privacy (v1)

- **No network.** The app makes no requests in v1 (no analytics, no crash SDK, no ads). Fonts are
  bundled. This is the simplest possible privacy story: nothing leaves the phone.
- **Data at rest:** the SQLite file lives in the app sandbox, which the OS encrypts when the device is
  locked (iOS Data Protection, Android file-based encryption). No secrets are stored, so v1 needs no
  extra encryption.
- **Input:** all user text goes through length limits and is rendered as plain `<Text>`. There's no
  HTML or WebView, so there's no injection surface. SQL only goes through Drizzle parameterized queries.
- **Permissions:** none requested in v1.
- **Dependencies:** run `npm audit` at each milestone; prefer Expo-maintained modules; lockfile committed.
- **Data loss risk:** uninstalling deletes everything (there's no backup in v1). Export/backup is on the backlog,
  and the onboarding/profile says so plainly.
- When sync/teams arrive, this section gets rewritten: auth, row-level security, and opt-in visibility as
  privacy defaults.

## Accessibility

- Every touchable has `accessibilityRole` + `accessibilityLabel` (e.g. "Start DSA practice, 60 minutes").
- Targets ≥ 44 × 44 pt. Supports Dynamic Type / font scale up to 1.3 without clipping (lists scroll).
- Contrast: body text ≥ 4.5:1 on every palette, including glass surfaces (checked per palette).
- Color is never the only signal: topic names accompany colors, and glow has a legend.
- Respect Reduce Motion and Reduce Transparency.

## Performance budgets

- Cold start to first screen < 2 s on a mid-range Android.
- The Run screen ticks at 1 Hz with **no re-render of the whole tree**. Only the number and bar update
  (Reanimated shared values).
- Lists over 30 items use `FlatList`/`FlashList`.
- Glass: at most one BlurView per visible card. Measure on a low-end Android before keeping blur on by default there.

## Code conventions

- TypeScript strict, no `any` in `domain/` and `data/`.
- Domain functions are small, pure and named after the rule in [04](04-domain-rules.md).
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
