# M13 contract · Moments wrap-up

Rules as in `../M9/contract.md`. Data rule (user, 2026-11-02) applies: only real stored data.

Items carried here: the Moments on/off control (M8 chunk 19/20 "chunk 21 adds the Settings controls"), removing
`Placeholder`, the six moments playing together, and the end-to-end cases left open in M8 chunk 19 (late close after
midnight, a close where every moment is due) plus its note "a goal reached while moments were off fires at the next
close". The three chunks touch different files and are built in parallel.

## Chunk 1 · Moments on/off
Files: `src/state/actions/settings.ts` (`setMomentsEnabled(on: boolean)`, `bump('settings')`), a read hook in
`src/state/hooks/`, `ProfileScreen.tsx` (a switch row "Moments at close", on by default, next to "Monthly goal"),
tests, `docs/04-domain-rules.md` §12 one sentence (turning moments off leaves markers alone; anything reached while
off, such as the monthly goal, can play at the next close after turning them back on), `docs/05` one line.
- Use the app's existing switch/toggle component if there is one (match its accessibility: role switch, checked
  state); otherwise a `SettingRow` with an On/Off value and its own small screen, matching DayStart's pattern.
- Tests: action persists and leaves markers alone; Profile shows the state and toggles it; with moments off a close by
  hand returns `[]` and the player does not open (CloseScreen test); on again, the next qualifying close plays.

## Chunk 2 · Player wrap-up
Files: `src/ui/moments/MomentsPlayer.tsx`, delete `src/ui/moments/Placeholder.tsx` (and its tests/imports),
`docs/05-screens-and-navigation.md` (`/close` row: all six drawn, drop "until chunk 21"), tests.
- `MomentBody` is exhaustive over `Moment['kind']` (a `never` check), no fallback.
- Only the moment on screen (and at most the one transitioning) is mounted or animating; measure and report how many
  `Scene3D` slot pools are mounted at once during a six-moment run (M9-M12 pools are 56/66/50/14 paths). If all are
  mounted, change it so off-screen moments are not.
- Test: a player run with all six moments (fixtures of real shape: `recentMs` 13, `dailyMs` 7 / month length,
  streak days 7) renders each body in `MOMENT_ORDER`, the chrome counts `n / 6`, Skip and tap end it, reduced motion
  steps through all six.

## Chunk 3 · Moments end to end
Files: `src/state/__tests__/momentsEndToEnd.test.ts` (new), only test code.
- With the real actions only, build a history so that ONE close by hand returns all six moments in `MOMENT_ORDER`,
  each with values worked out by hand in comments (longest task, day complete, a personal best with 13 recent days, a
  streak of 7 or 14, week complete on a Sunday, the monthly goal reached that day via `setMonthlyGoal`).
- A close by hand after midnight (before the day start hour, e.g. 01:30) closes the right day and its moments use
  that day's data (week/month keys of the day, not the calendar date).
- Moments off, then on: a goal reached while off plays at the next close (documents chunk 19's note).
- Each moment's numbers equal what the app shows elsewhere for the same days (e.g. week focus vs the stats the app
  already computes, if a selector exists).
