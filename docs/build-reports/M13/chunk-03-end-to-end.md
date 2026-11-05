# M13 chunk 3 · Moments end to end

**What it is for:** closes the end-to-end gaps carried from M8 chunk 19 and proves, with the app's own actions only,
that the moments agree with each other and with what the rest of the app shows.

**Connections now:** `src/state/__tests__/momentsEndToEnd.test.ts` (test code only).

## Build (Sonnet), parallel with chunks 1 and 2
1. Mon 2026-10-12 .. Sun 10-25, every day closed by hand, goal 18 h: the Sunday close returns all six in order:
   longest 200 min; day 2/2; best 200 over 150 with 13 real recent days; streak 14 (7 was celebrated on Oct 18);
   week 10-19: 14 tasks, 750 min, 6 gold rings (Thu exactly 30 min has none), 7 days, `dailyMs`
   [70,150,80,30,100,120,200]; month 2026-10: 1110 min crosses 1080 that day, 14 days, 25 entries. Markers asserted
   before and after.
2. A close by hand at Mon 2026-06-01 01:30 closes day key 05-31 (Sunday and the month's last day): week 05-25 and
   month 2026-05 play, 06-01 stays open and untouched.
3. Moments off: closes play nothing and markers stay; the goal is crossed while off; on again: the next close plays the
   month; the following Sunday plays exactly longest and week.

## Check A (test code, Sonnet): PASS
## Check B (data audit, Sonnet): PASS
Every value recomputed by hand. A probe compared the moments with the app's own selectors (calendar cells, day cards,
Profile stats): all equal. Applied as a permanent cross-check in scenario 1, plus exact Oct 4 kinds and markers,
06-01 untouched, comments on the earlier celebrations.
