# M2 contract — Topics tab

Binding interface between the M2 chunks. Sources of truth: `docs/05-screens-and-navigation.md` (Topics and
Topic edit rows), `docs/06-design-system.md` (components, motion, a11y), `docs/04-domain-rules.md` §10–§11,
`docs/07-quality-security-testing.md`, and the style-lab prototype `drafts/ysave-style-lab.html` (Topics
page: `TLIB`, `taskBack`, `p-flipback`, topic form) for look and behaviour. M1's contract
(`docs/build-reports/M1/contract.md`) still holds. Paths are relative to `mobile/`.

**M2 is done when:** you can build your real topics and tasks on the phone, and they survive an app restart.

## Layering (unchanged, plus the state layer gets real code)

```
src/app/   routes: thin; a route may just re-export a screen from src/screens. Never import src/data.
src/screens/ route implementations (added in chunk 3): may import ui, state and domain types; never src/data;
           only src/app imports them.
src/ui/    presentational only: props in, callbacks out. No db, no state imports (theme is OK).
src/state/ hooks + actions. The only layer that calls repos, now() and newId().
src/data/, src/domain/  as in M1 (M2 should not need changes there; if it does, record why).
```

## Chunk 1 · State plumbing + library actions (`src/state/`)

```ts
// dbRef.ts: which database the app (or a test) uses. No expo-sqlite import here.
setDb(db: DB): void;  getDb(): DB          // getDb throws if unset
// store.ts: change signal so hooks re-read after writes
type Table = 'topics' | 'tasks' | 'days' | 'sessions' | 'settings';
useDataVersion(tables: Table[]): number    // re-renders when any listed table is bumped
bump(...tables: Table[]): void
// actions/library.ts: every write = repo call with getDb(), now(), newId(), then bump(); validation errors propagate (ValidationError)
createTopic(input: { name: string; colorKey: ColorKey }): Topic
updateTopic(id: string, patch: { name?: string; colorKey?: ColorKey; isOpen?: boolean }): Topic
removeTopic(id: string): void              // soft delete, cascades to tasks (repo)
moveTopic(id: string, dir: -1 | 1): void   // swap sortOrder with its neighbour
createTask(topicId: string, input: { name: string } & Partial<TaskInput>): Task  // name required (non-blank)
updateTask(id: string, patch: Partial<TaskInput>): Task
setTaskNote(id: string, note: string): Task
removeTask(id: string): void
DEFAULT_TASK: { kind: 'timed'; minutes: 30; repeatMask: 0; isDefault: false; cue: null; treat: null }  // draft defaults
// hooks/useTopicsLibrary.ts
useTopicsLibrary(): {
  topics: { topic: Topic; tasks: Task[]; weeklyMinutes: number; weekDots: CollectionItem[] }[];
  taskCount: number;
}  // topics by sortOrder; tasks grouped per topic in sortOrder; weekDots for the current Mon–Sun week
useTopic(id: string): Topic | null
```
- `src/app/_layout.tsx` calls `setDb(db)` once migrations succeed (one line; nothing else changes there).
- Week = `weekStartOf(dayKeyOf(now(), dayStartHour))` … +6 days, using `getDayStartHour`.
- **Unnamed tasks (decided):** the repo rejects blank names, so "+ Add task" opens a *draft* held in UI state
  (not in the db), starting from `DEFAULT_TASK`. The first non-blank name calls `createTask`; after that the card
  edits the real task. Leaving a draft blank discards it (nothing was written). Renaming an existing task to
  blank isn't saved: the field shows "A task needs a name" and keeps the last saved name.

## Chunk 2 · UI primitives (`src/ui/`) — presentational, themed, accessible

| Component | Props | Notes |
|---|---|---|
| `Fold` | `{ title: string; colorKey: ColorKey; subtitle?: string; right?: ReactNode; open: boolean; onToggle(): void; children }` | Topic accordion: fold background = `t.topic(k).fold`. Height animates with `t.motion`; instant under Reduce Motion. a11y: button, `expanded` state |
| `WeekRing` | `{ mask: number; onChange(mask: number): void; size?: number; readOnly?: boolean }` | 7 SVG slices M T W T F S S, bit 0 = Monday. Each slice is its own touch target with a label like "Monday, repeats". |
| `TimeSlider` | `{ value: number; onChange(v: number): void; min?: 5; max?: 180; step?: 5 }` | Pan gesture (gesture-handler). a11y `adjustable` with increment/decrement actions in steps of 5. Shows "45 min" |
| `Switch` | `{ value: boolean; onChange(v: boolean): void; label: string }` | Themed; a11y `switch` |
| `Segmented` | `{ options: { value: string; label: string }[]; value: string; onChange(v: string): void }` | Used for Timed / Checklist |
| `ChipSet` | `{ options: string[]; value: string \| null; onChange(v: string \| null): void; label: string }` | Tap the selected chip again to clear it. Used for cue and treat presets |
| `ConfirmBox` | `{ text: string; confirmLabel: string; onConfirm(): void; onCancel(): void; danger?: boolean }` | Inline confirm (no system alert) |
| `ColorSwatches` | `{ value: ColorKey; onChange(k: ColorKey): void }` | 6 topic colors from the palette |
| `TextField` | `{ value; onChangeText; label; maxLength; placeholder?; multiline? }` | Themed input, shows a counter near the limit |

Cue/treat presets live in `src/domain/presets.ts`? **No:** they're UI copy, so `src/ui/presets.ts`:
`CUES = ['After breakfast', 'After class', 'After lunch', 'Before bed']`, `TREATS = ['Lo-fi playlist', 'Podcast', 'Tea', 'Favorite snack']` (from the prototype).
All touchables ≥ 44 pt, role + label. Every color comes from the theme. RNTL tests for each interactive component.

## Chunk 3 · Topics screen (`src/app/(tabs)/topics.tsx` + `src/ui/TaskCard.tsx`)

- Header "Topics" + "n topics · m tasks"; hint "Tap a task to flip it. Dots are this week's marbles."
- A `Fold` per topic: name, task count, weekly time ("4h 30m / week"), up to 6 week dots, "⋯" → `/topic/[id]`. Open state persists (`isOpen`).
- Task row (front): name, repeat text ("Mon Wed Fri" / "Every day" / "Weekdays" / "No repeat days"), "checklist" or "45 min", "· default".
- Tap the row → flip (rotateX with `t.motion`, instant under Reduce Motion) to the back: name field, WeekRing,
  Timed/Checklist segmented, TimeSlider (timed only; minutes kept when switching), default Switch, cue ChipSet,
  treat ChipSet, note field, Delete (with ConfirmBox: "Past days keep their marbles."), Done. One card open at a time.
  The back sits in the screen's ScrollView, so it scrolls with the screen (open question 9's bug).
- Edits save on change (debounced for text, ~400 ms) through actions. A draft task (from "+ Add task") is saved when its name becomes non-empty; Done or flipping away with a blank name discards the draft.
- "+ Add task" per topic, "+ New topic" at the end → `/topic/new`. Empty state: "No topics yet · Start with one thing you want to give time to." + "+ New topic".

## Chunk 4 · Topic new/edit (`src/app/topic/new.tsx`, `src/app/topic/[id].tsx`, shared `src/ui/TopicForm.tsx`)

- Name (max 24, required), `ColorSwatches`, a live preview `Fold`. Save → back. On edit: "Remove topic" → ConfirmBox
  ("Removes its tasks from your library. Past days keep their marbles.") → `removeTopic` → back to Topics.
- Header "‹ Topics" back; Android back works. Uses the stack transition from the look.

## Cross-cutting
- No `any`. No hard-coded colors outside the theme (the existing danger red in Button may be reused).
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage` (domain gate must still pass).
