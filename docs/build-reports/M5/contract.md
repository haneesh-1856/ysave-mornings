# M5 contract — Close + rollover

Binding interface between the M5 chunks. Sources of truth: `docs/04-domain-rules.md` §6 (closing), §3, §9 (soft
chain), §10 (day number), `docs/05-screens-and-navigation.md` (Map; Morning, Close and Today rows),
`docs/06-design-system.md` (collection renderers: the "closed" decoration; motion; haptics), `docs/07-quality-security-testing.md`,
and the prototype `drafts/ysave-style-lab.html` (close screen, lid, morning "A fresh page", chain). M1–M4 contracts hold:
screens use state hooks only; errors from `@/state/errors`; submit guard; return to Today with `dismissTo`; hand off
between flow screens with `replace`; fake-timer tests crossing a completion use `doNotFake: ['queueMicrotask']`.
Paths are relative to `mobile/`. **Docs now live in `mobile/docs/`.**

**M5 is done when:** you leave the app overnight, and the morning shows a fresh page with yesterday closed correctly.

Already in place from M4: auto-close of past days and the unplanned-day prefill (`reconcile()` on start and foreground).

## Chunk 1 · Close + morning state (`src/state/`)

```ts
// actions/close.ts
closeToday(outcomes: Record<string, CloseOutcome>): void
  // reconcile() first; closeByHand(todayBundle, outcomes, { day, dayTasks, dayStartHour } of tomorrow, now) → applyOps;
  // throws ValidationError listing missing choices (missingOutcomes) or if already closed; bumps days + sessions
// hooks/useCloseSummary.ts
useCloseSummary(): {
  todayKey: DayKey; day: Day | null; closed: boolean;
  unticked: { dayTaskId: string; name: string; topicName: string; colorKey: ColorKey }[];  // unticked checklist rows
  done: number; total: number; focusedMs: number; extraMs: number; items: CollectionItem[];
  tomorrowKey: DayKey;
}
// hooks/useChain.ts
useChain(): ChainLink[]        // domain chain() over the last 8 days; itemCountByDay from collectionItems per day
// hooks/useMorning.ts
useMorning(): { due: boolean; todayKey: DayKey; dayNumber: number; plannedToday: boolean; items: CollectionItem[] }
markMorningSeen(): void        // setting 'morningShownFor' = todayKey
  // due = there is history before today (≥1 earlier days row) AND morningShownFor !== todayKey.
  // First-ever use never shows Morning. Shown once per day.
// hooks/useDayBoundary.ts
useDayBoundary(): void         // timer to the next dayEndOf(todayKey, H); at fire: reconcile() + bump('days');
                               // re-arms for the following day; cleared on unmount; also re-armed on foreground
```
- `src/app/_layout.tsx` calls `useDayBoundary()` beside `useReconcileOnForeground()` (one line).
- `src/app/index.tsx`: redirect to `/morning` when `useMorning().due`, else `/today`. Coming back to the foreground on
  a new day while the app is open also routes to Morning once (a small `useMorningRedirect()` used by the Today screen
  is fine: when `due` becomes true while Today is focused, `router.push('/morning')`).

## Chunk 2 · Close + morning UI (`src/ui/`)

| Component | Props | Notes |
|---|---|---|
| `Jar` (extend) | add `animateLid?: boolean` | When `closed` flips false→true with `animateLid`, the lid swings shut (theme motion; instant under Reduce Motion). No replay on re-render; mounting already closed shows it closed. |
| `OutcomePicker` | `{ name; topicColor; value: CloseOutcome \| null; nextDayName: string; onChange(v) }` | Two choices: "Move to <Friday>" / "Let it go". No default. ≥44 pt, role radio |
| `CloseSummary` | `{ done; total; focusedMs; extraMs }` | "3 of 4 done · 2h 10m focused · +12m extra" (formatMinutes; tabular numerals) |
| `SunriseCard` | `{ dayName: string; dayNumber: number }` | "A fresh page", "<Thursday> · Day 8" with a soft sunrise in theme colors (SVG) |
| `Chain` (existing) | `{ links }` | reuse; add an a11y summary like "Last 8 days: 6 active, 2 rest" |

## Chunk 3 · Close screen + Today additions

- `src/app/close.tsx` → `src/screens/CloseScreen.tsx`: title "Close today", big jar (`Collection`), `CloseSummary`,
  "Not ticked today" with an `OutcomePicker` per unticked checklist task, buttons "Not yet" (back to Today, dismissTo) and
  "Close the jar". Pressing Close with missing choices highlights them ("Choose Move or Let go for 2 tasks").
  On success: lid animation, success haptic, then the screen shows "Plan tomorrow" (replace → plan/[tomorrowKey]) and
  "Back to Today". Already closed → read-only summary + "Plan tomorrow".
- Today (`src/screens/TodayScreen.tsx`): the soft chain at the top (`useChain`), a "Close today" button when today is open
  and has a plan, and the closed banner already present. Running timer at Close time is stopped by the domain (session ends at now).

## Chunk 4 · Morning screen

- `src/app/morning.tsx` → `src/screens/MorningScreen.tsx`: weekday, "Day N", chain, `SunriseCard`, today's jar with the
  planning marble if today was planned (else "Today isn't planned yet" + "Plan today"), button "See today's plan" →
  `router.dismissTo('/(tabs)/today')`. `markMorningSeen()` on mount. No tab bar.
- `src/app/index.tsx` redirect per chunk 1.

## Not in M5 (recorded)
- The Maestro end-to-end golden path from the roadmap needs Maestro installed and an emulator/device attached; it is deferred
  to M8 (release prep) and noted in the README. Unit/component coverage carries M5.
