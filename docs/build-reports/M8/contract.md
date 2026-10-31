# M8 contract — Polish + ship

Binding interfaces between chunks. A chunk may add private helpers; anything another chunk uses is listed here.
Layering stays: screens/ui never import `src/data` or `getDb`; only `src/state` calls repos, `now()`, `newId()`.

Done when (roadmap): a friend can install the preview APK and use it from first open.

## Chunk 0 · App icon + splash (done, lead)
See README. Assets only; `assets/brand/unfinished-sun.svg` is the mark's source geometry.

## Chunk 1 · Onboarding state
Files: `src/state/actions/onboarding.ts`, `src/state/hooks/useOnboarding.ts`, tests in `src/state/__tests__/`.

```ts
// src/state/hooks/useOnboarding.ts
/** True when the welcome flow should show: no `onboardedAt` AND no topics AND no days rows.
 *  Existing installs (any topic or day) are treated as onboarded, so nobody already using the app sees it. */
export function useNeedsOnboarding(): boolean;
export function needsOnboarding(): boolean; // same rule, non-hook (for index redirect and tests)

// src/state/actions/onboarding.ts
export interface OnboardingInput {
  dayStartHour: number;                         // 0..23
  topic: { name: string; colorKey: ColorKey };  // name trimmed, 1..24 chars (repo rules)
  task: { name: string; minutes: number | null }; // null = checklist task (kind 'check'); else timed minutes (repo MINUTES: 5..180, step 5)
}
/** Sets the day start, creates the topic and one task (repeats every day, isDefault true so it is pre-ticked),
 *  records `onboardedAt = now()`. Validation errors throw before anything is written. Returns today's key so the
 *  caller can open Plan(today). Bumps settings, topics, tasks. */
export function finishOnboarding(input: OnboardingInput): { todayKey: DayKey };
/** "I'll set things up myself": records `onboardedAt` only. */
export function skipOnboarding(): void;
```
`ONBOARDED_SETTING = 'onboardedAt'` (already a known settings key, doc 03).

## Chunk 2 · Welcome flow UI
Files: `src/ui/SunMark.tsx`, `src/screens/OnboardingScreen.tsx`, `src/app/onboarding.tsx`, `src/app/index.tsx`.

```ts
// src/ui/SunMark.tsx — the app icon's mark drawn with react-native-svg from assets/brand/unfinished-sun.svg geometry
export function SunMark(props: { size: number; color?: string /* default theme accent-safe yellow #f7d45e */ }): JSX.Element;
```
- `index.tsx`: `needsOnboarding()` → `/onboarding`; otherwise the existing Morning/Today rule.
- Steps (one screen, internal step state, back goes to previous step):
  1. Welcome: SunMark, "YSave Mornings", one line on the idea, privacy line "Everything stays on this phone.
     Uninstalling the app deletes it." Buttons: "Start", "I'll set it up myself" (→ `skipOnboarding()` → `/today`).
  2. Day start: reuse `HourPicker`; default 4 AM; copy explains a day ends at this hour.
  3. First topic: name + 6 colour swatches (reuse `TextField`, `ColorSwatches`).
  4. First task: name + Checklist / 15 / 30 / 45 / 60 / 90 (reuse `ChipSet`).
  5. "Plan today" → `finishOnboarding(...)` → `router.replace('/plan/' + todayKey)`.
- Next is disabled until the step is valid. All copy calm, no pressure.

## Chunk 3 · Accessibility pass
- New `src/theme/__tests__/contrast.test.ts`: every palette's body text and muted text against its bg and card
  surfaces (glass included) ≥ 4.5:1 (muted ≥ 4.5 if used for body copy, else ≥ 3:1 for large/secondary). Fix tokens
  in `src/theme` that fail; list every change in the report.
- Every touchable in `src/ui` and `src/screens` has `accessibilityRole` + `accessibilityLabel` (test or audit list).
- Targets ≥ 44 × 44 pt (incl. carried: Calendar cells below ~340 dp: allow hitSlop or row height).
- Font scale 1.3: text that can clip gets `numberOfLines`/wrapping; screens scroll. `T` stays scalable.
- No new public interfaces.

## Chunk 4 · Performance pass
- Run screen: the 1 Hz tick re-renders only the number/bar (verify; add a render-count test).
- Lists that can exceed 30 items use `FlatList` (Topics library, Plan list): audit, convert only if needed.
- Glass on low-end Android: `src/theme` gets `lowEndDevice: boolean` input to `buildTheme` options; when true and the
  user has not chosen a blur level, default blur is off. Detection in `src/state` via `expo-device`
  (`Device.totalMemory < 3 GB` or `deviceYearClass < 2019`), passed through ThemeProvider. No change to saved looks.
- Report: what was measured, what changed, what needs a real device.

## Chunk 5 · Carried fixes (M6/M7 lists)
`setDayStart` uses one `at` across reconcile and write; Day start and Plan `router.back()` fallback to `/today` when no history (Plan opened by `router.replace` from onboarding);
NOT_PLANNABLE copy mentions planning ahead; empty-draft hint; stale test title CalendarScreen.test.tsx:180;
CalendarScreen and GlassScreen tests leaner or given a modest timeout (both time out under full parallel load, pass alone); ChipSet default clear-path test.

## Chunk 6 · Release plumbing
- `eas.json`: `development` (dev client, internal), `preview` (Android APK, internal), `production`.
  `app.json`: `runtimeVersion: { policy: 'appVersion' }`. No secrets in the repo.
- `.github/workflows/ci.yml`: on push/PR: `npm ci`, typecheck, lint, test (Node LTS).
- `.maestro/golden-path.yaml`: onboard → plan today → start a task → back → close → plan tomorrow, using
  `testID`s added where missing. Runs on a dev/preview build (not Expo Go); documented, not run in CI.
- Docs 08 updated: how to build the preview APK (`eas login`, `eas build -p android --profile preview`).

## User steps
Expo account + `eas login` (user types it), then the preview build. Phone check after chunk 2 (welcome flow in
Expo Go) and after the preview build (icon, splash, install from first open).

## Chunk 7 · Color & glass (phone check, user 2026-10-31)
User: the tint options are the whole app's colour, not a glass feature. Split them:
- **Color** (the `glass` tint key, name kept for saved-data compatibility): the coloured background blobs and the chain
  colours apply on EVERY surface (flat, raised, outline, glass), not only when `surf === 'glass'`. "Match the palette"
  stays the default and looks as today.
- **Glass**: the "Frosted glass" switch only toggles the frosted card surface (`surf` glass ↔ the non-glass surface the
  user had, or `flat` if none) plus the blur level. Turning glass off keeps the chosen colour. Picking a colour no longer
  forces glass on.
- Theme: `buildTheme` exposes the blobs independently of glass (e.g. `t.backdrop: { blobs } | null`, with
  `t.glass` keeping frost/blur/intensity); `Background` draws blobs from it; low-end and Reduce Transparency rules
  unchanged (they only affect blur).
- Screen: title "Color & glass"; sections COLOR · <NAME> (28 tints) first, then GLASS (switch + blur). Profile and Look
  rows read "Color & glass", value "<tint name> · Frosted" or "<tint name> · No frost".
- No change to the saved LookMix shape. Contrast test extended so text on the page and on solid cards stays ≥ the
  existing thresholds over the blobs for every surface.

## Chunk 8 · The colour colours the whole app (phone check, user 2026-10-31)
User (twice): the colour picked in Color & glass is for the whole app, not only glass / the background.
When a tint other than "Match the palette" is chosen, `buildTheme` derives the app's colours from it:
- `accent` (buttons, links, switches, selected chips, tab-bar highlight, focus rings) = the tint's main colour,
  darkened/lightened only as much as needed to reach ≥ 4.5:1 on bg and surface (and under the button label `on`).
- `bg` = the palette bg mixed clearly toward the tint; `surface` (cards) = a light touch of the tint; `line` follows.
  `ink`, `muted`, `danger` are adjusted only if needed to keep ≥ 4.5:1 on the new bg/surface.
- Chain and background blobs follow the tint (as chunk 7). Glass stays frost + blur only.
- "Match the palette" = exactly today's palette colours (no change for anyone who hasn't picked a colour).
- Saved LookMix shape unchanged; Night stays dark (tint mixed into a dark base).
- Contrast test: for every palette × tint × surface, ink/muted/accent/danger ≥ 4.5 on bg, surface and blobs;
  `on` label ≥ 4.5 on accent and dangerFill.
- Glass screen preview and Look preview show the derived colours. Copy: the sub line says the colour is used across the app.
- **Addition (user, 2026-10-31):** the six palettes (Mist, Sunrise, Lagoon, Paper mono, Lavender, Night owl) join the
  COLOR list, first, so all colour choices live in one place. Picking a palette = `pal` + match tint (exactly that
  palette). Picking a tint = current `pal` as the light/dark base + everything follows the tint. The visible "Match the
  palette" tint is replaced by the palette entries (key kept for saved data). Look's Palette aspect stays (same key).

## Chunk 9 · Default changes after planning (phone check, user 2026-10-31)
User's exact path: today closed; tomorrow planned + confirmed; then in Topics created task B (new topic, all 7 days,
default on); reopened tomorrow's plan → B listed UNTICKED. User expects ticked. Also the reverse.
Rule (user chose the recommended option):
- In an already confirmed (or drafted) future plan, a library task whose **default was turned on (or that was created as
  default) AFTER that day's plan was confirmed/drafted**, and that repeats on that day, shows **ticked** when the plan is
  reopened; it joins the plan on Confirm (nothing is written until Confirm).
- A task in that plan whose **default was turned off AFTER** confirmation shows **unticked** when reopened, and is left
  out on Confirm unless the user ticks it (started/finished rows are never dropped, ADR-009).
- Choices made at/before confirmation win: a default task the user unticked when confirming stays unticked; a
  non-default task the user ticked stays ticked. Only changes after confirmation move the tick.
- Needs a per-task timestamp of the last default change (e.g. `tasks.default_changed_at`, set on create and whenever
  `isDefault` changes), compared with the day's `planConfirmedAt` / `planDraftedAt`. Drizzle migration; existing rows
  get NULL (= no change after any plan). Repo + domain (buildPlan) + tests.
- Today tab's tomorrow list keeps showing stored rows only (B appears there after Confirm).

## Chunk 10 · Day notes (phone check, user 2026-10-31)
User: "Note can be added anywhere, but it all should be reflected in today. On the library the note might be the general
note for that task; in tomorrow's plan the note might specify what to do tomorrow; in today's edit it might be an action
to take on that task. A note added for today or while planning tomorrow should NOT be added to the library."
Rule (ADR-011):
- `tasks.note` = the general note (Library editor only). `day_tasks.note` (new, nullable, max 1000, blank = null) = that
  day's note, on every row including one-offs.
- Plan's Note field edits the row's day note ("Note for <weekday>"), saved with the draft/confirm like cue/treat; the
  library note shows read-only above it ("Library note: ..."). Nothing is ever copied between the two.
- Editing today's plan keeps and edits the same day note. Stored rows of an open day: `setDayTaskNote(dayTaskId, note)`
  (refuses on a closed day).
- A moved task carries its day note to the next day's row (an existing next-day row keeps its own note if it has one).
- Done in chunk 11: the task page on Today, `setTaskNoteFromPlan` removed.

## Chunk 11 · Task page (phone check, user 2026-10-31)
User: tapping a task on Today must open it so the notes added earlier can be read; every task (timed or checklist) opens
a page with the cumulative notes, a Start/Pause button (timed) or Mark done (checklist), and a back button. Also: on
Today a checklist row had its tick box before the name while a timed row shows its time after it; remove the boxes and
say "checklist" after the name.
Rule:
- Route `/run/[dayTaskId]` is the task page for both kinds. Notes: "Library note" (read-only, only if non-empty) and
  "Note for <weekday>" (`day_tasks.note`, editable while the day is open via `setDayTaskNote`, debounced, flushed on leave).
- Checklist: "Mark done" / "Mark not done" (`toggleCheckTask`), state label To do / Done, celebration + collection on done.
- Closed day: page opens read-only (notes not editable, no action, "Back to Today", "Today is closed. It is read-only now.").
- Today: no tick boxes. A checklist row = dot, name, "checklist" (or check mark + "done"). Every row opens the page, closed day included.
- `setTaskNoteFromPlan` is removed: only the Library editor writes `tasks.note`.

## Chunk 12 · A task needs no topic (phone check, user 2026-10-31)
User: "When planning tomorrow and creating a new task, I can see topic (required), name, length/checklist; I could not
see any note section. So add that note section. Also don't make that topic for a task necessary, either in the planning
tomorrow part or in the library. So in the library there should also be not just add new topic, also add new task."
Rule (ADR-012):
- One built-in topic `NO_TOPIC_ID = 'no-topic'` ("No topic", colorKey `none`, sortOrder 1000000), created by migration
  `20261031212212_no_topic` (`INSERT OR IGNORE`). Not renameable, recolourable or deletable (repo `ValidationError`).
  `listTopics` includes it; `listUserTopics` does not (onboarding, move up/down, new-topic colour pick use the latter).
- Theme: `t.topic('none')` = muted ink, fold = page colour. `TOPIC_COLOR_KEYS` (the swatches) stays six.
- State: `createTask(topicId | null | undefined, input)` (missing/null = No topic); `updateTask(id, { topicId })` moves a
  task to the end of any live topic or `NO_TOPIC_ID` (missing/deleted topic = `ValidationError`).
- Library list (`useTopicsLibrary`) shows No topic (last) only while it holds a live task; `useTopic(NO_TOPIC_ID)` is
  null, so `/topic/[id]` shows "missing"; the Topics header counts user topics only and the fold has no "⋯".
- Plan one-off form: Task name, Topic (No topic first, default), Length, "Note for <weekday>" (optional, max 1000;
  blank = null, stored as the row's day note). Add needs only a name.
- Chunk 13: see below.
- Chunk 14: see below.
- Chunk 15: see below.

## Chunk 13 · Library: new task + topic picker (phone check, user 2026-10-31)
User: "...in the library there should also be not just add new topic, also add new task."
Rule:
- Library has "+ New task" (testID `library-new-task`) beside "+ New topic"; it works with no topics. It opens the same
  draft card as "+ Add task", with No topic chosen. While No topic holds no task, a stand-in "No topic" fold shows the
  draft; once the draft is named the task is created and the group is real.
- Task card back: "Topic" radiogroup (`ui/TopicPicker`, shared with the Plan one-off form): No topic first, then user
  topics. `TaskCardValue.topicId` + props `topics`, `topicError?`; the patch `{ topicId }` goes through `onChange`.
  Saved task: `updateTask(id, { topicId })` (moves to the end of that topic, its fold is opened). Draft: kept in the
  editor, used by `createTask` once named; "+ Add task" inside a topic starts with that topic.
- `TaskEditor` props: `topics`, `onCreated(id, topicId)`, `onMoved?(topicId)`. A `ValidationError` (topic deleted
  meanwhile) shows "That topic no longer exists. Pick another." under the picker.

## Chunk 14 · Delete topic: move tasks first (phone check, user 2026-10-31)
User: "When given a scenario where the topic is being deleted, give them a choice if they want to move any tasks in it before deleting, then go ahead with the decision yes or no."
Rule (ADR-013):
- Topic with no live tasks: Remove shows the plain confirm (unchanged).
- Topic with N live tasks: "<Topic> has N tasks. Move any of them before deleting?" with "Yes, move tasks", "No, delete all" (danger), "Cancel".
- Yes: the tasks with a checkbox each (all ticked), a "Move to" `TopicPicker` (No topic first, other live topics, not this one; default No topic), the line "X move to <Topic> · Y is deleted", "Move and delete topic" (danger) and "Back".
- `removeTopic(id, { moveTaskIds, toTopicId? })` (state) -> `softDeleteTopic(db, id, now, { taskIds, toTopicId })` (repo). One transaction: moved tasks join the end of the target in their old order, then the topic and the remaining tasks get `deletedAt`. `ValidationError` (nothing written) for: no target, target missing/deleted/the topic itself, an id that is not a live task of the topic, No topic. The screen shows it as text and stays.
- Day rows are not touched. `useTopicRemoval(id)` gives the screen the tasks and the targets. `TopicPicker` gets an optional `label`.

## Chunk 15 · Delete topic: choose a topic per task (phone check, user 2026-10-31)
User: "Good, it's asking to move all tasks of the topic to just one topic when deleting that topic. For each task give an option to pick which topic to move it to."
Rule (amends chunk 14, ADR-013):
- The first step is unchanged ("<Topic> has N tasks. Move any of them before deleting?" Yes / No, delete all / Cancel), and so is the empty-topic confirm.
- Yes: one row per task, a button "<Task> -> <Destination>" (accessibilityLabel "<Task>, moves to <Destination>. Change", or "<Task>, is deleted. Change"). Default No topic. Tapping opens, under that row only, a `TopicPicker` (label "Move <Task> to"): No topic first, other live topics (never this one), then "Delete". Picking sets it and collapses the row; one row open at a time.
- Summary "X move · Y is deleted" (X=1 reads "1 moves", Y=1 reads "is"; "0 move" when all are deleted). Buttons "Move and delete topic" (danger) and "Back".
- Only tasks still in the current list are submitted; a task added meanwhile shows with No topic.
- `removeTopic(id, { moves: [{ taskId, toTopicId }] })` -> `softDeleteTopic(db, id, now, { moves })`; replaces `moveTaskIds`/`toTopicId`. Tasks not listed are deleted with the topic. One transaction; validated before any write: each target live and not the topic, each taskId a live task of the topic, no duplicate taskId (`ValidationError`, nothing written). Each moved task goes to the end of its target, tasks to the same target keep their old relative order.
- `TopicPicker` gets an optional `extra: { id, name }` shown last without a color dot (used for "Delete").
