# 03 · Data model (SQLite)

All ids are UUID v4 strings. Times are **epoch milliseconds (UTC)**. A "day" is identified by
`dayKey`, a local calendar date string `YYYY-MM-DD` computed with the day-start hour ([04](04-domain-rules.md#1-day-boundary)).
Every table has `createdAt`, `updatedAt`. Library tables also have `deletedAt` (soft delete).

## Library: what you *normally* do

### `topics`
| column | type | notes |
|---|---|---|
| id | text PK | |
| name | text | 1–24 chars, trimmed |
| colorKey | text | `study` \| `health` \| `home` \| `sun` \| `c4` \| `c5` (resolved by the palette); `none` only for the built-in No topic (muted ink) |
| sortOrder | integer | |
| isOpen | integer (bool) | fold state on the Topics tab |
| deletedAt | integer null | removing a topic soft-deletes it and its tasks |

**No topic (ADR-012).** One built-in row, `id = 'no-topic'` (`NO_TOPIC_ID`), name "No topic", colorKey `none`, `sortOrder` 1000000 (after every user topic; user topics number from 0), open. Inserted with `INSERT OR IGNORE` by migration `20261031212212_no_topic`, so a fresh install and an upgrade both end with exactly one. It holds tasks (and day rows) that have no topic, which keeps `tasks.topicId` and `day_tasks.topicId` NOT NULL. The repo refuses to rename, recolour, reorder or delete it (`ValidationError`); `listTopics` includes it, `listUserTopics` does not.

### `tasks`
| column | type | notes |
|---|---|---|
| id | text PK | |
| topicId | text FK → topics | |
| name | text | 1–40 chars; a task never named is discarded when the card closes |
| kind | text | `timed` \| `check` |
| minutes | integer | 5–180, step 5. Kept for `check` too (ignored) so switching kind back restores it |
| repeatMask | integer | 7 bits, **bit 0 = Monday … bit 6 = Sunday**. 0 = no repeat days |
| isDefault | integer (bool) | pre-ticked in plans on repeat days |
| cue | text null | one of the preset cues |
| treat | text null | one of the preset treats |
| note | text | persistent note, '' if none |
| sortOrder | integer | |
| deletedAt | integer null | |

## History: what a specific day *was*

### `days`
| column | type | notes |
|---|---|---|
| dayKey | text PK | `YYYY-MM-DD` |
| planConfirmedAt | integer null | set when "looks like this ✓" was pressed → planning marble exists |
| planDraftedAt | integer null | set when a draft plan is saved for a later day (ADR-010); a draft is not a plan: no planning marble. Kept after the plan is confirmed, as history |
| closedAt | integer null | |
| closedBy | text null | `user` \| `auto` |
| dayStartHour | integer | snapshot of the setting this day used (history doesn't shift if the setting changes) |

A `days` row is created when a plan is confirmed, at rollover for an unplanned day, or when a checklist
task is moved into a day that has no row yet (then `planConfirmedAt` stays null, and the forwarded
`day_tasks` row waits there for planning).

### `day_tasks`: snapshot of a task in one day's plan
| column | type | notes |
|---|---|---|
| id | text PK | |
| dayKey | text FK → days | |
| taskId | text null FK → tasks | null for one-off tasks |
| topicId | text | |
| name | text | **snapshot** (renaming the library task doesn't rewrite history) |
| colorKey | text | **snapshot** of the topic color → past marbles keep their color |
| kind | text | `timed` \| `check` |
| budgetSec | integer | planned minutes × 60 for this day (0 for check) |
| cue, treat | text null | per-day values |
| note | text null | this day's note for the row (ADR-011), max 1000 characters; blank is stored as null. Separate from `tasks.note`, never copied to or from it. Travels with a moved task |
| forwardedFromDayKey | text null | set on checklist tasks moved from the previous day |
| completedAt | integer null | timed: moment remaining hit 0. check: moment ticked |
| closeOutcome | text null | for an unticked check at close: `moved` \| `let_go` |
| sortOrder | integer | |

Unique: (`dayKey`, `taskId`) where `taskId` is not null.

### `sessions`: focus time for timed tasks
| column | type | notes |
|---|---|---|
| id | text PK | |
| dayTaskId | text FK → day_tasks | |
| startedAt | integer | |
| endedAt | integer null | null = running now |

**Invariant:** at most **one** session in the whole database has `endedAt IS NULL` (enforced in the
action and by a partial unique index `ON sessions(endedAt IS NULL) WHERE endedAt IS NULL`).

### `settings`: key/value
| key | value |
|---|---|
| `dayStartHour` | integer 0–23, default 4 |
| `look` | JSON of the look mix ([06](06-design-system.md#the-look-mix)) |
| `sounds` | bool, default true |
| `onboardedAt` | epoch ms or null |
| `schemaVersion` | managed by migrations |

## Derived, not stored

These are computed by domain functions from the tables above, so they can never drift out of sync:

- **Focused seconds** of a day task = Σ(session.endedAt ?? now − startedAt).
- **Overtime** = max(0, focused − budget).
- **Collection items** of a day = planning marble (if `planConfirmedAt`) + one item per completed
  day task, ordered by `completedAt` ([04 §7](04-domain-rules.md#7-collection-items)).
- **Glow**, **chain**, **profile stats**, **weekly time per topic**, **this week's marble dots**.

## Migrations

Drizzle Kit generates SQL migrations into `src/data/migrations/`, and they run at startup before any screen
renders. Migrations are append-only. Never edit one that has shipped.
