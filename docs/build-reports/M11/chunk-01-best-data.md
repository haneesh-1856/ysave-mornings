# M11 chunk 1 · Best data

**What it is for:** the Personal best skyline needs the real focus of the 13 days before today. The best moment gains
`recentMs` (13 entries, oldest first, index 12 = yesterday, 0 where none) and the input now carries the per-day map.

**Connections now:** `MomentsInput.earlierFocusByDay: Record<DayKey, number>` (replaces `earlierDayFocusMs`), filled
straight from `focusTotalsByDay` in `src/state/moments.ts`; `BEST_RECENT_DAYS = 13`. The best rule is unchanged.
**Future connections:** chunk 2 (`bestDraw` columns from `recentMs`, the glass at `previousBestMs`, today's column at
`todayMs`).

## Build (Sonnet)
- Domain: all fixtures migrated to the keyed map (meaning of every old case preserved, checked against `git diff`);
  tests for placement at both window edges, order, missing days 0, every bar `<= previousBestMs` (recent best, marker
  best, best older than 13 days), exact array with a marker best.
- `src/state/__tests__/bestData.test.ts` (real actions, across DST): history 10-12 .. 11-02 with gaps and a
  checklist-only day; A: 11-03 110 min running at close, previous best 100 from 10-12 (outside the window), recentMs
  `[8,0,0,30,45,0,10,0,60,5,25,15,40]`; B: a tie plays nothing; C: 11-04 110 beats 100; D: 11-05 120 beats 110.
  A second case pins a forwarded task (focus stays on its day), a soft-deleted task (its sessions still count) and a
  day auto-closed with a session running (ends at day end: 360 min, unchanged at a later close).

## Check A (code, Sonnet): PASS
Mutations (window off by one, reversed, anchored wrong, clamped to the marker, invented fill, dropped guard) all fail
a test. Notes applied: exact array for the marker case, a comment on day order. Reminder for chunk 2: ui fixtures use
`recentMs: []`; replace with 13 real-shaped values.

## Check B (data audit, Sonnet): PASS
Earlier days (SQL) and today (`focusedMs`) use the same formula; `at` never reaches an open session after
`closeToday`; forwarded, deleted, auto-closed and pre-day-start sessions all traced. All four cases recomputed by hand,
all match. `markers.bestMs` can only exceed stored data after an outside edit; kept (it is the no-replay marker).

## Lead verification
tsc clean, lint clean, `Test Suites: 101 passed, 101 total`, `Tests: 1242 passed, 1242 total`. No temp files.
