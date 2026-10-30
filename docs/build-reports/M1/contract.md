# M1 contract — the connections between chunks

Every M1 chunk builds against this file. It is the **only** agreed surface between modules; anything
not listed here is private to its file. Rules come from `docs/03-data-model.md` and
`docs/04-domain-rules.md` (paths below are relative to `mobile/`). If a builder finds this contract
contradicts those docs, it follows the docs and records the conflict in its report.

## Layering (dependencies point down only)

```
src/app/        (routes)        → may import state, ui, theme
src/state/      (actions/hooks) → may import domain, data          [M1: only clock.ts]
src/data/       (SQLite)        → may import domain/types (values + types), and TYPE-ONLY imports from other domain files
src/domain/     (pure rules)    → imports only date-fns and other domain files
```

- `domain/` never imports React, Expo, Drizzle, or reads `Date.now()` / `new Date()` with no args.
- `domain/` never creates ids. Functions that create rows return **drafts** (`Omit<X, 'id'>`);
  the caller (state layer, later) assigns ids.
- `createdAt` / `updatedAt` are data-layer columns only; domain types don't have them.
- Times are **epoch ms** (`Epoch`). Durations inside domain are **ms**. `budgetSec` stays seconds
  because that's the column; convert with `budgetSec * 1000`.

## `src/domain/types.ts` (chunk 1)

```ts
export type Epoch = number;                       // ms since 1970 UTC
export type DayKey = string;                      // 'YYYY-MM-DD', local calendar date
export type TaskKind = 'timed' | 'check';
export type ColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5';
export type ClosedBy = 'user' | 'auto';
export type CloseOutcome = 'moved' | 'let_go';

export interface Topic { id: string; name: string; colorKey: ColorKey; sortOrder: number; isOpen: boolean; deletedAt: Epoch | null }
export interface Task {
  id: string; topicId: string; name: string; kind: TaskKind; minutes: number;
  repeatMask: number;  // bit 0 = Monday … bit 6 = Sunday
  isDefault: boolean; cue: string | null; treat: string | null; note: string;
  sortOrder: number; deletedAt: Epoch | null;
}
export interface Day { dayKey: DayKey; planConfirmedAt: Epoch | null; closedAt: Epoch | null; closedBy: ClosedBy | null; dayStartHour: number }
export interface DayTask {
  id: string; dayKey: DayKey; taskId: string | null; topicId: string; name: string; colorKey: ColorKey;
  kind: TaskKind; budgetSec: number; cue: string | null; treat: string | null;
  forwardedFromDayKey: DayKey | null; completedAt: Epoch | null; closeOutcome: CloseOutcome | null; sortOrder: number;
}
export interface Session { id: string; dayTaskId: string; startedAt: Epoch; endedAt: Epoch | null }
export type DayTaskDraft = Omit<DayTask, 'id'>;

export const MINUTES = { min: 5, max: 180, step: 5 } as const;
export const GOLD_OVERTIME_MS = 60_000;
export const DEFAULT_DAY_START_HOUR = 4;
```

## `src/domain/dayKey.ts` (chunk 1) — doc 04 §1

```ts
dayKeyOf(instant: Epoch, dayStartHour: number): DayKey
dayStartOf(dayKey: DayKey, dayStartHour: number): Epoch     // local dayKey at H:00
dayEndOf(dayKey: DayKey, dayStartHour: number): Epoch       // = dayStartOf(addDays(dayKey, 1), H)
addDays(dayKey: DayKey, n: number): DayKey
weekdayIndex(dayKey: DayKey): number                        // 0 = Monday … 6 = Sunday
repeatsOn(repeatMask: number, dayKey: DayKey): boolean
weekStartOf(dayKey: DayKey): DayKey                         // the Monday of that week
compareDayKeys(a: DayKey, b: DayKey): number                // <0, 0, >0
isDayKey(s: string): boolean
```

## `src/domain/timer.ts` (chunk 2) — doc 04 §4, §5

```ts
type TimerState = 'idle' | 'running' | 'paused' | 'overtime' | 'stopped';
focusedMs(sessions: Session[], now: Epoch): number
remainingMs(budgetSec: number, sessions: Session[], now: Epoch): number            // may be negative
completionTime(budgetSec: number, sessions: Session[], now: Epoch): Epoch | null    // exact instant focused hit budget, if by `now`
overtimeMs(budgetSec: number, sessions: Session[], now: Epoch): number             // max(0, focused − budget)
isGold(budgetSec: number, sessions: Session[], now: Epoch): boolean                // overtime ≥ GOLD_OVERTIME_MS
timerState(dayTask: DayTask, sessions: Session[]): TimerState
minutesLeftLabel(remainingMs: number): number    // ceil(max(0, r) / 60000)
extraMinutesLabel(overtimeMs: number): number    // floor(o / 60000)

type StartDecision =
  | { ok: true; closeSessionId: string | null }   // close the other open session at `now` first
  | { ok: false; reason: 'not_timed' | 'done' | 'day_closed' | 'already_running' };
startDecision(target: DayTask, day: Day, openSession: Session | null): StartDecision
pendingCompletions(dayTasks: DayTask[], sessionsByDayTask: Record<string, Session[]>, now: Epoch): { dayTaskId: string; completedAt: Epoch }[]
toggleCheck(dayTask: DayTask, day: Day, now: Epoch): { ok: true; completedAt: Epoch | null } | { ok: false; reason: 'not_check' | 'day_closed' }
```

## `src/domain/plan.ts` (chunk 3) — doc 04 §2, §3

```ts
type PlanReason = 'default' | 'repeats' | 'not_on_day' | 'forwarded' | 'one_off' | 'saved';
interface PlanRow {
  key: string;                    // stable: dayTask id, task id, or 'oneoff:<n>'
  taskId: string | null; topicId: string; name: string; colorKey: ColorKey; kind: TaskKind;
  minutes: number; cue: string | null; treat: string | null;
  ticked: boolean; reason: PlanReason;
  forwardedFromDayKey: DayKey | null;
  dayTaskId: string | null;       // set when the row already exists in day_tasks
}
interface PlanDraft { dayKey: DayKey; groups: { topicId: string; rows: PlanRow[] }[]; notOn: PlanRow[] }

buildPlan(input: { dayKey: DayKey; topics: Topic[]; tasks: Task[]; day: Day | null; dayTasks: DayTask[] }): PlanDraft
  // dayTasks = that day's existing rows. If day?.planConfirmedAt is null, rows with
  // forwardedFromDayKey are shown as 'forwarded' rows, and other existing rows (the unplanned-day
  // prefill, doc 04 §3) attach to their library task's row by taskId: that row keeps its
  // dayTaskId, per-day values, and ticked state, so Confirm updates it instead of inserting a duplicate.
  // (Amended after the chunk 3 check, error 1.)
setTicked(d: PlanDraft, key: string, ticked: boolean): PlanDraft
stepMinutes(d: PlanDraft, key: string, delta: 5 | -5): PlanDraft     // clamp to MINUTES
setCue(d, key, cue: string | null): PlanDraft
setTreat(d, key, treat: string | null): PlanDraft
addOneOff(d, row: { topicId: string; name: string; colorKey: ColorKey; kind: TaskKind; minutes: number }): PlanDraft
canConfirm(d: PlanDraft): boolean
confirmPlan(d: PlanDraft, existing: DayTask[], sessions: Session[]): { insert: DayTaskDraft[]; update: DayTask[]; deleteIds: string[] }
  // rows with sessions or completedAt are never deleted, even if unticked
plannableDays(todayKey: DayKey, today: Day | null): DayKey[]          // [tomorrow] or [today, tomorrow]
prefillUnplanned(input: same as buildPlan): DayTaskDraft[]            // doc 04 §3: ticked rows with no edits
```
Note edits are **not** in plan.ts: notes live on the library task (a repo write).

## `src/domain/rollover.ts` (chunk 4) — doc 04 §6, §3

```ts
interface DayBundle { day: Day; dayTasks: DayTask[]; sessionsByDayTask: Record<string, Session[]> }
interface Ops {
  closeSessions: { id: string; endedAt: Epoch }[];
  completions: { dayTaskId: string; completedAt: Epoch }[];
  outcomes: { dayTaskId: string; closeOutcome: CloseOutcome }[];
  closeDays: { dayKey: DayKey; closedAt: Epoch; closedBy: ClosedBy }[];
  createDays: Day[];                 // e.g. the next day receiving forwarded tasks, or today
  insertDayTasks: DayTaskDraft[];    // forwarded rows, today's prefill
}
missingOutcomes(b: DayBundle, outcomes: Record<string, CloseOutcome>): string[]   // unticked check ids without a choice
closeByHand(b: DayBundle, outcomes: Record<string, CloseOutcome>, next: { day: Day | null; dayTasks: DayTask[]; dayStartHour: number }, now: Epoch): Ops
  // next.dayTasks added in chunk 4: a moved task already planned in the next day isn't inserted twice.
rollover(input: { now: Epoch; dayStartHour: number; openDays: DayBundle[]; today: { day: Day | null; dayTasks: DayTask[] }; topics: Topic[]; tasks: Task[] }): Ops & { todayKey: DayKey; autoClosed: DayKey[] }
```
Decision (recorded, see the M1 README): a forwarded task is stored as a `day_tasks` row in the next
day. If that day has no `days` row yet, one is created with `planConfirmedAt = null`.
`prefillUnplanned` runs when today has `planConfirmedAt = null` and no non-forwarded rows, which makes it idempotent.

## `src/domain/collection.ts`, `calendar.ts`, `stats.ts` (chunk 5) — doc 04 §7–§10

```ts
interface CollectionItem { kind: 'planning' | 'task'; dayTaskId: string | null; colorKey: ColorKey; small: boolean; gold: boolean; at: Epoch }
collectionItems(b: DayBundle, now: Epoch): CollectionItem[]
isLidClosed(day: Day): boolean

glows(b: DayBundle, todayKey: DayKey): boolean
type ChainLink = 'solid' | 'rest' | 'today';
chain(todayKey: DayKey, itemCountByDay: Record<DayKey, number>): ChainLink[]   // 8 links, oldest first, last = 'today'

dayNumber(firstDayKey: DayKey | null, todayKey: DayKey): number
daysShowedUp(itemCountByDay: Record<DayKey, number>): number
focusedHours(allSessions: Session[], now: Epoch): number
marbles(itemCountByDay: Record<DayKey, number>): number
topicWeeklyMinutes(tasks: Task[], topicId: string): number
weekDots(topicId: string, weekBundles: DayBundle[], now: Epoch): CollectionItem[]   // max 6
```

## `src/data/` (chunks 6–7)

- `schema.ts`: Drizzle `sqlite-core` tables matching doc 03 exactly (names, columns, the unique index, and
  the partial unique index for one open session). Booleans use `integer({ mode: 'boolean' })`.
- `migrations/`: generated by drizzle-kit. Never hand-edited after they ship.
- `db.ts`: opens `expo-sqlite`, exports the app's Drizzle db + the migrations bundle. This is the only file that imports `expo-sqlite`.
- `repos/*.ts`: each exports functions taking `db: DB` first, where `DB` is a driver-neutral sync
  Drizzle SQLite type exported from `src/data/types.ts`. The app passes the expo db; tests pass a better-sqlite3 db.
  Repos return **domain types** (`Topic`, `Task`, `Day`, `DayTask`, `Session`) and never leak Drizzle row types.
- `repos/ops.ts`: `applyOps(db, ops, newId, now)` writes a rollover/close `Ops` in one transaction.
  This is the single bridge from domain decisions to storage.

## `src/state/clock.ts` (chunk 8)

`now(): Epoch` plus `setClockOverride(fn | null)` for tests/dev. This is the only place that reads the real time.
