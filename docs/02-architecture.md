# 02 · Architecture

## Stack

| Concern | Choice | Why (details in [10](10-decisions.md)) |
|---|---|---|
| App framework | **Expo (managed) + React Native**, latest stable SDK at scaffold time, pinned | One codebase for iOS and Android; run on a real phone via Expo Go with no Android Studio/Mac |
| Language | **TypeScript, `strict: true`** | Catches whole classes of bugs at compile time |
| Navigation | **Expo Router** (file-based, native stack + tabs) | Routes = files; deep links for free |
| Storage | **SQLite via `expo-sqlite` + Drizzle ORM** | Relational history (calendar, stats) grows over time; typed queries; versioned migrations |
| Reactive reads | Drizzle `useLiveQuery` | Screens re-render when the rows they read change |
| UI state | **Zustand** (small stores) | Ephemeral UI state + the cached look mix; no boilerplate |
| Animation | **react-native-reanimated** | Runs on the UI thread, so springs and marble drops stay smooth |
| Graphics | **react-native-svg** | Jar, the 12 collection looks, week ring and glass background blobs |
| Blur | **expo-blur** | Frosted-glass surfaces |
| Fonts | `@expo-google-fonts/*` (Plus Jakarta Sans, Nunito, Fraunces, Bricolage Grotesque, IBM Plex Mono) | The 5 typeface options |
| Other Expo modules | `expo-haptics`, `expo-keep-awake`, `expo-localization` | Tick feedback, screen stays on while running, locale/week start |
| Dates | `date-fns` | DST-safe local date math for the day boundary |
| Tests | Jest (`jest-expo`) + React Native Testing Library; Maestro for E2E later | See [07](07-quality-security-testing.md) |
| Lint/format | ESLint (expo config) + Prettier | |

## Layers

```
 src/app/ (routes)  thin screens: read hooks, call actions, render components
   │
 src/ui/            presentational components (no DB access)
   │
 src/state/         hooks + actions: useToday(), startTask(), confirmPlan() …
   │                  ├─ calls domain functions to decide
   │                  └─ calls repositories to persist
 src/domain/        PURE TypeScript. No React, no SQLite, no Date.now() inside.
   │                  "now" and data are passed in, so everything is unit-testable.
 src/data/          Drizzle schema, migrations, repositories (the only code that touches SQLite)
```

**Rule:** dependencies point downward only. `domain` imports nothing from the other layers.

## Folder layout

```
mornings/
  docs/  drafts/  learning/
  mobile/                    the Expo project
    app.json  package.json  tsconfig.json
    src/
      app/                   routes (Expo Router: every file here is a screen)
        _layout.tsx          root: fonts, DB + migrations, theme provider, rollover on start/foreground
        index.tsx            redirects to Today / Onboarding / Morning
        onboarding.tsx  morning.tsx  close.tsx
        (tabs)/_layout.tsx   4 tabs with the custom TabBar
        (tabs)/topics.tsx  (tabs)/today.tsx  (tabs)/calendar.tsx  (tabs)/profile.tsx
        run/[dayTaskId].tsx
        plan/[dayKey].tsx    planned/[dayKey].tsx
        topic/new.tsx        topic/[id].tsx
        settings/look.tsx    settings/glass.tsx   settings/day-start.tsx
      domain/   dayKey.ts plan.ts timer.ts rollover.ts collection.ts calendar.ts stats.ts types.ts
      data/     db.ts schema.ts migrations/ repos/{topics,tasks,days,sessions,settings}.ts
      state/    actions/*.ts clock.ts hooks
      theme/    tokens.ts (ported from the style lab) look.ts fonts.ts buildTheme.ts colorMix.ts ThemeProvider.tsx
      ui/       T Button Card Screen Header Background Chain TabBar Fold TaskRow CheckRow WeekRing TimeSlider
                Switch Segmented ChipSet Stepper ConfirmBox CountdownBar BigNumber
                collection/{Jar,Garden,Sky,Bracelet,Cairn,Lights,Honeycomb,Shelf,Plant,StampCard}.tsx
```

Paths in all docs (`src/…`) are relative to `mobile/`. Imports use the `@/` alias for `src/`.

## Data flow example: a timed task hits 0

1. The Run screen ticks once a second (UI only). It computes `remaining = budget − elapsed(sessions, now)`.
2. When `remaining ≤ 0` and `completedAt` is empty, the action `reconcileTask(dayTaskId, now)` calls the
   domain function `timer.completionTime(sessions, budget)`. That returns the exact moment it hit 0, and
   the repo writes `completedAt`.
3. `useLiveQuery` updates Today and the collection; the screen plays the drop animation once
   (guarded by a "celebrated" ref, so a re-render never plays it twice).
4. Overtime keeps counting from the still-open session until you press Stop, which closes the session.

The same `reconcile` runs on app start and every time the app returns to the foreground. That way a
task that hit 0 while the phone was locked or the app was killed is completed at the right time.
**The timer never relies on the app staying alive.** Time comes from stored timestamps.

## Clock

`src/state/clock.ts` exports `now()`. Tests and the dev menu can override it (fast-forward, set the day),
which replaces the prototype's "skip to 2 min" button. The domain layer never reads the clock itself.

## Future: sync and teams (not v1, but designed for)

- Every row has a UUID `id`, `createdAt`, `updatedAt` and soft-delete `deletedAt`, so a later sync
  (likely Supabase/Postgres) can merge by last-write-wins per row without a schema rewrite.
- Teams/presence will be a separate online module. Solo use must never require the network.
