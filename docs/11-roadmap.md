# 11 · Roadmap

Each milestone ends with something you can try on your phone, plus green typecheck/lint/tests.

| # | Milestone | Done when |
|---|---|---|
| **M0** ✅ done 2026-10-29 (phone check passed) | Scaffold: Expo + TS strict, Expo Router with 4 empty tabs, ESLint/Prettier/Jest, fonts loaded, theme tokens ported, `buildTheme` + `colorMix`, default look (Night owl glass) on every screen, git init | The app opens on your phone in Expo Go showing 4 themed tabs |
| **M1** ✅ done 2026-10-29 (phone check passed) | Data + domain: Drizzle schema & first migration, repos, `src/domain` (dayKey, plan, timer, rollover, collection, calendar, stats) with unit tests, fake clock | `npm test` covers every rule in doc 04; coverage ≥ 95 % on domain |
| **M2** ✅ done 2026-10-29 (phone check passed) | Topics tab: folds, topic new/edit/remove, task flip card (ring, kind, slider, default, cue, treat, note, delete) | You can build your real topics and tasks; they survive an app restart |
| **M3** ✅ done 2026-10-29 (phone check passed; planning ~1.5 min) | Planning: Plan screen (groups, Not on…, per-day edits, one-off add, confirm), Planned screen with first-marble drop | You can plan tomorrow and today in under 3 minutes |
| **M4** built 2026-10-29, phone check pending | Today + Run: task rows, start/pause/resume, background-safe timer, auto-complete, celebration, overtime, Stop, gold ring, checklist ticking, glass jar collection in the dock | A real 5-minute task completes even if you lock the phone midway |
| **M5** | Close + rollover: Close screen with Move/Let go, lid animation, auto-close, Morning screen, unplanned-day pre-fill, chain. Maestro golden path | Leave the app overnight; the morning shows a fresh page and yesterday is closed correctly |
| **M6** | Calendar + Profile: month grid, glow, day card, plan from tomorrow; stats; day-start setting | The calendar reflects your real week |
| **M7** | Look settings: all palettes, fonts, shapes, surfaces, 28 glass tints + 5 blurs, 12 collection looks, motion, transitions, layouts, bars, tab styles, presets | Every style-lab option is pickable in Profile and applies everywhere |
| **M8** | Onboarding, accessibility pass, performance pass on low-end Android, app icon/splash, EAS preview build | A friend can install the preview APK and use it from first open |

After v1: notifications (if chosen), backup/export, sync + accounts, friend teams & group sessions.
