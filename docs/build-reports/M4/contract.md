# M4 contract — Today + Run

Binding interface between the M4 chunks. Sources of truth: `docs/04-domain-rules.md` §3–§5, §7 and §2 (ADR-009),
`docs/02-architecture.md` ("Data flow example: a timed task hits 0", "Clock"), `docs/05-screens-and-navigation.md`
(Today and Run rows, Gestures), `docs/06-design-system.md` (CountdownBar variants, motion, haptics & sound),
`docs/07-quality-security-testing.md` (Run screen ticks at 1 Hz without re-rendering the tree; a11y), and the
prototype `drafts/ysave-style-lab.html` (Today and Run screens, countdown bars, celebration, gold ring). M1–M3
contracts still hold: screens use state hooks only (never `@/data` or `getDb`); errors from `@/state/errors`;
submit guard for one-shot actions; return to Today with `router.dismissTo('/(tabs)/today')`.
Paths are relative to `mobile/`.

**M4 is done when:** a real 5-minute task completes even if you lock the phone midway.

**Timer principle (doc 02):** time comes only from stored session timestamps. Nothing depends on the app staying
alive. Every screen derives remaining/overtime from sessions + `now()`.

## Chunk 1 · Run state (`src/state/`)

```ts
// actions/run.ts: each runs reconcile() first (M1 carried requirement), then the domain decision, then repos; bumps tables
startTask(dayTaskId: string): void      // startDecision → startSession (closes another open session at now); throws ValidationError with a reason
pauseTask(dayTaskId: string): void      // endSession on its open session (no-op if none)
stopTask(dayTaskId: string): void       // only when done (completedAt set): end the overtime session
toggleCheckTask(dayTaskId: string): void // domain toggleCheck → setCheckCompleted
// actions/reconcile.ts
reconcile(): { autoClosed: DayKey[] }
  // 1) rollover(...) over loadOpenPastDays + today + library → applyOps (closes stale sessions at their day's end,
  //    completes tasks that hit 0, lets go unticked checks, prefills an unplanned today; doc 04 §3, §6)
  // 2) today's pendingCompletions(now) → setCompletedAt
  // bumps days + sessions if anything changed. Idempotent. Decision: auto-close logic moves into M4 because
  // start/resume needs it; M5 adds the Close and Morning screens on top.
// hooks
useNow(intervalMs = 1000): Epoch                // ticking clock for UI; stops when unmounted; uses clock.now()
useToday(): {
  todayKey: DayKey; day: Day | null; closed: boolean;
  rows: TodayRow[]; done: number; total: number; items: CollectionItem[];
}
interface TodayRow { dayTask: DayTask; topicName: string; state: TimerState | 'check-open' | 'check-done';
  sessions: Session[] }                          // remaining/overtime are computed by the UI from sessions + useNow
useRunTask(dayTaskId: string): { row: TodayRow | null; note: string; day: Day | null } | null
useReconcileOnForeground(): void                 // runs reconcile() on mount and on every AppState 'active'
```
- `src/app/_layout.tsx` calls `useReconcileOnForeground()` once migrations succeed (one hook call, nothing else).
- While a timed task is running, the hooks must also detect it hitting 0 while the app is open: `useRunTask`/`useToday`
  call `reconcile()` when `remainingMs ≤ 0` and `completedAt` is null (guard against repeated calls).

## Chunk 2 · Run UI (`src/ui/`) — presentational

| Component | Props | Notes |
|---|---|---|
| `TaskRow` | `{ name; topicColor; minutes; state; remainingMs; overtimeMs; gold; onPress(); a11yLabel }` | Timed row: "45 min" idle, "12 min left" running (a live dot), "paused · 12 min left", "done" with a check, "+3 min extra" in overtime, gold mark if gold. Tap = onPress |
| `CheckRow` | `{ name; topicColor; done; forwardedFrom?: string; onToggle() }` | Uses `Checkbox`; small marble style |
| `CountdownBar` | `{ budgetMs; remainingMs; overtimeMs; variant: 'thin' \| 'smooth' \| 'seg' }` | Draining bar to 0; seg = 15-min sections; overtime = gold stripes growing. Variant from the look's `bar` |
| `BigNumber` | `{ value: string; caption: string }` | 70/800 tabular numerals ("12" + "min left", "+3" + "min extra") |
| `Celebration` | `{ visible: boolean; text?: string }` | "Done for today" + success haptic once when it becomes visible; respects Reduce Motion |
| `Dock` | `{ items; closed; onPress? }` | Bottom dock holding a small `Collection` jar (layout 'dock'); other layouts are M7 |
`src/ui/timeText.ts`: `minutesLeftText(remainingMs)`, `extraText(overtimeMs)` using the domain labels (ceil / floor).

## Chunk 3 · Today screen (`src/app/(tabs)/today.tsx` → `src/screens/TodayScreen.tsx`)

- Replaces the M3 placeholder. Header "Today · n of m done". Entry cards kept (ADR-009): unplanned → "Plan today";
  planned and open → "Edit today's plan" + "See"; tomorrow card + "Plan tomorrow".
- Topic folds (topic order) with TaskRow / CheckRow; forwarded rows show "from <Thursday>". Tap timed → `router.push('/run/[dayTaskId]')`;
  tap checklist → `toggleCheckTask` (light haptic). Closed day → read-only (no ticking, no starting).
- Only the rows' time text ticks (a `useNow` inside each running row, not the whole screen).
- `Dock` with today's jar (items from `useToday`), new marble drops in when a task completes.
- Empty (no plan, no rows): "Nothing planned for today" + "Plan today".

## Chunk 4 · Run screen (`src/app/run/[dayTaskId].tsx` → `src/screens/RunScreen.tsx`)

- "‹ Today" (dismissTo; leaving does NOT pause), state label (Running / Paused / Done · still going / Done), task name,
  topic dot + name, treat tag, cue line, note card (tap to edit; saves to the library task via a state action, debounced).
- Opening the screen on an idle task does not start it: big "Start" button. Running → Pause; Paused → Resume;
  Done with an open session (overtime) → Stop; Done and stopped → "Back to Today".
- BigNumber + CountdownBar update at 1 Hz in an isolated child (`useNow`), not the whole screen.
- At 0: celebration once (guarded by a ref so a re-render never replays it), success haptic, jar marble drops,
  the session keeps running as overtime until Stop. Gold when overtime ≥ 60 s at Stop.
- `expo-keep-awake` while running. Starting another task while one runs pauses the first (domain rule).
- Checklist tasks never open Run (they're ticked on Today).

## Cross-cutting
- No `any`; theme colors only; role + label + ≥44 pt; Reduce Motion respected; haptics via `expo-haptics`.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage` (domain gate holds).
- Phone check must include: lock the phone during a 5-minute task and unlock after it should have ended.
