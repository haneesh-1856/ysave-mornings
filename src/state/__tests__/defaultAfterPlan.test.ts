import { loadDayBundle, setCheckCompleted } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import type { PlanDraft, PlanRow } from '../../domain/plan';
import { closeToday } from '../actions/close';
import { createTask, createTopic, updateTask } from '../actions/library';
import { confirmDayPlan, saveDayDraft } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { setClockOverride } from '../clock';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

/** Chunk 9: a default changed AFTER a plan was confirmed / drafted moves the tick; nothing else does. */
const FRI = '2026-10-30';
const SAT = '2026-10-31';
const LATER = '2026-11-03'; // a later day, draft mode
const T0 = dayStartOf(FRI, 4) + 6 * 3_600_000;
const HOUR = 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(teardownState);

const planOf = (day: string): PlanDraft => {
  const b = loadDayBundle(db, day);
  return buildPlan({ dayKey: day, topics: listTopics(db), tasks: listTasks(db), day: b?.day ?? null, dayTasks: b?.dayTasks ?? [] });
};
const rowsOf = (d: PlanDraft): PlanRow[] => [...d.groups.flatMap((g) => g.rows), ...d.notOn];
const row = (day: string, name: string): PlanRow => rowsOf(planOf(day)).find((r) => r.name === name)!;
const storedNames = (day: string): string[] => (loadDayBundle(db, day)?.dayTasks ?? []).map((d) => d.name).sort();
const later = (): void => {
  t += HOUR;
};
const untick = (d: PlanDraft, name: string): PlanDraft => ({
  ...d,
  groups: d.groups.map((g) => ({ ...g, rows: g.rows.map((r) => (r.name === name ? { ...r, ticked: false } : r)) })),
});
const tick = (d: PlanDraft, name: string): PlanDraft => ({
  ...d,
  groups: d.groups.map((g) => ({ ...g, rows: g.rows.map((r) => (r.name === name ? { ...r, ticked: true } : r)) })),
});

/** Today closed; tomorrow planned and confirmed (Read only). */
function planTomorrow(): void {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  reconcile();
  closeToday(letGoAll());
  confirmDayPlan(SAT, planOf(SAT));
  later();
}

describe('user path: B created as a default after tomorrow was confirmed', () => {
  it('shows ticked, joins on Confirm, and then appears in the stored rows', () => {
    planTomorrow();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });
    expect(storedNames(SAT)).toEqual(['Read']); // nothing is written until Confirm
    expect(row(SAT, 'B')).toMatchObject({ ticked: true, reason: 'default', dayTaskId: null });
    confirmDayPlan(SAT, planOf(SAT));
    expect(storedNames(SAT)).toEqual(['B', 'Read']);
  });

  it('turning default on later for an existing task does the same', () => {
    planTomorrow();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    const b = createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: false });
    expect(row(SAT, 'B').ticked).toBe(false);
    later();
    updateTask(b.id, { isDefault: true });
    expect(row(SAT, 'B')).toMatchObject({ ticked: true, reason: 'default' });
  });

  it('does nothing when the task does not repeat on that day', () => {
    planTomorrow();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 1 << 0, isDefault: true }); // Mondays
    expect(row(SAT, 'B')).toMatchObject({ ticked: false, reason: 'not_on_day' });
  });
});

describe('reverse: default turned off after confirmation', () => {
  function withC() {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    const c = createTask(study.id, { name: 'C', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    closeToday(letGoAll());
    confirmDayPlan(SAT, planOf(SAT));
    expect(storedNames(SAT)).toEqual(['C', 'Read']);
    later();
    return c;
  }

  it('C shows unticked and is left out on Confirm', () => {
    const c = withC();
    updateTask(c.id, { isDefault: false });
    expect(row(SAT, 'C')).toMatchObject({ ticked: false, dayTaskId: expect.any(String) });
    confirmDayPlan(SAT, planOf(SAT));
    expect(storedNames(SAT)).toEqual(['Read']);
  });

  it('the user can tick C back and it stays', () => {
    const c = withC();
    updateTask(c.id, { isDefault: false });
    confirmDayPlan(SAT, tick(planOf(SAT), 'C'));
    expect(storedNames(SAT)).toEqual(['C', 'Read']);
  });
});

describe('guards: choices at confirmation and other edits win', () => {
  it('a default the user unticked when confirming stays unticked on reopen', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    createTask(study.id, { name: 'D', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    closeToday(letGoAll());
    confirmDayPlan(SAT, untick(planOf(SAT), 'D'));
    later();
    expect(row(SAT, 'D').ticked).toBe(false);
  });

  it('a non-default the user ticked when confirming stays ticked', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    createTask(study.id, { name: 'N', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: false });
    reconcile();
    closeToday(letGoAll());
    confirmDayPlan(SAT, tick(planOf(SAT), 'N'));
    later();
    expect(row(SAT, 'N').ticked).toBe(true);
  });

  it('editing name, minutes and note after confirmation does not move a tick', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const d = createTask(study.id, { name: 'D', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    const n = createTask(study.id, { name: 'N', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: false });
    reconcile();
    closeToday(letGoAll());
    confirmDayPlan(SAT, tick(untick(planOf(SAT), 'D'), 'N'));
    later();
    updateTask(d.id, { name: 'D2', minutes: 45, isDefault: true }); // isDefault unchanged
    updateTask(n.id, { name: 'N2', minutes: 45 });
    expect(row(SAT, 'D2').ticked).toBe(false);
    expect(rowsOf(planOf(SAT)).find((r) => r.taskId === n.id)!.ticked).toBe(true); // saved row keeps its snapshot name
  });

  it('a finished row stays ticked and is kept, even if its default went off', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const c = createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
    reconcile();
    closeToday(Object.fromEntries(loadDayBundle(db, FRI)!.dayTasks.map((d) => [d.id, 'let_go' as const])));
    confirmDayPlan(SAT, planOf(SAT));
    const stored = loadDayBundle(db, SAT)!.dayTasks[0];
    setCheckCompleted(db, stored.id, t, t);
    later();
    updateTask(c.id, { isDefault: false });
    expect(row(SAT, 'C').ticked).toBe(true);
    confirmDayPlan(SAT, planOf(SAT));
    expect(storedNames(SAT)).toEqual(['C']);
  });
});

describe('a drafted day follows the same rules', () => {
  it('default on after the draft: ticked; default off after the draft: unticked', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    const c = createTask(study.id, { name: 'C', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    saveDayDraft(LATER, planOf(LATER));
    later();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });
    updateTask(c.id, { isDefault: false });
    expect(row(LATER, 'B')).toMatchObject({ ticked: true, reason: 'default' });
    expect(row(LATER, 'C').ticked).toBe(false);
    expect(row(LATER, 'Read').ticked).toBe(true);
  });
});

describe('re-confirm: the latest confirmation wins over earlier default changes', () => {
  it('B unticked and re-confirmed stays unticked on reopen', () => {
    planTomorrow();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });
    expect(row(SAT, 'B').ticked).toBe(true);
    later();
    const firstConfirmedAt = loadDayBundle(db, SAT)!.day.planConfirmedAt;
    confirmDayPlan(SAT, untick(planOf(SAT), 'B'));
    expect(storedNames(SAT)).toEqual(['Read']);
    expect(loadDayBundle(db, SAT)!.day).toMatchObject({ planConfirmedAt: firstConfirmedAt, planUpdatedAt: t });
    later();
    expect(row(SAT, 'B')).toMatchObject({ ticked: false });
  });

  it('C turned non-default, ticked back and re-confirmed stays ticked on reopen', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    const c = createTask(study.id, { name: 'C', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    closeToday(letGoAll());
    confirmDayPlan(SAT, planOf(SAT));
    later();
    updateTask(c.id, { isDefault: false });
    expect(row(SAT, 'C').ticked).toBe(false);
    later();
    confirmDayPlan(SAT, tick(planOf(SAT), 'C'));
    later();
    expect(row(SAT, 'C').ticked).toBe(true);
    expect(storedNames(SAT)).toEqual(['C', 'Read']);
  });

  it('a default change after the re-confirm still moves the tick', () => {
    planTomorrow();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    const b = createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });
    later();
    confirmDayPlan(SAT, untick(planOf(SAT), 'B'));
    later();
    updateTask(b.id, { isDefault: false });
    later();
    updateTask(b.id, { isDefault: true });
    expect(row(SAT, 'B')).toMatchObject({ ticked: true, reason: 'default' });
  });

  it('a re-saved draft also counts as the latest choice', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(study.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    saveDayDraft(LATER, planOf(LATER));
    later();
    const topic = createTopic({ name: 'Music', colorKey: 'home' });
    createTask(topic.id, { name: 'B', kind: 'timed', minutes: 20, repeatMask: 127, isDefault: true });
    later();
    saveDayDraft(LATER, untick(planOf(LATER), 'B'));
    expect(loadDayBundle(db, LATER)!.day.planUpdatedAt).toBe(t);
    later();
    expect(row(LATER, 'B').ticked).toBe(false);
  });
});
