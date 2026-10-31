import { act, renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import type { PlanDraft, PlanRow } from '../../domain/plan';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { confirmDayPlan, saveDayDraft } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { setClockOverride } from '../clock';
import { usePlanDraft } from '../hooks/usePlanDraft';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const WED = '2026-10-28';
const FRI = '2026-10-30';
const SAT = '2026-10-31';
const T_WED = dayStartOf(WED, 4) + 6 * 3_600_000;
const T_FRI = dayStartOf(FRI, 4) + 6 * 3_600_000;
const T_SAT = dayStartOf(SAT, 4) + 6 * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T_WED);
  t = T_WED;
  setClockOverride(() => t);
});
afterEach(teardownState);

const planOf = (day: string): PlanDraft => {
  const b = loadDayBundle(db, day);
  return buildPlan({ dayKey: day, topics: listTopics(db), tasks: listTasks(db), day: b?.day ?? null, dayTasks: b?.dayTasks ?? [] });
};
const rowsOf = (d: PlanDraft): PlanRow[] => [...d.groups.flatMap((g) => g.rows), ...d.notOn];
const named = (d: PlanDraft, name: string): PlanRow[] => rowsOf(d).filter((r) => r.name === name);

function seed(xDefault: boolean) {
  const m = createTopic({ name: 'Math', colorKey: 'study' });
  const extra = createTask(m.id, { name: 'Extra', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: false });
  const makeX = () => createTask(m.id, { name: 'X', kind: 'check', minutes: 5, repeatMask: 127, isDefault: xDefault });
  return { extra, makeX };
}

/** Friday: reconcile, then close with X moved. */
function closeFridayMovingX(): void {
  t = T_FRI;
  reconcile();
  const fri = loadDayBundle(db, FRI)!;
  const x = fri.dayTasks.find((d) => d.name === 'X')!;
  closeToday({ [x.id]: 'moved' });
}

const expectForwardedOnce = (day: string): void => {
  const x = loadDayBundle(db, day)!.dayTasks.filter((d) => d.name === 'X');
  expect(x).toHaveLength(1);
  expect(x[0]).toMatchObject({ forwardedFromDayKey: FRI, completedAt: null });
  const row = named(planOf(day), 'X');
  expect(row).toHaveLength(1);
  expect(row[0]).toMatchObject({ ticked: true, reason: 'forwarded', forwardedFromDayKey: FRI });
};

describe('moved checklist task arrives ticked "from Friday"', () => {
  it('(a) next day has no row', () => {
    const { makeX } = seed(true);
    t = T_FRI;
    makeX();
    closeFridayMovingX();
    expectForwardedOnce(SAT);
  });

  it('(b) next day has a draft of other tasks: the moved row joins it', () => {
    const { extra, makeX } = seed(true);
    const draft = planOf(SAT);
    saveDayDraft(SAT, { ...draft, groups: draft.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.taskId === extra.id })) })) });
    t = T_FRI;
    makeX();
    closeFridayMovingX();
    expectForwardedOnce(SAT);
    expect(named(planOf(SAT), 'Extra')[0].ticked).toBe(true);
  });

  it('(c) next day draft already holds the same task: it is marked forwarded, not skipped', () => {
    const { makeX } = seed(false);
    makeX();
    const d = planOf(SAT);
    saveDayDraft(SAT, { ...d, groups: d.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.name === 'X' })) })) });
    t = T_FRI;
    const fri = planOf(FRI);
    confirmDayPlan(FRI, { ...fri, groups: fri.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.name === 'X' })) })) });
    closeFridayMovingX();
    expectForwardedOnce(SAT);
  });

  it('(c2) next day confirmed plan already holds the same task: it is marked forwarded', () => {
    const { makeX } = seed(true);
    makeX();
    t = T_FRI;
    reconcile();
    confirmDayPlan(SAT, planOf(SAT));
    closeFridayMovingX();
    expectForwardedOnce(SAT);
  });

  it('(d) the forwarded row survives confirming the next day, and the day starting', () => {
    const { extra, makeX } = seed(true);
    const draft = planOf(SAT);
    saveDayDraft(SAT, { ...draft, groups: draft.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.taskId === extra.id })) })) });
    t = T_FRI;
    makeX();
    closeFridayMovingX();
    confirmDayPlan(SAT, planOf(SAT));
    expectForwardedOnce(SAT);
    t = T_SAT;
    reconcile();
    expectForwardedOnce(SAT);
  });

  it('(d2) an unfinalized draft day starting keeps the forwarded row', () => {
    const { extra, makeX } = seed(true);
    const draft = planOf(SAT);
    saveDayDraft(SAT, { ...draft, groups: draft.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.taskId === extra.id })) })) });
    t = T_FRI;
    makeX();
    closeFridayMovingX();
    t = T_SAT;
    reconcile();
    expectForwardedOnce(SAT);
  });
});

describe('Plan(next day) after the move (Finalize path)', () => {
  it('shows the forwarded task ticked "from Friday" and finalizing keeps it', async () => {
    const { makeX } = seed(false);
    makeX();
    const d = planOf(SAT);
    saveDayDraft(SAT, { ...d, groups: d.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.name === 'X' })) })) });
    t = T_FRI;
    const fri = planOf(FRI);
    confirmDayPlan(FRI, { ...fri, groups: fri.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ticked: r.name === 'X' })) })) });
    closeFridayMovingX();
    const { result } = await renderHook(() => usePlanDraft(SAT));
    const row = rowsOf(result.current.draft!).filter((r) => r.name === 'X');
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ ticked: true, reason: 'forwarded', forwardedFromDayKey: FRI });
    await act(async () => result.current.confirm());
    expectForwardedOnce(SAT);
  });
});
