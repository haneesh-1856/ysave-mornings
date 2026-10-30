# M6 contract — Calendar + Profile

Binding interface between the M6 chunks. Sources of truth: `docs/04-domain-rules.md` §1 (day boundary), §8 (glow),
§10 (stats); `docs/05-screens-and-navigation.md` (Calendar, Profile, Day start rows); `docs/06-design-system.md`;
`docs/07-quality-security-testing.md`; the prototype `../drafts/ysave-style-lab.html` (`scrCalendar`, `scrProfile`, CSS
`.p-cal`, `.p-legend`, `.p-daycard`, `.p-stats`, `.p-set`, `.p-avatar`). M1–M5 contracts hold: screens use state hooks
only (never `src/data` / `getDb`); errors from `@/state/errors`; submit guard for one-shot actions; return to Today with
`dismissTo`; tests that cross a completion with fake timers use `doNotFake: ['queueMicrotask']`. Paths are relative
to `mobile/`.

**M6 is done when:** the calendar reflects your real week.

## Chunk 1 · Day-start change (`src/domain`, `src/data`, `src/state`)

Rule (doc 04 §1, made exact here): a day **ends at its own snapshotted hour**: `end(D) = dayEndOf(D, D.dayStartHour)`
(already how `rollover` closes days). A days row snapshots the setting when it is created. Changing the setting
never moves today: today keeps its snapshot; rows **after today** that already exist (e.g. tomorrow planned) get the
new hour; rows created later snapshot the new hour. So today still ends at the old hour, and from tomorrow on each
day ends at the new one.

```ts
// domain/dayKey.ts
// Amended by fix (Opus): a day with NO row must not take its end from the (new) setting, or a change can
// move today when yesterday is rowless. Exact rule:
dayEndHourOf(k: DayKey, settingHour, snapshotOf): number
  // = snapshotOf(k) ?? snapshotOf(k+1) ?? settingHour   (the hour day k ENDS at; rowless -> next day's row)
currentDayKey(now: Epoch, settingHour: number, snapshotOf: (k: DayKey) => number | undefined): DayKey
  // c = local calendar date of now; prev = c-1
  // now < dayEndOf(prev, dayEndHourOf(prev, settingHour, snapshotOf)) -> prev, else c
  // (end(D) always falls on D+1's date, so today is c-1 or c; days never skip or overlap.)
  // With no rows, or equal hours everywhere, this equals dayKeyOf(now, settingHour).
// data/repos/days.ts
setFutureDayStartHour(db, afterKey: DayKey, hour: number, now: Epoch): void   // rows with dayKey > afterKey
// state/today.ts (new; the only place that resolves "today")
todayKey(db: DB, at: Epoch): DayKey          // currentDayKey with getDayStartHour + getDay(...)?.dayStartHour
todayEnd(db: DB, at: Epoch): Epoch           // dayEndOf(todayKey, dayEndHourOf(todayKey, ...))  (amended by fix)
// state/actions/settings.ts
setDayStart(hour: number): void              // ValidationError outside 0–23; reconcile() first; setDayStartHour;
                                             // setFutureDayStartHour(todayKey); bump('settings','days')
// state/hooks/useDayStart.ts
useDayStart(): { hour: number; todayEndsAt: Epoch }   // setting hour; today's real end (for the explanation)
```
- Replace **every** `dayKeyOf(at, getDayStartHour(db))` "what is today" in `src/state` with `todayKey(db, at)`
  (reconcile, close, plan, useToday, useChain, useMorning, useDayBoundary, …). `rollover()` takes `todayKey` as an
  input instead of deriving it (keeps `dayStartHour` for the new row's snapshot). `useDayBoundary` arms to `todayEnd`.
- Tests: domain table for `currentDayKey` (4→6 and 4→2, at the old and new boundary, DST spring/fall in
  America/New_York, no rows); state test: change the hour in the evening → today's key unchanged, today closes at the
  old hour, tomorrow's existing row gets the new hour, the day after begins at the new hour.

## Chunk 2 · Calendar + Profile state (`src/domain`, `src/state`)

```ts
// domain/calendar.ts
monthKeyOf(dayKey): MonthKey                       // 'YYYY-MM'
addMonths(m: MonthKey, n: number): MonthKey
monthGrid(m: MonthKey): (DayKey | null)[][]        // weeks Mon..Sun, null = leading/trailing blank; 4–6 rows
// state/hooks/useCalendarMonth.ts
useCalendarMonth(month: MonthKey): {
  month: MonthKey; weeks: (CalendarCell | null)[][]; canPrev: boolean; canNext: boolean;
  todayKey: DayKey; tomorrowKey: DayKey; dayNumber: number;
}
CalendarCell = { dayKey; items: CollectionItem[]; glows: boolean; closed: boolean; isToday: boolean;
                 isTomorrow: boolean; isFuture: boolean }
  // canPrev: month > month of the first days row (or of today when none); canNext: month < month of tomorrow
// state/hooks/useDayCard.ts
useDayCard(dayKey: DayKey): {
  dayKey; kind: 'past' | 'today' | 'tomorrow' | 'later'; glows: boolean; planned: boolean; closed: boolean;
  done: number; total: number; focusedMs: number; extraMs: number; items: CollectionItem[];
  canPlan: boolean;            // dayKey is in plannableDays (ADR-009: open today, tomorrow)
}
// state/hooks/useProfileStats.ts
useProfileStats(): { dayNumber: number; daysShowedUp: number; focusedHours: number; marbles: number }
```
- Built on the existing domain (`glows`, `collectionItems`, `dayNumber`, `daysShowedUp`, `focusedHours`, `marbles`,
  `focusedMs`/`overtimeMs`) and repos; read only rows that exist (`listDays` + `loadDayBundle`). Hooks re-read on
  `useDataVersion(['days','sessions','settings'])`. Today from chunk 1's `todayKey`.

## Chunk 3 · UI (`src/ui/`)

| Component | Props | Notes |
|---|---|---|
| `MonthGrid` | `{ weeks: (CalendarCell\|null)[][]; selected: DayKey; onSelect(k); locale? }` | Weekday initials Mon-first (from `dayNames`), cells ≥44 pt, day number + mini `Collection` (small scale) when items, lid when closed, **glow** (theme `glow`/accent halo, static under Reduce Motion), today ring in `sun`, selected outline. a11y label "Thursday 22 October, glowing, 3 marbles" |
| `CalendarLegend` | `{}` | "Glowing days: everything you planned got done" |
| `DayCard` | `{ title: string; line: string; items; closed; glows; action?: { label; onPress } }` | Jar + title + one line + optional ghost button ("Plan"/"Edit") |
| `StatTiles` | `{ tiles: { value: string; label: string }[] }` | 3 tiles, tabular numerals |
| `SettingRow` | `{ label; value?: string; onPress?; right?: ReactNode; disabled? }` | "›" when pressable, role button; tag style for "Not decided"/"Coming later" |
| `HourPicker` | `{ value: number; onChange(h); locale? }` | 24 choices, "4:00 AM" style via `Intl`, role radiogroup, ≥44 pt |
| `dayCardLine` (pure, `src/ui/dayCardLine.ts`) | `(card, weekdayName) => string` | past/today: "Everything you planned, done. " (if glows) + "3 tasks · 1h 20m focused"; past with nothing: "A rest day. Nothing missing."; tomorrow: planned "Planned: n tasks. One marble waiting." else "Plan it tonight. One marble waiting."; later: "Not planned yet." Never "failed"/"missed". |

## Chunk 4 · Calendar screen

- `src/app/(tabs)/calendar.tsx` → `src/screens/CalendarScreen.tsx`. Header: month name (locale) + "Day N" note; ‹ ›
  arrows (disabled per canPrev/canNext) **and** horizontal swipe (gesture-handler Pan, no nested root) change month;
  `MonthGrid`; `CalendarLegend`; `DayCard` for the selected day (default today). Action when `canPlan`: "Edit" if
  planned else "Plan" → `router.push({ pathname: '/plan/[dayKey]', params: { dayKey } })`. Selecting a day outside the
  shown month isn't possible (blank cells). Month and selection reset to today when today changes (day boundary).
- **Amended by fix:** after a month change (arrow or swipe) the selection follows: today if the shown month contains
  today, otherwise the 1st of the shown month. The card never describes a day that is not in the grid.

## Chunk 5 · Profile + Day start

- `src/app/(tabs)/profile.tsx` → `src/screens/ProfileScreen.tsx`: avatar "Y", "You", "Day N with YSave Mornings",
  `StatTiles` (days you showed up · focused hours `formatMinutes`-style "14h" · marbles), settings card of
  `SettingRow`s: **My day starts** "4:00 AM ›" → `/settings/day-start`; **Look** (current preset name, "Full settings in
  M7") — keep the existing preset switcher below the list as "Try a look"; **Glass** "Coming in M7"; **Sounds**
  "Coming later"; **Reminders** "Not decided"; **Friends & teams** "Coming later".
- `src/app/settings/day-start.tsx` → `src/screens/DayStartScreen.tsx`: "‹ Profile", title "My day starts", `HourPicker`,
  explanation: "A session at 1 AM still counts as yesterday." plus, after a change, "Today still ends at 4:00 AM.
  From tomorrow, each day ends at 6:00 AM." (from `useDayStart().todayEndsAt`). Selecting calls `setDayStart` at once
  (no Save). Android back = "‹".

## Chunk 6 · Phone-check changes (user request 2026-10-30)

Amends chunks 2, 4 and 5 after the user's phone check.
- **Free browsing.** The calendar is not limited to the history range: the user can go to any past or future month.
  `useCalendarMonth` drops `canPrev`/`canNext` (or both are always true); arrows and swipe always move. A **"Today"**
  chip appears in the header when the shown month isn't today's month and jumps back (month + selection = today).
  Future days show no items; their card reads "Not planned yet." and has no button unless the day is plannable.
  Months with no rows read nothing from the DB beyond `listDays` for that range.
- **Confirm the day start.** `DayStartScreen`: tapping an hour only selects it (a draft). A preview line shows what will
  happen ("Today still ends at 4:00 AM. From tomorrow, each day ends at 6:00 AM.") and a primary button
  **"Start my days at 6:00 AM"** saves via `setDayStart` (submit guard), then shows a short "Saved" state. If the draft
  equals the saved hour the button is disabled. Leaving without confirming changes nothing.

## Chunks 7–8 · Plan ahead with drafts (user request 2026-10-30, ADR-010)

### Chunk 7 · Draft plans: data + domain + state
- Schema: `days.planDraftedAt integer` (nullable) via a new Drizzle migration (`npm run db:generate`; commit the
  generated folder + `migrations.js` update the same way as the first migration). Mapper/`Day` type gain `planDraftedAt`.
- Domain `plan.ts`:
  - `draftableDays(todayKey)`: a day is draftable when `dayKey > tomorrow` (and ≤ today + 365). Tomorrow/today keep
    `plannableDays` (ADR-009). A drafted day that becomes tomorrow is plannable as usual.
  - `buildPlan`: a day with `planDraftedAt` set and `planConfirmedAt` null is shown like a confirmed plan: its day_tasks
    are the ticked rows (reason 'saved'/'forwarded'), library tasks not in it are unticked/Not on. No defaults re-added.
  - `rollover`: today's prefill does NOT run when today has `planDraftedAt` (the draft is the starting plan).
- Repo `days.ts`: `saveDraftPlan(db, { dayKey, dayStartHour, result, now, newId })` — replaces that day's day_tasks with
  the draft's rows (future day: no sessions can exist; assert none), creates the row if missing, sets `planDraftedAt`
  = now, leaves `planConfirmedAt` null. `discardDraft(db, dayKey)` deletes its day_tasks and clears `planDraftedAt`
  (deletes the row if it has nothing else). Both in one transaction.
- State: `saveDayDraft(dayKey, draft)` (ValidationError unless draftable), `discardDayDraft(dayKey)`; existing
  `confirmDayPlan` unchanged (finalizing = confirming a drafted tomorrow; keeps `planDraftedAt` as history).
  `useDayCard` gains `drafted: boolean`, `draftCount: number`, `canDraft: boolean`; `CalendarCell` gains `drafted`.
  `usePlanDraft(dayKey)` works for draftable days too (mode `'draft' | 'plan'`).
- Glow, chain, collection, stats: unchanged — they only look at `planConfirmedAt`/completions, so drafts never count.

### Chunk 8 · Draft plans: screens + ui
- Calendar `DayCard` for a later day: no draft → line "Not planned yet." + button **"Plan ahead"**; draft → line
  "Draft: 3 tasks. Finalize it the evening before." + **"Edit draft"**. Tomorrow with an unfinalized draft → line
  "Draft ready: 3 tasks. Finalize it tonight." + **"Finalize"** (opens the normal Plan screen). `MonthGrid` shows a small
  outline dot (not a marble) on drafted days; a11y "draft plan".
- Plan screen in draft mode (`/plan/[dayKey]` for a draftable day): title "Plan ahead · <Tuesday, 4 November>", the same
  groups/rows/editor/one-off, footer button **"Save draft"** (submit guard) → back to Calendar (`router.back()`), and
  a quiet **"Discard draft"** with ConfirmBox when a draft exists. No Planned screen, no marble drop.
- `dayCardLine` gains the draft lines above. Never says "planned" for a draft.
