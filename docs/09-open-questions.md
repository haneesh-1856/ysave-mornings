# 09 · Open questions

Each one has the **assumption we're building with** so work isn't blocked. Changing an answer later
should be a small, local change, which is why each assumption is chosen to be easy to swap out.

## Answered (2026-10-27)

| # | Question | Answer |
|---|---|---|
| 1 | What does "default task" mean? | Pre-ticked in the plan on its repeat days |
| 5 | When does a day begin? | Custom hour, default 4:00 AM |
| 6 | Auto-close? | Yes, at the next day start; unticked checklist tasks are let go |
| — | Stack | Expo + React Native + TypeScript |

## Still open

| # | Question | Building with |
|---|---|---|
| 2 | A per-day log ("what I did today") in addition to the per-task note? | **No** in v1. The schema can add `days.log` later without touching anything else |
| 3 | Which "task done" celebration (picker section *celebrate*, A–H)? | The collection arrival animation + "Done for today" text + success haptic (as in the style lab) |
| 4 | How does a default task look in lists? | Subtitle text "· default" (Topics) and pre-ticked box (Plan); no extra badge |
| 7 | Notifications? | **None** in v1. Strong candidate for first add: a single local "time's up" when a timed task hits 0 while the phone is locked. That needs the notification permission, so it's your call |
| 8 | First-run experience? | 4 short steps: welcome → day-start hour → first topic → first task → plan today |
| 9 | Was there a "point 2" after "while editing the task options, it's not scrolling"? | Unknown. The scroll bug itself won't exist in the native build (task back is in a ScrollView) |
| 10 | *New:* a day starts with no plan (you didn't plan last night). What then? | Today is pre-filled from your default repeating tasks, **without** the planning marble, with a gentle "Plan today" to edit |
| 11 | *New:* can a timed task run past its day boundary (e.g. 3:50 → 4:10 AM with a 4 AM start)? | No. The session stops at the boundary and counts for the old day |
| 12 | *New:* may a finished timed task be started again the same day for more time? | No (matches the prototype: done is done; overtime is how you add more) |
