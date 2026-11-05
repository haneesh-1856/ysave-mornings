# M12 chunk 1 · Month data

**What it is for:** the month climb needs the real focus of each day of the month. The month moment gains `dailyMs`
(1st..today, 0 where none); `monthFocusMs` is now its sum and `daysShowedUp` counts the same filtered days.

**Connections now:** `src/domain/moments.ts` month branch (keys `YYYY-MM-01`..today built from strings, no Date maths;
bundles filtered to them, the M9 lesson). Input unchanged (`monthBundles` from `src/state/moments.ts`).
**Future connections:** chunk 3 (`monthDraw` curtain from the cumulative `dailyMs`).

## Build (Sonnet), built in parallel with chunk 2
- Domain tests: length = day of month, order, missing days 0, out of order, other-month bundles ignored, Feb 2027 (28)
  and Feb 2028 (29).
- `src/state/__tests__/monthData.test.ts` (real actions): goal 2 h reached Oct 12 (130 min, entries 20/50/60 at
  idx 0/7/11, days 4, Oct 13 plays nothing); no-goal October closed on the 31st (35 min, 31 entries); November across
  DST (67 min, 30 entries; the Oct 31 session auto-closed at Nov 1 04:00, 300 min, asserted on October's day).
- Ui fixtures: one `DAILY` array per file, `monthFocusMs` = its sum.

## Check A (code, Sonnet): PASS + 1 required fix (ui fixtures did not sum), applied
## Check B (data audit, Sonnet): PASS
All cases recomputed by hand; passes under `TZ=America/New_York` and `TZ=America/Chicago`. Probes: a task forwarded
Oct 31 -> Nov 1 (each month gets its own day's focus), Feb 2027 (28 entries) also a Sunday (week and month agree on the
shared days), a goal reached exactly plays.
