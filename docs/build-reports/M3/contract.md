# M3 contract — Planning

Binding interface between the M3 chunks. Sources of truth: `docs/04-domain-rules.md` §2–§3 and §7,
`docs/05-screens-and-navigation.md` (Plan and Planned rows, Map), `docs/06-design-system.md` (collection
renderers, motion), `docs/07-quality-security-testing.md`, and the prototype `drafts/ysave-style-lab.html`
(`makePlan`, `planRow`, `p-planbar`, `jarSVG`, the planned screen). M1 and M2 contracts still hold
(layers incl. `src/screens/`; screens import errors from `@/state/errors`; forms use a submit guard).
Paths are relative to `mobile/`.

**M3 is done when:** you can plan tomorrow (and today, if today has no plan) in under 3 minutes.

## Chunk 1 · Plan state (`src/state/`)

```ts
// hooks/usePlannableDays.ts
usePlannableDays(): { todayKey: DayKey; days: DayKey[] }      // domain plannableDays with today's Day
// hooks/usePlanDraft.ts: in-memory draft; nothing is written until confirm
usePlanDraft(dayKey: DayKey): {
  draft: PlanDraft | null;            // null while loading or if the day isn't plannable
  plannable: boolean;
  dirty: boolean;
  totals: { count: number; minutes: number };     // ticked rows; minutes of ticked timed rows
  toggle(key: string): void;  step(key: string, delta: 5 | -5): void;
  setCue(key: string, v: string | null): void;  setTreat(key: string, v: string | null): void;
  addOneOff(row: { topicId: string; name: string; kind: TaskKind; minutes: number }): void;  // colorKey from topic
  canConfirm: boolean;
  confirm(): void;   // calls confirmDayPlan(dayKey, draft) and then FREEZES the draft: later 'days' bumps no longer
                     // rebuild it, so the screen doesn't flash while navigating to Planned (amended after the chunk 1 check)
}
// Input to buildPlan: listTopics + listTasks PLUS getTask(id) for any deleted task referenced by that day's
// rows (M1 carried requirement), getDay, the day's dayTasks (loadDayBundle).
// actions/plan.ts
confirmDayPlan(dayKey: DayKey, draft: PlanDraft): void
  // one call: confirmPlan(draft, existing, sessions) → saveConfirmedPlan(db, { dayKey, dayStartHour: getDayStartHour(), result, now, newId })
  // throws if the day isn't plannable; bumps 'days'
setTaskNoteFromPlan(taskId: string, note: string): void  // notes edit the library task (doc 04 §2); bumps 'tasks'
// hooks/useDayPlan.ts: for the Planned screen
useDayPlan(dayKey: DayKey): { day: Day | null; rows: DayTask[]; items: CollectionItem[] }
// hooks/useSubmitGuard.ts (M2 carried requirement)
useSubmitGuard(): { busy: boolean; run<T>(fn: () => T): T | undefined; reset(): void }
```

- **Rule change 2026-10-29 (ADR-009):** `plannableDays` now returns [today, tomorrow] while today is open
  (`closedAt == null`), even after today's plan was confirmed; [tomorrow] once today is closed. So
  `confirmDayPlan` / `usePlanDraft` accept re-confirming today (rows with sessions or completedAt kept,
  planConfirmedAt keeps its first value). Not-plannable text is now "You can plan today until it closes, or tomorrow."

## Chunk 2 · Plan controls (`src/ui/`)

| Component | Props | Notes |
|---|---|---|
| `Checkbox` | `{ checked; onChange(v); label }` | ≥44 pt, role checkbox |
| `Stepper` | `{ value; onChange(v); min=5; max=180; step=5; unit='min'; label }` | − / value / +, a11y adjustable |
| `PlanRow` | `{ row: PlanRow; topicName: string; dayKey: DayKey; locale?: string; expanded: boolean; onToggleTick(); onToggleExpand(); onStep(delta); onCue(v); onTreat(v); note: string; onNote(text) }` | Checkbox + name + subtitle by `reason`: default → "default"; repeats → "repeats <Fri> · not a default"; not_on_day → "not on <Fridays> · add once"; forwarded → "from <Thursday>"; one_off → "just for <Friday>"; saved → the minutes. Expanded editor: Stepper (timed only), cue ChipSet, treat ChipSet, note TextField |
| `OneOffForm` | `{ topics: { id; name; colorKey }[]; onAdd(row); onCancel() }` | Name (≤40), topic picker, kind+length chips: Checklist / 15 / 30 / 45 / 60 / 90 |
| `PlanFooter` | `{ count; minutes; dayName; canConfirm; busy; onConfirm() }` | "n tasks · Xh Ym planned" + "<Friday> looks like this ✓" |
(Amended after the chunk 4 check: PlanRow also takes optional `noteEditable?: boolean` (default true); when false
the note field is not rendered. The Plan screen passes `row.taskId != null`, because a one-off has no library note.
New state hooks so screens never read the db: `usePlanTopics(): Topic[]` (live, not deleted, sortOrder) and
`useTaskNote(taskId: string | null): string`.)
(Amended after the chunk 2 check: PlanRow takes `dayKey` + optional `locale` and formats every day name itself
through `dayNames.ts`, so one row never mixes two sources.)
Day-name helpers in `src/ui/dayNames.ts`: `weekdayName(dayKey)` ("Friday"), `weekdayPlural(dayKey)` ("Fridays"), `shortWeekday(dayKey)` ("Fri"). Use the device locale via `Intl`; tests pin en-US.

## Chunk 3 · Glass jar renderer (`src/ui/collection/`)

```ts
Jar({ items: CollectionItem[]; closed: boolean; scale?: number; animateLast?: boolean }): JSX.Element
Collection(props same as Jar)  // dispatcher; M3 has only the glass jar, other looks arrive in M7
```
- SVG ported from the prototype's `jarSVG` (glass art): marbles stacked from the bottom, topic colors via
  `t.topic(k).color`, planning marble in `sun`, `small` items smaller, `gold` items with a gold ring, lid when `closed`.
- `animateLast`: the last item drops from above with a bounce (reanimated, theme motion). Instant under Reduce Motion.
- a11y: one label, e.g. "Jar with 3 marbles".

## Chunk 4 · Plan screen (`src/app/plan/[dayKey].tsx` → `src/screens/PlanScreen.tsx`)

- Title "Plan <Friday>" (or "Plan today"), "‹ Back". Not plannable → "You can plan tomorrow, or today if it has no
  plan yet." + back.
- Topic groups (fold-style headers in topic color) with `PlanRow`s; one row expanded at a time. Then
  "Not on <Fridays> · tap to add once". "+ Add a one-off task" → `OneOffForm`.
- Sticky `PlanFooter`. Confirm uses `useSubmitGuard`, calls `confirmDayPlan`, then `router.replace('/planned/<dayKey>')`.
- Leaving discards unconfirmed edits (doc 04 §2). Note edits save to the library through `setTaskNoteFromPlan` (debounced, flushed).

## Chunk 5 · Planned screen + entry points

- `src/app/planned/[dayKey].tsx` → `src/screens/PlannedScreen.tsx`: "<Friday> is planned", the jar (`Collection`) with the
  planning marble dropping in (`animateLast`, once per visit), list of planned tasks (name, topic dot, minutes or
  "checklist"), buttons "Edit" → `/plan/<dayKey>` and "Done" → Today tab.
- Entry points until M4/M5 replace them: the Today tab placeholder gets "Plan tomorrow" (always) and "Plan today"
  (only when `usePlannableDays` includes today), plus "Tomorrow is planned · Edit" when tomorrow already has a plan.

## Cross-cutting
- No `any`; colors from the theme; all touchables role + label + ≥44 pt; Reduce Motion respected.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage` (domain gate holds).
