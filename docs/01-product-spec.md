# 01 · Product spec (v1)

## One line

A time-budgeted to-do app. You plan tomorrow in 2–3 minutes. Each task gets a time budget that
drains as you work, and every finished task adds a piece to the day's collection (a marble in a jar
by default).

## Who it's for

Everyone. There's no target segment (owner decision, 2026-10-14).

## Core concepts

| Concept | Meaning |
|---|---|
| **Topic** | Something you give time to (Study, Health, Home). Has a name and one of 6 colors. |
| **Task** | Belongs to a topic. It's either **Timed** (minutes budget, auto-completes at 0) or **Checklist** (ticked by hand). |
| **Repeat days** | The weekdays (Mon–Sun) a task normally happens. Set on a week ring. |
| **Default task** | A repeating task that is **pre-ticked** in the plan for its repeat days. A non-default repeating task is listed but unticked. |
| **Plan** | The confirmed list of tasks for one day, with per-day minutes, cue and treat. Confirming drops the day's first marble (the planning marble). |
| **Day** | Runs from your day-start hour (default 4:00 AM) to the next. It closes by hand, or automatically at the next day start. |
| **Session** | One stretch of running a timed task. A task's budget can be spread over any number of sessions. |
| **Overtime** | Time you keep running past 0. It's shown as extra minutes. One minute or more gives the marble a gold ring. |
| **Collection** | The picture of the day's finished work. Jar + marbles by default; 12 looks to choose from. |
| **Cue / Treat** | Optional "When" (e.g. After breakfast) and "Treat" (e.g. Podcast) tags on a task. |
| **Note** | One persistent note per library task. It's editable on the task card, while running, and in planning. |
| **Glowing day** | A calendar day where every task kept in that day's plan was completed. |

## v1 scope: in

1. **Topics tab**: fold-out topics; create/edit/remove a topic (name, color, preview, confirm on remove);
   tasks with a flip card (name, week ring, kind, time slider 5–180 min step 5, default switch, cue,
   treat, note, delete with confirm); weekly time per topic; this week's marble dots.
2. **Planning**: plan tomorrow (or today if today has no plan). Repeating tasks are grouped by topic,
   with defaults pre-ticked. The rest go under "Not on <weekday>", where you can add them once.
   Per-day minutes (±5), cue, treat and note. Add a one-off task. One-tap "<Day> looks like this ✓".
   A confirmation screen shows the closed jar → the new jar with its first marble.
3. **Today tab**: tasks by topic. Tap a timed task to run it; tap a checklist task to tick it.
   You see the remaining time, the cue/treat tags, a note preview and the collection.
4. **Run screen**: big minutes-left number, draining bar, pause/resume, back to Today without stopping.
   At 0 the task auto-completes, the celebration plays and the timer keeps counting overtime until you press Stop.
   You can edit the note while it runs.
5. **Close the day**: summary (tasks done, focused time, extra minutes). For each unticked checklist
   task you pick "Move to <tomorrow>" or "Let it go". "Close the jar" plays the lid animation, then leads to Plan tomorrow.
6. **Auto-close** at the next day start if you didn't close the day. Unticked checklist tasks are let go.
7. **Morning screen** the first time you open the app in a new day: "A fresh page", day count, the first marble.
8. **Calendar tab**: the month with a mini collection per day, glowing days, and a day card with stats; tap tomorrow to plan.
9. **Profile tab**: stats (days you showed up, focused hours, marbles), day-start hour, look settings,
   glass picker, sounds on/off.
10. **Look settings**: every style-lab option is selectable by the user (see [06](06-design-system.md)).
11. **Onboarding**: a minimal first run (see [09](09-open-questions.md) Q8 assumption).

## v1 scope: out (later)

Friend teams, group pomodoro, live presence, accounts/sync, reminders/notifications (undecided),
daily log (undecided), data export, widgets, custom cue/treat text (v1 uses preset chips), monetization.

## Non-goals (never)

Judging plans, suggesting tasks, carrying unfinished time forward, policing focus, streak-break
shaming, points/prizes/leaderboards, reading your meetings calendar.
