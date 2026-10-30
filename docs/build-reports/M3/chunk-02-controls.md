# M3 · Chunk 2 · Plan controls

## Build (Sonnet)

### Purpose
Presentational controls for the Plan screen (chunk 4): a checkbox, a minutes stepper, one plan row with an inline editor, a one-off task form, the confirm footer, and locale-aware weekday names. No `src/state` or `src/data` imports; types come from `src/domain` (type-only).

### Files
All in `mobile/src/ui/`:
- `Checkbox.tsx`, `Stepper.tsx`, `PlanRow.tsx`, `OneOffForm.tsx`, `PlanFooter.tsx`, `dayNames.ts`
- Tests in `__tests__/`: `PlanControls.test.tsx` (Checkbox, Stepper, PlanRow, OneOffForm, PlanFooter), `dayNames.test.ts`

### Connections now
Reuses `T`, `Button`, `ChipSet`, `TextField`, `presets` (CUES, TREATS), `formatMinutes`, the theme (`t.c`, `t.topic`, `t.radius`), and `PlanRow`/`ColorKey`/`TaskKind` types from the domain. Tests use `renderThemed`. Nothing else imports the new files yet.

### Future connections
- Chunk 4 Plan screen: composes `PlanRow` groups, `OneOffForm`, `PlanFooter`, and the day-name helpers; wires callbacks to `usePlanDraft`.
- M4 Today rows: reuse `Checkbox` for checklist ticking.
- M6 day-start / Calendar: reuse `dayNames`.

### Decisions
- Props are exactly the contract's. `OneOffForm` exports the `OneOffRow` type (`{ topicId, name, kind, minutes }`).
- Checklist one-offs return `kind: 'check', minutes: 15`, the same fallback the domain uses for check rows (`FALLBACK_MINUTES`), because the minutes are unused for checklists.
- `OneOffForm` has no preselected topic, so Add stays disabled until the user picks one (name trimmed, non-empty). Length defaults to 30; tapping the selected length chip does not clear it.
- `PlanRow` ticking (`Checkbox`, "Include <name>") and expanding (name area, "Edit <name> for <dayName>", `expanded` state) are separate touch targets. Timed rows also show minutes on the right, except `saved` rows (the subtitle already is the minutes; `saved` check rows say "checklist").
- `PlanRow` derives "Fri" as `dayName.slice(0, 3)` and "Fridays" as `dayName + 's'` from the `dayName` prop (English copy). "from <Thursday>" uses `weekdayName(forwardedFromDayKey)`.
- `Stepper` gives 44 pt −/+ buttons ("Decrease/Increase <label>", disabled at the bounds) and an adjustable value element with increment/decrement accessibility actions. Unit "min" renders via `formatMinutes`. `PlanRow` maps `onChange(v)` to `onStep(+5 | -5)`.
- `dayNames` parses the key as a local date at noon (no UTC shift, DST-safe). The locale param defaults to the device locale; tests pass 'en-US'.
- `PlanFooter` summary: "n task(s) · <formatMinutes> planned" (singular "1 task"). The button is "<dayName> looks like this ✓", disabled when `!canConfirm || busy`.

### Command outputs
From `mobile/`:
- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npx jest src/ui/__tests__/PlanControls src/ui/__tests__/dayNames`: 2 suites, 24 tests passed.
- `npm test` (whole repo, chunk 1/3 in progress): 34 suites, 344 tests; failures only in `src/state/__tests__/plan.test.ts` and `src/ui/collection/__tests__/Jar.test.tsx` (parallel builders' unfinished files). A first run showed 28 failures there, a later run 1; none in chunk 2 files.
- `npm run test:coverage`: ran with the same non-chunk-2 failure; `mobile/coverage` deleted afterwards.

### Known limitations
- Subtitle copy is English and assumes `dayName` begins with a 3-letter English abbreviation; localizing is M7.
- Visuals are not checked against the style-lab prototype pixel by pixel (no device run); the topic color shows only in the one-off picker dot, since topic group headers belong to chunk 4.
- Expand/collapse has no animation yet.

## Check (Sonnet)

**Verdict: FAIL** (one real, small defect; everything else matches the contract).

### ERRORS
1. `mobile/src/ui/PlanRow.tsx:38-40` (also `PlanFooter` is fine). Expected: day forms come from `dayNames` (contract: Intl-based `shortWeekday`/`weekdayPlural`). Actual: `dayName.slice(0, 3)` and `` `${dayName}s` `` are re-derived by string slicing, duplicating `dayNames.ts`. They are only right for English names (a locale with a different abbreviation or plural rule gives wrong copy, and slicing can cut a non-BMP/combined character). Meanwhile the `forwarded` subtitle in the same function calls `weekdayName(...)` with the device locale, so the row mixes two sources. Fix: keep `dayName` (needed for "just for <Friday>" and the a11y label) and add two required props `dayShort: string` and `dayPlural: string`; subtitles become `repeats ${dayShort} · not a default` and `not on ${dayPlural} · add once`. Chunk 4 passes `shortWeekday(dayKey)` / `weekdayPlural(dayKey)`. This IS a contract amendment (Chunk 2 PlanRow props list gains `dayShort`, `dayPlural`); alternative with no amendment: replace `dayName` by `dayKey: DayKey` and call the three helpers inside PlanRow, but that changes the listed prop, so also an amendment. Update tests to pass the new props (the subtitle cases then no longer depend on slicing).
2. `mobile/src/ui/PlanRow.tsx:42` + test `PlanControls.test.tsx:77`. Expected: tests pin en-US. Actual: `weekdayName(row.forwardedFromDayKey)` uses the device locale, so the `'from Thursday'` assertion fails on a non-English test machine/CI. Fix: with error 1, have the screen pass a `forwardedFromName` (or let PlanRow accept an optional `locale`), or at minimum set the test locale; simplest is a `locale?: string` prop passed through, or pre-formatting in the screen.

### Verified OK
- Props match the contract (only `OneOffRow` export added). Presentational: no `src/state`/`src/data` imports; colors all via `t.c.*` / `t.topic()`.
- a11y: Checkbox role checkbox + checked state, 44x44. Stepper -/+ are buttons 44x44, disabled at bounds; value text has role adjustable with value min/max/now/text and increment/decrement actions. PlanRow tick (`Include X`) and expand (`Edit X for <day>`, expanded state, minHeight 44) are separate targets. Topic radios and chips are 44 pt.
- All 6 subtitles match contract wording ("default", "repeats Fri · not a default", "not on Fridays · add once", "from Thursday", "just for Friday", minutes via formatMinutes). `forwarded` with null key falls back to "forwarded" (reasonable).
- Stepper: clamp 5-180, step 5, no call when no change, Stepper only for timed rows (tested).
- OneOffForm: name maxLength 40, trimmed, required; topic picker; chips Checklist/15/30/45/60/90, default 30; output `{topicId,name,kind,minutes}`. Checklist minutes 15 equals `FALLBACK_MINUTES` in `src/domain/plan.ts:41` (not exported, so duplicated as `CHECK_MINUTES`; fine).
- PlanFooter: "1 task"/"n tasks", formatMinutes, disabled when `!canConfirm || busy`.
- dayNames: local date at noon via `new Date(y, m-1, d, 12)` (no UTC parsing, DST-safe); `locale` param honored; tests cover year edges and DST days.
- Tests assert behaviour (callbacks, disabled state, values), not just render.

### Non-blocking notes
- `weekdayPlural` is `weekdayName + 's'`: Intl provides no plurals, so this is English-only (documented in the code comment; M7).
- OneOffForm starts with no topic selected, so Add is disabled until one is tapped. Costs one extra tap in the 3-minute planning flow; consider preselecting `topics[0]` (note only; tests would need adjusting). With an empty `topics` list Add can never enable (chunk 4 should hide the form or the case cannot occur).
- Reused `ChipSet` hints "Double tap to clear" on the selected length chip, but OneOffForm ignores clearing (`v ?? length`): minor misleading hint.
- `Length` label appears twice (visible label + radiogroup label); harmless.
- Stepper with a non-multiple-of-5 value steps off-grid (47 -> 52); domain clamps minutes so unlikely.
- `Intl.DateTimeFormat` is constructed per call; negligible.

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean (no output).
- `npm run lint` (`expo lint`): no errors reported.
- `npx jest src/ui/__tests__ src/domain`: 17 suites, 210 tests passed (includes PlanControls and dayNames). Worker force-exit warning only.
- `mobile/coverage` not present (deleted/never created).

## Fix (Opus)

### Errors addressed
1. `PlanRow.tsx:38-40` derived "Fri" via `dayName.slice(0, 3)` and "Fridays" via `` `${dayName}s` ``, duplicating `dayNames.ts`.
2. `PlanRow.tsx:42` formatted `forwardedFromDayKey` with the device locale while the test expected "from Thursday" (fails on non-English machines).

### Root cause
PlanRow received a pre-formatted `dayName` string, so it had no `DayKey` to hand to `shortWeekday`/`weekdayPlural`, and no locale to share with the one place (forwarded) that did call Intl. Two sources of day words, one of them locale-blind string slicing.

### Changes (per amended contract row: `dayKey: DayKey; locale?: string`)
- `mobile/src/ui/PlanRow.tsx:4` imports `DayKey`; `:7` imports `shortWeekday, weekdayName, weekdayPlural`.
- `:19-22` prop `dayName: string` replaced by `dayKey: DayKey` + `locale?: string`.
- `:36-47` `subtitle(row, dayKey, locale)`: repeats → `shortWeekday(dayKey, locale)`, not_on_day → `weekdayPlural(dayKey, locale)`, forwarded → `weekdayName(forwardedFromDayKey, locale)`, one_off → `weekdayName(dayKey, locale)`.
- `:56,63` a11y label "Edit <task> for <weekdayName(dayKey, locale)>".
- `mobile/src/ui/__tests__/PlanControls.test.tsx`: PlanRow props now `dayKey: '2026-10-30'` (a Friday), `locale: 'en-US'`; all 6 reason cases and the a11y label run under the pinned locale. New test "formats every day word from Intl with the given locale (de-DE)": asserts `weekdayName(fri,'de-DE') !== 'Friday'` (guards against English fallback), then repeats / not_on_day / one_off / forwarded subtitles and the a11y label equal whatever `dayNames` returns for de-DE (plural stays "s"-suffixed per the documented M7 limitation).

### Command outputs (from `mobile/`)
- `npm run typecheck`: clean.
- `npm run lint`: clean (no errors/warnings).
- `npx jest src/ui/__tests__`: 10 suites, 63 tests passed.
- `npm test`: 34 suites, 345 tests passed.
- `mobile/coverage` deleted.

### Downstream effect
Chunk 4 (Plan screen) passes `dayKey` (the planned day's DayKey) to each `PlanRow`, plus `locale` only if it pins one; it must not pre-format day names. `PlanFooter` still takes `dayName` (unchanged), which the screen gets from `weekdayName(dayKey, locale)`.

## Re-check (Sonnet)

**Verdict: PASS.** No remaining errors.

- No `slice` or `+ 's'` in PlanRow.tsx; subtitles and a11y label all use `shortWeekday`/`weekdayPlural`/`weekdayName` from dayNames.ts with the same `locale`.
- Props match the amended contract (`dayKey: DayKey; locale?: string`, rest unchanged).
- Tests cover all 6 reasons (en-US) plus the de-DE test. It asserts German differs from English, then checks repeats, not_on_day, one_off, forwarded and the a11y label against dayNames output. It would fail if any of those words used the device locale (en-US here).
- `npm run typecheck`: clean. `npm run lint`: clean. `npx jest src/ui/__tests__`: 10 suites, 63 tests passed.
- `LANG=de_DE.UTF-8 LC_ALL=de_DE.UTF-8 TZ=Pacific/Auckland` and `TZ=America/Los_Angeles` on PlanControls.test.tsx: 21/21 passed both times.
- `mobile/coverage` deleted.
- Minor note: the de-DE test checks the a11y label only in the repeats case; acceptable.
