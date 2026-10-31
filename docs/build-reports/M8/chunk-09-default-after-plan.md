# Chunk 9 · Default changes after planning

## What it is for
Phone check (2026-10-31): tomorrow was planned and confirmed, then a new default task B (all 7 days) was created; reopening Plan(tomorrow) showed B unticked. Now a default turned on after a day's plan was confirmed or drafted shows ticked when the plan is reopened (it joins on Confirm), and a default turned off after shows unticked (it is left out on Confirm). Nothing is written until Confirm.

## Connections
- Contract: `contract.md` section "Chunk 9". ADR-009 (editable plans), ADR-010 (drafts), doc 04 section 2.
- Data: `tasks.defaultChangedAt` -> `Task.defaultChangedAt` -> `buildPlan`. Confirm (`confirmPlan`) and Today's tomorrow list are unchanged.

## Files
- `src/data/schema.ts` (new column), `src/data/migrations/20261031072225_chemical_archangel/` (migration.sql + snapshot.json), `src/data/migrations/migrations.js` (registered by `npm run db:generate`).
- `src/domain/types.ts` (Task field), `src/data/repos/mappers.ts`, `src/data/repos/tasks.ts` (create/update), `src/domain/plan.ts` (buildPlan).
- Tests: `src/domain/__tests__/plan.test.ts` (new describe, fixtures), `rollover.test.ts`, `stats.test.ts` (fixture field), `src/data/__tests__/tasks.test.ts`, `migrations.test.ts`, `schema.test.ts` (column list), new `src/state/__tests__/defaultAfterPlan.test.ts`, new `src/screens/__tests__/defaultAfterPlan.test.tsx`.

## Build
- Schema: `tasks.defaultChangedAt integer NULL` (epoch ms). Migration generated with `drizzle-kit generate` (`ALTER TABLE tasks ADD defaultChangedAt integer`). Existing rows are NULL = "no change after any plan".
- Set on create only when `isDefault` is true (a non-default create has no default event; turning it on later stamps it). On update it is stamped only when `isDefault` actually differs from the stored value, so saving the editor with the switch untouched, or editing name/minutes/note, never moves a tick.
- buildPlan: `planAt = planConfirmedAt ?? planDraftedAt`; "changed after" = `defaultChangedAt > planAt` (strict, so same-instant counts as before). (a) confirmed/drafted day, library task not in the plan, repeats that day, isDefault, changed after -> ticked, reason 'default'. (b) existing non-forwarded row whose task is now non-default, changed after, row not completed -> unticked. Not-repeating tasks stay in "Not on" unticked. Forwarded and completed rows stay ticked.
- Confirm already deletes unticked rows unless they have a session or completedAt; verified by test (C gone, started/finished kept). Today tab reads stored rows only (verified: B absent until Confirm).
- Known limitation: re-confirming does not move planConfirmedAt (it keeps its first value, ADR-009). So if the user unticks a newly-defaulted B and confirms again, B will show ticked again on the next reopen. Fixing needs a "last confirmed" stamp on days; not in the contract.

## Reproduction
Written first against the rule, then confirmed failing with the rule disabled (`defaultChangedAfterPlan` forced false): 10 tests failed - screen: user's path (B ticked), reverse (C unticked, gone after Confirm); state: B created default, default turned on later, C turned off, drafted day; domain: 4 new buildPlan/confirm cases. Guard tests (unticked default stays, ticked non-default stays, edits don't move ticks, not-on-day, finished rows) pass both before and after, as intended. All pass with the rule.

## Outputs
- `npx tsc --noEmit` clean; `npm run lint` clean (0 problems); full `npx jest --silent`: 79 suites, 951 tests pass; src/domain 100% line coverage (plan.ts 100% all columns).
- Migration tests: fresh db has the column; db at the previous version upgrades with the old task row reading NULL.

## Errors
- Heredoc/encoding slips while writing tests (fixed). Schema test column list needed `defaultChangedAt`. No product errors.

## Check


## Check (independent)
Verdict: FAIL (1 error; everything else verified).

Errors
1. Re-confirm loses the user's choice (contract guard "choices made at/before confirmation win"; lead ruling: the "known limitation" is an error). Path: plan confirmed at T1; B created default at T2 > T1; reopen shows B ticked; user unticks B and confirms again; `confirmPlan` keeps planConfirmedAt = T1 (days.ts:141, `isNull` guard), so on the next reopen defaultChangedAt T2 > T1 and B shows ticked again.
   Fix proposal: do NOT move planConfirmedAt (it is read by Planned/"planned" status in PlannedScreen, TodayScreen, useDayCard, useMorning, domain/collection.ts "at" for chain/calendar, and days.ts set-once semantics). Add a nullable `days.planUpdatedAt integer` (new drizzle migration, ALTER TABLE days ADD planUpdatedAt integer; NULL for old rows), stamped with the injected `now` on every confirm (including re-confirm, via confirmPlan/days repo) and every draft save (saveDraft; it already refreshes planDraftedAt), add to Day type + mapper + schema/migration tests. In buildPlan use `planAt = day.planUpdatedAt ?? day.planConfirmedAt ?? day.planDraftedAt`. Add tests: untick newly-defaulted B, re-confirm, reopen -> stays unticked (state + screen); reverse (C default off, user ticks C back, re-confirm, reopen -> stays ticked); a default changed after the re-confirm still moves the tick. Also check rollover.ts day-creation literals and test fixtures that build Day objects.

Verified OK
- Migration: `ALTER TABLE tasks ADD defaultChangedAt integer;` additive nullable, valid for expo-sqlite, registered in migrations.js; snapshot has the column and prevIds chains to the previous snapshot id; folder-based drizzle (no journal file); fresh and upgraded-db tests exist; no data loss.
- Stamping: create stamps `now` only when default; update stamps only when isDefault actually differs from the stored value; uses injected `now`.
- buildPlan: both directions, drafted days, non-repeating (stays Not on), forwarded/completed rows stay ticked, strict `>` so equal timestamps count as before. Tests include user's exact path at repo/state and screen level, plus reverse and guards.
- Layering and style fine, no `any`.
- Draft days are fine (saveDraft refreshes planDraftedAt each save); only confirmed days are affected by error 1.

Outputs: `npx tsc --noEmit` clean; `npm run lint` clean; full `npx jest --silent`: 79 suites, 951 tests passed, no failures.

## Fix (Opus)
Error 1 (re-confirm loses the user's choice) fixed as the checker proposed; planConfirmedAt semantics unchanged.

- Migration: `src/data/migrations/20261031072849_purple_dragon_lord/` (`ALTER TABLE days ADD planUpdatedAt integer;` + snapshot), generated with `npx drizzle-kit generate`, registered in `migrations.js` as m0003. Old rows read NULL.
- Schema: `days.planUpdatedAt integer` (nullable, epoch ms). `Day.planUpdatedAt: Epoch | null` in `src/domain/types.ts`; `toDay` mapper.
- Writes (`src/data/repos/days.ts`): the days-row insert sets it null; `saveConfirmedPlan` sets `planUpdatedAt = now` on every confirm (first and re-confirm; planConfirmedAt still set only when null); `saveDraftPlan` sets it with planDraftedAt on every save.
- `buildPlan`: `planAt = planUpdatedAt ?? planConfirmedAt ?? planDraftedAt` (comment updated). `rollover.ts` Day literals get `planUpdatedAt: null`.
- Tests: schema column list; migrations: fresh db has `days.planUpdatedAt`, a new upgrade test from the chunk 9 version (old day row reads NULL, other columns kept); the chunk 9 upgrade test now copies migrations by name (before chemical_archangel) instead of `slice(0, -1)`. Day fixtures/literals updated in data, domain, state and screen tests (days.test expects planUpdatedAt = confirm/draft time). New: domain buildPlan precedence case (re-confirm wins both directions; a change after it still moves the tick); state: B unticked + re-confirm stays unticked (and planConfirmedAt unchanged, planUpdatedAt = now), C ticked back + re-confirm stays ticked, default change after re-confirm moves the tick, re-saved draft; screen: same B path (plus a later default change moving it again) and the C path.
- Reproduction: with planAt reverted to the old expression, 4 new tests fail (state B, state C, screen B, screen C); all pass with the fix.

Outputs: `npx tsc --noEmit` clean; `npm run lint` clean; full `npx jest --silent`: 79 suites, 959 tests passed, 0 failures. src/domain line coverage 100% (only gap is a pre-existing statement/branch in dayKey.ts:89, untouched).

## Re-check
Verdict: PASS.

Errors: none.

Verified
- Migrations: HEAD's last is useful_red_skull; chemical_archangel (tasks.defaultChangedAt) and purple_dragon_lord (`ALTER TABLE days ADD planUpdatedAt integer`) are additive nullable, registered in order in migrations.js. Tests cover a fresh db (both columns) and upgrades (tasks upgrade copies by name before chemical_archangel; days upgrade before purple_dragon_lord: planConfirmedAt 5 and planDraftedAt 3 kept, planUpdatedAt NULL). No data loss.
- planConfirmedAt semantics unchanged: still set only when null (isNull guard); planUpdatedAt is a separate stamp on every confirm and every draft save; only buildPlan reads it (`planUpdatedAt ?? planConfirmedAt ?? planDraftedAt`). Mapper, schema, types and rollover.ts literals updated.
- Behaviour tests (state and screen): untick B then re-confirm stays unticked; tick C back then re-confirm stays ticked; a later default change moves the tick; a re-saved draft counts. The original forward and reverse paths still pass. The builder showed 4 new tests fail with planAt reverted.
- Layering fine, no `any`.

Outputs
- `npx tsc --noEmit`: clean. `npm run lint`: clean.
- Full `npx jest --silent`: 79 suites, 959 tests passed, 0 failures.
- src/domain coverage: 100% lines (plan.ts and rollover.ts 100% all columns).
