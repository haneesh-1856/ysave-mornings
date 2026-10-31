# 04 · Domain rules

Every rule here is a pure function in `src/domain/` with unit tests. Each function receives `now` as a
parameter and never reads the clock itself.

## 1. Day boundary

- Setting `dayStartHour` (H), default **4** (4:00 AM), range 0–23.
- `dayKeyOf(instant, H)` = the instant's local calendar date, or the day before if the instant is
  earlier than that date's `dayStartOf`. This is "instant − H hours" in wall-clock terms. Subtracting
  absolute hours (`subHours`) would be off by an hour on DST days, so it isn't used.
  - H = 4: Tue 02:30 → Monday; Tue 04:00 → Tuesday.
- `dayStartOf(dayKey, H)` = local `dayKey` at H:00; `dayEndOf` = the next day's start.
- Changing H takes effect from the **next** day. Each day's own H is snapshotted in `days.dayStartHour`.

## 2. Plan generation (what the Plan screen shows)

Input: library (topics + tasks, not deleted, named), target `dayKey`, existing `day_tasks` for that day
(if a plan was already confirmed), and the previous day's forwarded checklist tasks.

Rows, grouped by topic in library order:

| Library task | Shown in | Pre-ticked? |
|---|---|---|
| Repeats on target weekday, `isDefault` | topic group | **yes** (subtitle "default") |
| Repeats on target weekday, not default | topic group | no ("repeats <Fri> · not a default") |
| Doesn't repeat that weekday | "Not on <Fridays>" group | no (you can add it once) |
| Forwarded checklist task from the previous day | its topic group | **yes** ("from <Thursday>") |
| One-off task added in planning | its topic group ("No topic" unless one is picked) | yes ("just for <Friday>") |

- If the day already has a confirmed plan, its saved rows (with their per-day minutes/cue/treat) are
  the starting state, and library tasks not in it appear unticked.
- Per-day edits (minutes ±5 within 5–180, cue, treat, **note**) change only the plan row, never the library.
- **Notes (ADR-011).** Two kinds. The library task's `note` is the *general* note for the task, edited in the Library
  task editor. A day row's `note` is *that day's* note: in a plan it says what to do on that day, on Today it can be
  an action to take on the task. A note typed in Plan (today, tomorrow or a later draft) or on Today is a day note
  and is **never** copied to the library; the library note is never copied into a day note. Every row can have one,
  including one-offs. Plan shows the library note read-only above the field ("Library note: ..."). A day note is
  saved with the draft or Confirm like cue/treat, and editable on a stored row while its day is open. **It travels
  with a moved task**: closeByHand copies it to the new next-day row, or fills an existing next-day row that has no
  note (a note already there is kept).
- Unconfirmed edits live in memory only. Leaving the screen discards them.
- **Confirm** is enabled when ≥1 row is ticked. It replaces that day's `day_tasks` with the ticked rows,
  keeping any rows that already have sessions or `completedAt`, and sets `planConfirmedAt` if empty.
- Which day you can plan: **tomorrow** always. **Today** while it's open (not closed), including after its plan
  was confirmed: re-confirming keeps every row that has sessions or `completedAt`, and `planConfirmedAt` keeps its
  first value. Never a past day. *(Changed 2026-10-29, ADR-009; before, today was plannable only until confirmed.)*
- **Draftable days (ADR-010).** Any day after tomorrow, up to a year ahead, can hold a *draft plan*: the same rows,
  saved without `planConfirmedAt` (the day stores `planDraftedAt`). A draft is not a plan: no planning marble, the
  day never counts as planned, and glow, chain and stats ignore it. Once the day is tomorrow, confirming it
  finalizes the plan as usual. A draft day that arrives as today unfinalized is not topped up with defaults (§3):
  the draft is its starting plan, and the day counts as unplanned.

## 3. Unplanned day

At rollover into a day with no confirmed plan, the app creates the day with its default
repeating tasks pre-filled (the same rows Confirm would save with no edits) but **no planning marble**.
Today shows a gentle "Plan today" entry for edits. *(Assumption: see [09](09-open-questions.md) Q10.)*

## 4. Timer (timed tasks)

States of a day task: `idle → running ⇄ paused → done(running overtime | stopped)`.

- `focused(sessions, now)` = Σ (endedAt ?? now) − startedAt.
- `remaining = budgetSec − focused` (can go negative internally; the UI shows `max(0, …)`).
- **Start/Resume**: create a session. If another session is open anywhere, close it first at `now`
  (one task runs at a time; starting B pauses A).
- **Pause**: set `endedAt = now`.
- **Leaving the Run screen does not pause.** Only Pause/Stop do.
- **Completion**: the first moment `focused = budgetSec`. `completionTime()` walks the sessions to find
  that exact instant. `completedAt` is set to it, even if it's detected later (app was killed).
- **Overtime**: after completion the open session keeps running. The UI shows "+N min extra".
- **Stop** (only shown once done): closes the session. A done task can't be started again that day.
- **Gold ring**: overtime ≥ **60 s** when the session stops.
- **Day boundary**: an open session is closed at `dayEndOf(itsDay)` by rollover. Time never leaks
  into the next day.
- Display rounding: minutes left = `ceil(remaining / 60)`; extra = `floor(overtime / 60)`.

## 5. Checklist tasks

- "Mark done" (on the task page) sets `completedAt = now`; "Mark not done" clears it (only while the day is open). Today has no tick boxes.
- No timer, no overtime. Its collection item is **small**.

## 6. Closing a day

**By hand** (Close screen → "Close the jar"):
1. Every unticked checklist task must have an outcome: `Move to <next day>` or `Let it go`
   (default selection: none; "Close the jar" asks for the missing choices).
2. Close any open session at `now`.
3. Set `closedAt = now`, `closedBy = user`.
4. Each `moved` task becomes a pre-ticked row in the next day's plan (`forwardedFromDayKey` set). If
   the next day's plan is already confirmed, the row is added to it directly.
- **Timed tasks are never forwarded.** A forwarded task counts as **not done** for the day it left.
- After closing: Today is read-only, and the button becomes "Plan tomorrow".

**Auto-close** (rollover): runs on app start and every foreground, for each past `days` row with
`closedAt` null:
1. Close an open session at that day's end.
2. Reconcile completions (timed tasks that hit 0 before the end).
3. Unticked checklist tasks → `let_go`.
4. `closedAt = dayEndOf(day)`, `closedBy = auto`.
Then ensure today's `days` row exists (§3) and show the Morning screen once.

## 7. Collection items

Items for a day, in order:
1. The **planning marble** (color `sun`) if `planConfirmedAt` is set.
2. One item per completed day task, ordered by `completedAt`: color = snapshot `colorKey`,
   `small` if checklist, `gold` if timed with overtime ≥ 60 s.

The item list is look-independent. Each of the 12 renderers just draws the same list differently.
The lid/closed decoration shows when `closedAt` is set.

## 8. Calendar glow

A day **glows** when it's closed or past, has ≥1 planned task, and **every** `day_task` has
`completedAt`. Deselected tasks were never in the plan, so they don't count. A moved task has no
`completedAt` → no glow. Days with no plan look normal. Nothing is ever shown as "failed".

## 9. Soft chain (top of Today/Morning)

The last 8 days up to today, one link each:
- **solid**: the day had a planning marble or ≥1 completed task
- **dashed (rest)**: no plan and nothing done
- **today**: highlighted in `sun`
A gap is just a dashed link. There is no streak counter and no "broken" state.

## 10. Stats

- **Day number** ("Day 8") = days since first `days` row, inclusive.
- **Days you showed up** = days with ≥1 collection item.
- **Focused hours** = Σ focused across all days.
- **Marbles** = Σ collection items across all days.
- **Topic weekly time** (Topics tab) = Σ over timed tasks of `minutes × repeat days per week`.
- **This week's dots** = the topic's completed items in the current Mon–Sun week (max 6 dots).

## 11. Deleting

- **No topic (ADR-012)** is a normal topic for grouping (Plan, Today, calendar, close summary, stats) so a task never needs a topic. It appears only when it has rows (Library: only while it holds a live task, last in the list), is never counted as one of the user's topics (onboarding, "No topics yet", the Topics header count) and can't be edited or deleted. A task or one-off picks it by default; moving a task between topics (`updateTask` with `topicId`) puts it at the end of the target topic.
- Moving a library task to another topic does not change existing day rows: they keep the topic they were planned with (they're snapshots).

- Deleting a task or topic soft-deletes it from the library. **Past days keep their items**
  (they're snapshots). The confirm text says so.
- If a deleted task is in today's or tomorrow's open plan, its row stays for that day.
