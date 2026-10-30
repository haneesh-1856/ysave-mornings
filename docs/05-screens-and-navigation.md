# 05 · Screens & navigation

Sizes in the prototype are drawn for a 300 px-wide mock phone. **On real devices, scale type and
spacing by about ×1.25** (e.g. 13 px body → 16 pt, title 20 → 25 pt), and keep every touch target ≥ 44 pt.

## Map

```
                  ┌──────────── first launch ────────────┐
                  ▼                                      │
             Onboarding ──► Plan(today) ──► Planned ──► Today
                                                         ▲
 new day (first open) ──► Morning ──────────────────────►│
                                                         │
 Tabs:  [Topics]   [Today]   [Calendar]   [Profile]      │
           │          │  │        │            │
           │          │  └─► Close ──► Plan(tomorrow) ──► Planned
           │          └─► Run/[dayTaskId]       ▲
           ├─► Topic new / edit                 │
           │                       Calendar: tap tomorrow → Plan
           │                                    Profile ─► Look · Glass · Day start
```

The tab bar is shown only on the 4 tab screens. All other screens are pushed on the root stack and use
the transition chosen in the look mix ([06](06-design-system.md#motion--transitions)).

## Screens

| Route | Screen | Key content | Exits |
|---|---|---|---|
| `/onboarding` | Onboarding | Welcome → day-start hour → first topic (name + color) → first task → plan today | Plan(today) |
| `/morning` | Morning | Weekday, "Day N", chain, sunrise card "A fresh page", today's first marble (if planned) | "See today's plan" → Today |
| `/(tabs)/topics` | Topics | Fold per topic: name, task count, weekly time, week dots, ⋯ edit. Rows show name, repeat text, kind/minutes, "default". Tap a row → flip card (back side inline, rotateX animation). "+ Add task", "+ New topic" | Topic new/edit |
| `/topic/new`, `/topic/[id]` | Topic edit | Name (max 24), 6 color swatches, live preview fold, remove with confirm | back |
| `/(tabs)/today` | Today | Header "Today · n of m done", chain, topic folds with TaskRow/CheckRow, collection placed by layout (corner / hero / dock), Close button. If the day is closed: read-only + "Plan tomorrow" | Run, Close, Plan |
| `/run/[dayTaskId]` | Run | "‹ Today", state (Running / Paused / Done · still going), name, topic dot, treat tag, note card (tap to edit), big number, countdown bar (seg/smooth/thin), ticks, celebration text, collection after done. Buttons: Pause/Resume, or Stop after done | Today (doesn't pause) |
| `/close` | Close today | Big collection, summary (done · focused · extra), "Not ticked today" with Move/Let go, "Not yet" / "Close the jar" → lid animation → "Plan tomorrow" | Plan(tomorrow), Today |
| `/plan/[dayKey]` | Plan | "Plan <Friday>", topic groups with checkbox rows, expandable editor (minutes stepper, cue, treat, note), "Not on <Fridays>", add one-off (name, topic, Checklist/15/30/45/60/90), bottom: "n tasks · Xh Ym planned", "<Friday> looks like this ✓" | Planned |
| `/planned/[dayKey]` | Planned | Closed jar → new jar, first-marble drop, list of planned tasks, Edit / Done | Plan, Today |
| `/(tabs)/calendar` | Calendar | Month grid (Mon first), mini collection per day, glow, legend, selected day card with stats and a Plan/Edit button for tomorrow, month swipe | Plan |
| `/(tabs)/profile` | Profile | Avatar initial, stats, settings list: My day starts, Look, Glass, Sounds, Reminders (not decided), Friends & teams (coming later) | Look, Glass, Day start |
| `/settings/look` | Look | The mixing desk as in-app settings: palette, font, corners, surface, collection, motion, transition, home layout, bar, tabs; live mini preview; 6 presets | back |
| `/settings/glass` | Glass | Frosted glass on/off, 28 tints grid, 5 blur levels | back |
| `/settings/day-start` | Day start | Hour picker, plain explanation ("A session at 1 AM still counts as yesterday") | back |

## Gestures

- **Tap** a timed task = start/open its Run screen. **Tap** a checklist task = tick/untick.
- Long-press on Today rows is reserved for later (storyboard idea: flip to settings). It isn't in v1.
- Android hardware back = the "‹" back on every pushed screen.
