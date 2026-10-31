import { dayEndOf, dayKeyOf } from '../dayKey';
import { closeByHand, missingOutcomes, rollover } from '../rollover';
import type { Ops } from '../rollover';
import type { CloseOutcome, Day, DayBundle, DayTask, Session, Task, Topic } from '../types';

const MIN = 60_000;
const at = (m: number, d: number, h: number, mi = 0): number => new Date(2026, m - 1, d, h, mi).getTime();

const dt = (id: string, dayKey: string, over: Partial<DayTask> = {}): DayTask => ({
  id, dayKey, taskId: null, topicId: 'A', name: id, colorKey: 'study', kind: 'check', budgetSec: 0,
  cue: null, treat: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null, sortOrder: 0, ...over,
});
const dayRow = (dayKey: string, over: Partial<Day> = {}): Day => ({
  dayKey, planConfirmedAt: 1, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, ...over,
});
const sess = (id: string, dayTaskId: string, s: number, e: number | null): Session => ({
  id, dayTaskId, startedAt: s, endedAt: e,
});
const bundle = (day: Day, dayTasks: DayTask[], sessions: Session[] = []): DayBundle => {
  const sessionsByDayTask: Record<string, Session[]> = {};
  for (const s of sessions) (sessionsByDayTask[s.dayTaskId] ??= []).push(s);
  return { day, dayTasks, sessionsByDayTask };
};
const topics: Topic[] = [{ id: 'A', name: 'A', colorKey: 'study', sortOrder: 1, isOpen: true, deletedAt: null }];
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, topicId: 'A', name: id, kind: 'check', minutes: 15, repeatMask: 127, isDefault: true, cue: null,
  treat: null, note: '', sortOrder: 1, deletedAt: null, defaultChangedAt: null, ...over,
});

// Day with two unticked checks (c1 sort 1, c2 sort 0), a done check, a timed task.
const D = '2026-10-28';
const mk = (sessions: Session[] = [], dayOver: Partial<Day> = {}): DayBundle =>
  bundle(dayRow(D, dayOver), [
    dt('c1', D, { taskId: 't1', name: 'Stretch', cue: 'cue', treat: 'tr', colorKey: 'health', topicId: 'H', sortOrder: 1 }),
    dt('c2', D, { taskId: 't2', sortOrder: 0 }),
    dt('c3', D, { completedAt: 5 }),
    dt('tm', D, { kind: 'timed', budgetSec: 600, sortOrder: 3 }),
  ], sessions);
const NEXT = { day: null, dayTasks: [] as DayTask[], dayStartHour: 4 };

describe('missingOutcomes', () => {
  it('lists unticked checks without a choice, in sortOrder; ignores timed and done', () => {
    const b = mk();
    expect(missingOutcomes(b, {})).toEqual(['c2', 'c1']);
    expect(missingOutcomes(b, { c2: 'moved' })).toEqual(['c1']);
    expect(missingOutcomes(b, { c1: 'let_go', c2: 'moved' })).toEqual([]);
  });
});

describe('closeByHand', () => {
  const now = at(10, 28, 22);
  const both: Record<string, CloseOutcome> = { c1: 'moved', c2: 'let_go' };

  it('records outcomes, closes the day by user, forwards moved tasks into a new next day', () => {
    const ops = closeByHand(mk(), both, NEXT, now);
    expect(ops.outcomes).toEqual([
      { dayTaskId: 'c2', closeOutcome: 'let_go' },
      { dayTaskId: 'c1', closeOutcome: 'moved' },
    ]);
    expect(ops.closeDays).toEqual([{ dayKey: D, closedAt: now, closedBy: 'user' }]);
    expect(ops.createDays).toEqual([
      { dayKey: '2026-10-29', planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4 },
    ]);
    expect(ops.insertDayTasks).toEqual([{
      dayKey: '2026-10-29', taskId: 't1', topicId: 'H', name: 'Stretch', colorKey: 'health', kind: 'check',
      budgetSec: 0, cue: 'cue', treat: 'tr', forwardedFromDayKey: D, completedAt: null, closeOutcome: null,
      sortOrder: 0,
    }]);
    expect(ops.closeSessions).toEqual([]);
    expect(ops.completions).toEqual([]);
  });

  it('uses the supplied dayStartHour for a created next day', () => {
    const ops = closeByHand(mk(), both, { ...NEXT, dayStartHour: 6 }, now);
    expect(ops.createDays[0].dayStartHour).toBe(6);
  });

  it('does not create a next day that exists; appends after its rows', () => {
    const next = { day: dayRow('2026-10-29'), dayTasks: [dt('n1', '2026-10-29', { taskId: 'x', sortOrder: 4 })], dayStartHour: 4 };
    const ops = closeByHand(mk(), { c1: 'moved', c2: 'moved' }, next, now);
    expect(ops.createDays).toEqual([]);
    expect(ops.insertDayTasks.map((d) => d.sortOrder)).toEqual([5, 6]);
    expect(ops.insertDayTasks.map((d) => d.taskId)).toEqual(['t2', 't1']);
  });

  it('marks a moved task already in the next day as forwarded instead of inserting it again', () => {
    const next = { day: dayRow('2026-10-29'), dayTasks: [dt('n1', '2026-10-29', { taskId: 't1' })], dayStartHour: 4 };
    const ops = closeByHand(mk(), both, next, now);
    expect(ops.insertDayTasks).toEqual([]);
    expect(ops.forwardDayTasks).toEqual([{ dayTaskId: 'n1', forwardedFromDayKey: '2026-10-28' }]);
    expect(ops.outcomes).toContainEqual({ dayTaskId: 'c1', closeOutcome: 'moved' });
  });

  it('leaves a next-day row that is already forwarded alone', () => {
    const next = {
      day: dayRow('2026-10-29'),
      dayTasks: [dt('n1', '2026-10-29', { taskId: 't1', forwardedFromDayKey: '2026-10-27' })],
      dayStartHour: 4,
    };
    const ops = closeByHand(mk(), both, next, now);
    expect(ops.forwardDayTasks).toEqual([]);
    expect(ops.insertDayTasks).toEqual([]);
  });

  it('forwards one-off (null taskId) moved tasks even if other null-taskId rows exist', () => {
    const b = bundle(dayRow(D), [dt('o', D)]);
    const next = { day: dayRow('2026-10-29'), dayTasks: [dt('n', '2026-10-29')], dayStartHour: 4 };
    const ops = closeByHand(b, { o: 'moved' }, next, now);
    expect(ops.insertDayTasks).toHaveLength(1);
    expect(ops.insertDayTasks[0].taskId).toBeNull();
  });

  it('closes the open session at now and completes a timed task that reached budget', () => {
    const b = mk([sess('s1', 'tm', now - 10 * MIN - 5000, null)]);
    const ops = closeByHand(b, both, NEXT, now);
    expect(ops.closeSessions).toEqual([{ id: 's1', endedAt: now }]);
    expect(ops.completions).toEqual([{ dayTaskId: 'tm', completedAt: now - 5000 }]);
  });

  it('leaves already-ended sessions alone and never forwards timed tasks', () => {
    const b = mk([sess('s1', 'tm', now - 20 * MIN, now - 15 * MIN)]);
    const ops = closeByHand(b, both, NEXT, now);
    expect(ops.closeSessions).toEqual([]);
    expect(ops.completions).toEqual([]);
    expect(ops.insertDayTasks.every((d) => d.kind === 'check')).toBe(true);
  });

  it('throws when outcomes are missing', () => {
    expect(() => closeByHand(mk(), { c1: 'moved' }, NEXT, now)).toThrow(/c2/);
  });

  it('throws when the day is already closed', () => {
    expect(() => closeByHand(mk([], { closedAt: 9, closedBy: 'user' }), both, NEXT, now)).toThrow(/already closed/);
  });

  it('ignores outcomes for ticked or unknown tasks', () => {
    const ops = closeByHand(mk(), { ...both, c3: 'moved', zz: 'moved' }, NEXT, now);
    expect(ops.outcomes).toHaveLength(2);
  });
});

// ---- rollover ----

const NOW = at(10, 29, 9); // Thursday 09:00; today = 2026-10-29 with H=4
// todayKey is an input of rollover; by default derive it from now/hour like the state layer does with equal hours.
const input = (
  { now = NOW, ...over }: Partial<Parameters<typeof rollover>[0]> & { now?: number } = {},
): Parameters<typeof rollover>[0] => ({
  dayStartHour: 4, openDays: [], today: { day: null, dayTasks: [] }, topics, tasks: [], ...over,
  todayKey: over.todayKey ?? dayKeyOf(now, over.dayStartHour ?? 4),
});

describe('rollover: auto-close', () => {
  it('closes one past day at its end: let_go, closedBy auto, open session cut at dayEndOf', () => {
    const end = dayEndOf(D, 4);
    expect(end).toBe(at(10, 29, 4));
    const b = mk([sess('s1', 'tm', at(10, 28, 23), null)]);
    const r = rollover(input({ openDays: [b] }));
    expect(r.todayKey).toBe('2026-10-29');
    expect(r.autoClosed).toEqual([D]);
    expect(r.closeDays).toEqual([{ dayKey: D, closedAt: end, closedBy: 'auto' }]);
    expect(r.closeSessions).toEqual([{ id: 's1', endedAt: end }]);
    expect(r.outcomes).toEqual([
      { dayTaskId: 'c2', closeOutcome: 'let_go' },
      { dayTaskId: 'c1', closeOutcome: 'let_go' },
    ]);
    // The 10 min budget was reached at 23:10: completion is that instant, not the end or now.
    expect(r.completions).toEqual([{ dayTaskId: 'tm', completedAt: at(10, 28, 23) + 10 * MIN }]);
  });

  it('a task that hit 0 while the phone was locked completes at that instant; time never leaks into today', () => {
    // Session started 03:55 on the 29th would be inside the 29th, so use one that straddles the end:
    // the 28th ends 04:00 on the 29th. Started 03:50 with a 10 min budget: reached exactly at the end.
    const b2 = mk([sess('s1', 'tm', at(10, 29, 3, 50), null)]);
    const r2 = rollover(input({ openDays: [b2] }));
    expect(r2.completions).toEqual([{ dayTaskId: 'tm', completedAt: at(10, 29, 4) }]);
    // Started 03:55: only 5 min fit before the end, the session is cut there and nothing completes.
    const b = mk([sess('s1', 'tm', at(10, 29, 3, 55), null)]);
    const r = rollover(input({ openDays: [b] }));
    expect(r.closeSessions).toEqual([{ id: 's1', endedAt: dayEndOf(D, 4) }]);
    expect(r.completions).toEqual([]);
  });

  it('closes several past days in dayKey order, ignoring closed and non-past days', () => {
    const b27 = bundle(dayRow('2026-10-27'), [dt('x', '2026-10-27')]);
    const b28 = mk();
    const closed = bundle(dayRow('2026-10-26', { closedAt: 3, closedBy: 'user' }), [dt('y', '2026-10-26')]);
    const todayB = bundle(dayRow('2026-10-29'), [dt('z', '2026-10-29')]);
    const r = rollover(input({ openDays: [b28, todayB, closed, b27], today: { day: todayB.day, dayTasks: todayB.dayTasks } }));
    expect(r.autoClosed).toEqual(['2026-10-27', '2026-10-28']);
    expect(r.closeDays.map((c) => c.closedAt)).toEqual([dayEndOf('2026-10-27', 4), dayEndOf('2026-10-28', 4)]);
    expect(r.outcomes.map((o) => o.dayTaskId)).toEqual(['x', 'c2', 'c1']);
  });

  it('takes todayKey as given: a day still running on its own later hour is not closed', () => {
    const b = mk([], { dayStartHour: 6 });
    // 05:00 on the 29th: under H=4 the 28th is over, but its own hour (6) says it still runs.
    const r = rollover(input({ now: at(10, 29, 5), todayKey: '2026-10-28', dayStartHour: 4, openDays: [b], today: { day: b.day, dayTasks: b.dayTasks } }));
    expect(r.todayKey).toBe('2026-10-28');
    expect(r.autoClosed).toEqual([]);
    expect(r.closeDays).toEqual([]);
  });

  it('uses the own dayStartHour snapshot of each day, not the current one', () => {
    // Day created with H=4; user now has H=6. At 05:00 on the 29th the current-H today is still the 28th.
    const b = mk([], { dayStartHour: 4 });
    const r = rollover(input({ now: at(10, 29, 5), dayStartHour: 6, openDays: [b] }));
    expect(r.todayKey).toBe('2026-10-28');
    expect(r.autoClosed).toEqual([]);
    // At 07:00 today is the 29th; the 28th closes at 04:00 (its own H), not 06:00.
    const r2 = rollover(input({ now: at(10, 29, 7), dayStartHour: 6, openDays: [b] }));
    expect(r2.todayKey).toBe('2026-10-29');
    expect(r2.closeDays[0].closedAt).toBe(at(10, 29, 4));
    expect(r2.createDays[0].dayStartHour).toBe(6);
    const b6 = mk([], { dayStartHour: 6 });
    expect(rollover(input({ now: at(10, 29, 7), dayStartHour: 4, openDays: [b6] })).closeDays[0].closedAt).toBe(at(10, 29, 6));
  });

  it('handles a DST fall-back day (25 hours): ends at the next 04:00 local', () => {
    const k = '2026-10-31';
    const end = dayEndOf(k, 4);
    expect(end - at(10, 31, 4)).toBe(25 * 60 * MIN);
    const b = bundle(dayRow(k), [dt('c', k)], [sess('s', 'c', at(10, 31, 23), null)]);
    const r = rollover(input({ now: at(11, 1, 9), openDays: [b] }));
    expect(r.closeDays[0].closedAt).toBe(end);
    expect(r.closeSessions).toEqual([{ id: 's', endedAt: end }]);
  });
});

describe('rollover: today', () => {
  const tasks = [task('t1', { sortOrder: 1 }), task('t2', { sortOrder: 2, isDefault: false })];

  it('creates today and prefills default tasks when there is no row', () => {
    const r = rollover(input({ tasks }));
    expect(r.createDays).toEqual([
      { dayKey: '2026-10-29', planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4 },
    ]);
    expect(r.insertDayTasks.map((d) => d.taskId)).toEqual(['t1']);
    expect(r.insertDayTasks[0].dayKey).toBe('2026-10-29');
  });

  it('prefills an unplanned existing day (no createDays), only missing rows', () => {
    const day = dayRow('2026-10-29', { planConfirmedAt: null });
    const fw = dt('f', '2026-10-29', { taskId: 't1', forwardedFromDayKey: D });
    const r = rollover(input({ tasks, today: { day, dayTasks: [fw] } }));
    expect(r.createDays).toEqual([]);
    expect(r.insertDayTasks).toEqual([]);
    const r2 = rollover(input({ tasks, today: { day, dayTasks: [] } }));
    expect(r2.insertDayTasks.map((d) => d.taskId)).toEqual(['t1']);
  });

  it('leaves a confirmed today untouched', () => {
    const day = dayRow('2026-10-29');
    const r = rollover(input({ tasks, today: { day, dayTasks: [] } }));
    expect(r.createDays).toEqual([]);
    expect(r.insertDayTasks).toEqual([]);
  });

  it('never prefills a closed today, even one closed before its plan was confirmed', () => {
    const day = dayRow('2026-10-29', { planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: NOW - MIN, closedBy: 'user' });
    const r = rollover(input({ tasks, today: { day, dayTasks: [] } }));
    expect(r.createDays).toEqual([]);
    expect(r.insertDayTasks).toEqual([]);
  });

  it('does not create days that were skipped entirely', () => {
    const r = rollover(input({ tasks }));
    expect(r.createDays.map((d) => d.dayKey)).toEqual(['2026-10-29']);
  });
});

// ---- idempotency: apply ops to in-memory state, run again ----

function apply(
  ops: Ops, bundles: DayBundle[], today: { day: Day | null; dayTasks: DayTask[] }, todayKey: string,
): { bundles: DayBundle[]; today: { day: Day | null; dayTasks: DayTask[] } } {
  const out = bundles.map((b) => ({
    day: { ...b.day },
    dayTasks: b.dayTasks.map((t) => ({ ...t })),
    sessionsByDayTask: Object.fromEntries(
      Object.entries(b.sessionsByDayTask).map(([k, v]) => [k, v.map((s) => ({ ...s }))]),
    ),
  }));
  for (const b of out) {
    for (const c of ops.closeDays) {
      if (c.dayKey === b.day.dayKey) Object.assign(b.day, { closedAt: c.closedAt, closedBy: c.closedBy });
    }
    for (const t of b.dayTasks) {
      for (const c of ops.completions) if (c.dayTaskId === t.id) t.completedAt = c.completedAt;
      for (const o of ops.outcomes) if (o.dayTaskId === t.id) t.closeOutcome = o.closeOutcome;
    }
    for (const ss of Object.values(b.sessionsByDayTask)) {
      for (const s of ss) for (const c of ops.closeSessions) if (c.id === s.id) s.endedAt = c.endedAt;
    }
  }
  let day = today.day;
  for (const d of ops.createDays) if (d.dayKey === todayKey) day = d;
  const dayTasks = [
    ...today.dayTasks,
    ...ops.insertDayTasks.filter((d) => d.dayKey === todayKey).map((d, i) => ({ ...d, id: `new${i}` })),
  ];
  return { bundles: out, today: { day, dayTasks } };
}

describe('rollover: idempotent', () => {
  it('a second run on its own output returns empty Ops', () => {
    const tasks = [task('t1'), task('t2')];
    const bundles = [mk([sess('s1', 'tm', at(10, 28, 23), null)]), bundle(dayRow('2026-10-27'), [dt('x', '2026-10-27')])];
    const first = rollover(input({ tasks, openDays: bundles }));
    expect(first.autoClosed).toHaveLength(2);
    const state = apply(first, bundles, { day: null, dayTasks: [] }, first.todayKey);
    const second = rollover(input({ tasks, openDays: state.bundles, today: state.today }));
    expect(second).toEqual({
      closeSessions: [], completions: [], outcomes: [], closeDays: [], createDays: [], insertDayTasks: [], forwardDayTasks: [],
      todayKey: '2026-10-29', autoClosed: [],
    });
  });
});

describe('rollover: drafted today (ADR-010)', () => {
  const tasks = [task('t1', { sortOrder: 1 })];
  it('does not prefill defaults into an unfinalized draft that arrived as today', () => {
    const day = dayRow('2026-10-29', { planConfirmedAt: null, planDraftedAt: 7 });
    const r = rollover(input({ tasks, today: { day, dayTasks: [dt('d', '2026-10-29', { taskId: 't2' })] } }));
    expect(r.createDays).toEqual([]);
    expect(r.insertDayTasks).toEqual([]);
  });
});
