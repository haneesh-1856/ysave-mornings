# M12 chunk 2 · Monthly goal setting

**What it is for:** the app stored `monthlyGoalHours` but had no way to set it. This chunk adds the setting so the
Monthly goal moment can play with a goal (it played only as the month in review before).

**Connections now:** `setMonthlyGoal` (`src/state/actions/settings.ts`, validates 1-744 whole hours or none,
`bump('settings')`, never touches markers), `useMonthlyGoal` hook, `MonthlyGoalScreen`, route
`src/app/settings/monthly-goal.tsx`, Profile row "Monthly goal" (`40 h` / `None`), `TextField` gained optional
`keyboardType`, `inputMode`, `returnKeyType`, `onSubmitEditing`, `hideCounter` (existing callers unchanged).
**Future connections:** M13 puts the moments on/off switch near it; the month moment reads the goal at each close.

## Build (Sonnet), built in parallel with chunk 1
Presets 10/20/40/60/80/100 h, "No goal", and a number field for any whole value; nothing saves until Save.

## Check A (code, Sonnet): PASS with minor findings
## Check B (data path + UX, Sonnet): data path correct in all 5 cases (goal met, set after celebrated: no replay,
cleared mid-month: review on the last day, raised mid-month: plays when reached, Profile shows the value)
Applied: a cleared field selects nothing ("Choose a goal"), invalid input reads "Save goal" (never "no goal"), labels
"Set goal to N hours" / "Remove goal", number pad with Done submitting, counter hidden, Save pinned in the screen's
footer above the keyboard, spoken labels "N hours", a neutral line that a goal already passed plays at the next close,
tests for each. Not changed: `app.json` (Android keyboard mode left at its default).

## Phone check (user)
Profile -> Monthly goal: pick or type a goal, Save; on a small phone Save stays visible with the keyboard open.
