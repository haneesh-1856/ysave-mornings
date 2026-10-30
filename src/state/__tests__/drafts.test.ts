import { act, renderHook } from '@testing-library/react-native';
import { getDay, loadDayBundle } from '../../data/repos/days';
import type { DB } from '../../data/types';
import { glows } from '../../domain/calendar';
import { dayStartOf } from '../../domain/dayKey';
import type { PlanDraft } from '../../domain/plan';
import { confirmDayPlan, discardDayDraft, saveDayDraft } from '../actions/plan';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { useCalendarMonth } from '../hooks/useCalendarMonth';
import type { CalendarCell } from '../hooks/useCalendarMonth';
import { useChain } from '../hooks/useChain';
import { useDayCard } from '../hooks/useDayCard';
import { useDayPlan } from '../hooks/useDayPlan';
import { usePlanDraft } from '../hooks/usePlanDraft';
import { useProfileStats } from '../hooks/useProfileStats';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30';
const LATER = '2026-11-02'; // Monday, 4 days ahead
const AFTER = '2026-11-03';
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(teardownState);

const rows = (d: PlanDraft) => [...d.groups.flatMap((g) => g.rows), ...d.notOn];

/** Daily (default, every day) and Extra (not default, every day). */
function seed() {
  const m = createTopic({ name: 'Math', colorKey: 'study' });
  const daily = createTask(m.id, { name: 'Daily', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  const extra = createTask(m.id, { name: 'Extra', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: false });
  return { daily, extra };
}

/** A draft for `day` with only Extra ticked. */
async function extraOnly(day: string) {
  const { daily, extra } = seed();
  const { result } = await renderHook(() => usePlanDraft(day));
  await act(async () => result.current.toggle(daily.id));
  await act(async () => result.current.toggle(extra.id));
  return { result, daily, extra };
}

describe('usePlanDraft draft mode', () => {
  it('mode is draft after tomorrow and plan for today/tomorrow; hasDraft follows the save', async () => {
    await extraOnly(LATER); // seeds
    expect((await renderHook(() => usePlanDraft(TOMORROW))).result.current.mode).toBe('plan');
    expect((await renderHook(() => usePlanDraft(TODAY))).result.current.mode).toBe('plan');
    const { result } = await renderHook(() => usePlanDraft(LATER));
    expect(result.current).toMatchObject({ mode: 'draft', plannable: true, hasDraft: false });
    await act(async () => result.current.saveDraft()); // the defaults are a valid draft
    expect(result.current.hasDraft).toBe(true);
    expect(getDay(db, LATER)).toMatchObject({ planConfirmedAt: null, planDraftedAt: T0 });
  });

  it('a saved draft reopens as the plan (only Extra ticked), and discard restores the defaults', async () => {
    const { result: first } = await extraOnly(LATER);
    await act(async () => first.current.saveDraft());

    const { result } = await renderHook(() => usePlanDraft(LATER));
    expect(rows(result.current.draft!).map((r) => [r.name, r.ticked])).toEqual([
      ['Daily', false],
      ['Extra', true],
    ]);
    expect(result.current.dirty).toBe(false);

    await act(async () => result.current.discardDraft());
    expect(getDay(db, LATER)).toBeNull();
    expect(result.current.hasDraft).toBe(false);
    expect(rows(result.current.draft!).map((r) => [r.name, r.ticked])).toEqual([
      ['Daily', true],
      ['Extra', false],
    ]);
  });

  it('saveDraft with nothing ticked or a non-draftable day throws and writes nothing', async () => {
    const { daily } = seed();
    const { result } = await renderHook(() => usePlanDraft(LATER));
    await act(async () => result.current.toggle(daily.id));
    expect(() => result.current.saveDraft()).toThrow(ValidationError);
    expect(getDay(db, LATER)).toBeNull();

    const tomorrow = (await renderHook(() => usePlanDraft(TOMORROW))).result.current.draft!;
    expect(() => saveDayDraft(TOMORROW, tomorrow)).toThrow(ValidationError);
    expect(() => saveDayDraft('2028-01-01', tomorrow)).toThrow(ValidationError);
    expect(() => discardDayDraft(TOMORROW)).toThrow(ValidationError);
  });

  it('saveDraft on a day that cannot be planned throws', async () => {
    const { result } = await renderHook(() => usePlanDraft('2026-10-01'));
    expect(result.current.plannable).toBe(false);
    expect(() => result.current.saveDraft()).toThrow(ValidationError);
  });
});

describe('useDayCard / useCalendarMonth with drafts', () => {
  it('later day: canDraft, then drafted with a count; a draft is never planned, glows or has a marble', async () => {
    const { result: ed } = await extraOnly(LATER);
    const card = (await renderHook(() => useDayCard(LATER))).result;
    expect(card.current).toMatchObject({ kind: 'later', canDraft: true, drafted: false, draftCount: 0, canPlan: false });

    await act(async () => ed.current.saveDraft());
    expect(card.current).toMatchObject({ drafted: true, draftCount: 1, planned: false, glows: false, canDraft: true });
    expect(card.current.items).toEqual([]);

    const cal = (await renderHook(() => useCalendarMonth('2026-11'))).result;
    const cell = (k: string) => cal.current.weeks.flat().find((c) => c?.dayKey === k) as CalendarCell;
    expect(cell(LATER)).toMatchObject({ drafted: true, glows: false, items: [] });
    expect(cell(AFTER).drafted).toBe(false);
  });

  it('today and tomorrow are not draftable', async () => {
    seed();
    expect((await renderHook(() => useDayCard(TODAY))).result.current.canDraft).toBe(false);
    expect((await renderHook(() => useDayCard(TOMORROW))).result.current.canDraft).toBe(false);
  });

  it('drafts do not touch the chain, profile stats, or glow', async () => {
    const { result: ed } = await extraOnly(LATER);
    reconcile();
    const chain = (await renderHook(() => useChain())).result.current;
    const stats = (await renderHook(() => useProfileStats())).result.current;
    await act(async () => ed.current.saveDraft());
    expect((await renderHook(() => useChain())).result.current).toEqual(chain);
    expect((await renderHook(() => useProfileStats())).result.current).toEqual(stats);
    expect(glows(loadDayBundle(db, LATER)!, TODAY)).toBe(false);
  });
});

describe('finalizing a draft', () => {
  const DAY_MS = 86_400_000;

  async function draftTomorrow(): Promise<string> {
    // draft LATER, then move the clock so LATER is tomorrow
    const { result } = await extraOnly(LATER);
    await act(async () => result.current.saveDraft());
    t = T0 + 3 * DAY_MS; // Sunday 1 Nov 10:00, LATER (Mon 2 Nov) is tomorrow
    return LATER;
  }

  it('once it is tomorrow, confirming keeps the rows, sets planConfirmedAt, and drops the planning marble', async () => {
    const day = await draftTomorrow();
    const hook = (await renderHook(() => usePlanDraft(day))).result;
    expect(hook.current.mode).toBe('plan');
    expect(rows(hook.current.draft!).map((r) => [r.name, r.ticked])).toEqual([
      ['Daily', false],
      ['Extra', true],
    ]);
    expect((await renderHook(() => useDayCard(day))).result.current).toMatchObject({
      drafted: true,
      kind: 'tomorrow',
      canPlan: true,
    });
    expect(hook.current.canConfirm).toBe(true);

    const savedIds = loadDayBundle(db, day)!.dayTasks.map((d) => d.id);
    await act(async () => hook.current.confirm());
    const b = loadDayBundle(db, day)!;
    expect(b.day.planConfirmedAt).toBe(t);
    expect(b.day.planDraftedAt).toBe(T0); // kept as history
    expect(b.dayTasks.map((d) => d.id)).toEqual(savedIds);
    expect((await renderHook(() => useDayPlan(day))).result.current.items.map((i) => i.kind)).toEqual(['planning']);
    expect((await renderHook(() => useDayCard(day))).result.current).toMatchObject({ planned: true, drafted: false });
  });

  it('a draft that arrives as today unfinalized is not topped up with defaults, and has no planning marble', async () => {
    const day = await draftTomorrow();
    t = dayStartOf(day, 4) + 6 * 3_600_000;
    reconcile();
    const b = loadDayBundle(db, day)!;
    expect(b.day.planConfirmedAt).toBeNull();
    expect(b.dayTasks.map((d) => d.name)).toEqual(['Extra']); // Daily (default) was NOT added
    expect((await renderHook(() => useDayPlan(day))).result.current.items).toEqual([]);
    const card = (await renderHook(() => useDayCard(day))).result.current;
    expect(card).toMatchObject({ kind: 'today', planned: false, drafted: false });
    // today's plan is still editable (ADR-009) and starts from the draft
    const hook = (await renderHook(() => usePlanDraft(day))).result;
    expect(rows(hook.current.draft!).map((r) => [r.name, r.ticked])).toEqual([
      ['Daily', false],
      ['Extra', true],
    ]);
    expect(() => confirmDayPlan(day, hook.current.draft!)).not.toThrow();
    expect(getDay(db, day)!.planConfirmedAt).not.toBeNull();
  });
});

describe('a drafted tomorrow meets the evening close', () => {
  it('forwarded rows join the draft (ticked), a task already in the draft is not duplicated, and confirm keeps both', async () => {
    const m = createTopic({ name: 'Math', colorKey: 'study' });
    const a = createTask(m.id, { name: 'A', kind: 'check', repeatMask: 127, isDefault: true });
    createTask(m.id, { name: 'B', kind: 'check', repeatMask: 127, isDefault: true });
    const e = createTask(m.id, { name: 'E', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: false });
    const DAY = '2026-10-31'; // today + 2: draftable
    const { result } = await renderHook(() => usePlanDraft(DAY));
    await act(async () => result.current.toggle(e.id)); // defaults A and B are ticked; add E, drop B
    await act(async () => result.current.toggle(rows(result.current.draft!).find((r) => r.name === 'B')!.key));
    await act(async () => result.current.saveDraft());
    expect(loadDayBundle(db, DAY)!.dayTasks.map((d) => d.name).sort()).toEqual(['A', 'E']);
    expect(a.id).toBeTruthy();

    t = T0 + 86_400_000; // DAY is now tomorrow
    reconcile();
    const today = loadDayBundle(db, TOMORROW)!;
    const ids = Object.fromEntries(today.dayTasks.map((d) => [d.name, d.id]));
    closeToday({ [ids.A]: 'moved', [ids.B]: 'moved' });

    const plan = (await renderHook(() => usePlanDraft(DAY))).result;
    expect(plan.current.mode).toBe('plan');
    const ticked = rows(plan.current.draft!).filter((r) => r.ticked);
    expect(ticked.map((r) => r.name).sort()).toEqual(['A', 'B', 'E']); // one A only
    expect(ticked.find((r) => r.name === 'B')!.reason).toBe('forwarded');
    await act(async () => plan.current.confirm());
    const b = loadDayBundle(db, DAY)!;
    expect(b.day.planConfirmedAt).not.toBeNull();
    expect(b.dayTasks.map((d) => d.name).sort()).toEqual(['A', 'B', 'E']);
  });
});
