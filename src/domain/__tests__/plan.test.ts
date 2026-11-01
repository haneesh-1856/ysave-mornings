import {
  addOneOff, buildPlan, canConfirm, confirmPlan, draftableDays, isDraftable, plannableDays, prefillUnplanned,
  setCue, setNote, setTicked, setTreat, stepMinutes,
} from '../plan';
import type { PlanDraft, PlanRow } from '../plan';
import type { Day, DayTask, Session, Task, Topic } from '../types';

const THU = '2026-10-29'; // Thursday = bit 3
const MON_BIT = 1, THU_BIT = 8, FRI_BIT = 16;

const topic = (id: string, sortOrder: number, extra: Partial<Topic> = {}): Topic => ({
  id, name: id, colorKey: 'study', sortOrder, isOpen: true, deletedAt: null, ...extra,
});
const task = (id: string, topicId: string, sortOrder: number, extra: Partial<Task> = {}): Task => ({
  id, topicId, name: id, kind: 'timed', minutes: 30, repeatMask: THU_BIT, isDefault: true,
  cue: null, treat: null, note: '', sortOrder, deletedAt: null, defaultChangedAt: null, ...extra,
});
const dayTask = (id: string, extra: Partial<DayTask> = {}): DayTask => ({
  id, dayKey: THU, taskId: null, topicId: 'A', name: id, colorKey: 'study', kind: 'timed',
  budgetSec: 1800, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt: null,
  closeOutcome: null, sortOrder: 0, ...extra,
});
const day = (planConfirmedAt: number | null): Day => ({
  dayKey: THU, planConfirmedAt, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4,
});

const topics = [topic('B', 2, { colorKey: 'health' }), topic('A', 1)];
const rowsOf = (d: PlanDraft): PlanRow[] => [...d.groups.flatMap((g) => g.rows), ...d.notOn];
const find = (d: PlanDraft, key: string): PlanRow => rowsOf(d).find((r) => r.key === key)!;
const build = (tasks: Task[], dayV: Day | null = null, dayTasks: DayTask[] = [], tps = topics) =>
  buildPlan({ dayKey: THU, topics: tps, tasks, day: dayV, dayTasks });

describe('buildPlan, no confirmed plan (doc 04 §2 table)', () => {
  const tasks = [
    task('def', 'A', 1),
    task('rep', 'A', 2, { isDefault: false }),
    task('off', 'A', 3, { repeatMask: MON_BIT }),
  ];

  it('default / repeats / not on day', () => {
    const d = build(tasks);
    expect(find(d, 'def')).toMatchObject({ ticked: true, reason: 'default', dayTaskId: null, taskId: 'def' });
    expect(find(d, 'rep')).toMatchObject({ ticked: false, reason: 'repeats' });
    expect(find(d, 'off')).toMatchObject({ ticked: false, reason: 'not_on_day' });
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0].rows.map((r) => r.key)).toEqual(['def', 'rep']);
    expect(d.notOn.map((r) => r.key)).toEqual(['off']);
  });

  it('treats a day row with planConfirmedAt null like no plan; a prefilled row attaches to its library row', () => {
    const d = build(tasks, day(null), [dayTask('x', { taskId: 'def' })]);
    expect(find(d, 'def')).toMatchObject({ reason: 'default', ticked: true, dayTaskId: 'x' });
    expect(rowsOf(d).some((r) => r.key === 'x')).toBe(false);
  });

  it('forwarded rows land in their topic group, ticked, and replace the same library task', () => {
    const fw = dayTask('fw', { taskId: 'rep', topicId: 'A', forwardedFromDayKey: '2026-10-28', kind: 'check', budgetSec: 0 });
    const d = build(tasks, day(null), [fw]);
    expect(find(d, 'fw')).toMatchObject({
      ticked: true, reason: 'forwarded', dayTaskId: 'fw', forwardedFromDayKey: '2026-10-28', minutes: 30,
    });
    expect(rowsOf(d).filter((r) => r.taskId === 'rep')).toHaveLength(1);
    expect(d.groups[0].rows.map((r) => r.key)).toEqual(['def', 'fw']);
  });

  it('rows take minutes/cue/treat/color from the task and topic', () => {
    const d = build([task('t', 'B', 1, { minutes: 45, cue: 'c', treat: 'tr' })]);
    expect(find(d, 't')).toMatchObject({ minutes: 45, cue: 'c', treat: 'tr', colorKey: 'health', kind: 'timed' });
  });
});

describe('buildPlan + confirmPlan, prefilled rows on an unconfirmed day (doc 04 §3, check error 1)', () => {
  const tasks = [
    task('t', 'A', 1, { cue: 'libcue' }),
    task('r', 'A', 2, { isDefault: false }),
    task('off', 'A', 3, { repeatMask: MON_BIT }),
    task('chk', 'B', 1, { kind: 'check', minutes: 20 }),
  ];
  const sessions: Session[] = [{ id: 's1', dayTaskId: 'p', startedAt: 1, endedAt: 2 }];

  it('attached rows keep library key/reason/position with the day row values', () => {
    const dts = [
      dayTask('p', { taskId: 't', budgetSec: 2700, cue: 'daycue', treat: 'daytreat', sortOrder: 9 }),
      dayTask('pr', { taskId: 'r', sortOrder: 1 }),
      dayTask('po', { taskId: 'off', sortOrder: 2 }),
      dayTask('pc', { taskId: 'chk', topicId: 'B', kind: 'check', budgetSec: 0, sortOrder: 3 }),
    ];
    const d = build(tasks, day(null), dts);
    expect(find(d, 't')).toMatchObject({
      dayTaskId: 'p', ticked: true, reason: 'default', minutes: 45, cue: 'daycue', treat: 'daytreat', taskId: 't',
    });
    expect(find(d, 'r')).toMatchObject({ dayTaskId: 'pr', ticked: true, reason: 'repeats' });
    expect(find(d, 'off')).toMatchObject({ dayTaskId: 'po', ticked: true, reason: 'not_on_day' });
    expect(find(d, 'chk')).toMatchObject({ dayTaskId: 'pc', minutes: 20, kind: 'check' });
    expect(d.groups.map((g) => g.rows.map((r) => r.key))).toEqual([['t', 'r'], ['chk']]);
    expect(d.notOn.map((r) => r.key)).toEqual(['off']);
  });

  it('a prefilled row of a deleted task (or with no task) becomes a ticked saved row', () => {
    const ts = [task('gone', 'A', 1, { deletedAt: 5 })];
    const dts = [dayTask('pg', { taskId: 'gone' }), dayTask('one', { taskId: null, sortOrder: 1 })];
    const d = build(ts, day(null), dts);
    expect(rowsOf(d).map((r) => [r.key, r.reason, r.ticked, r.dayTaskId])).toEqual([
      ['pg', 'saved', true, 'pg'], ['one', 'saved', true, 'one'],
    ]);
  });

  it('(1) prefilled row WITH a session: no insert for that taskId, an update instead', () => {
    const p = dayTask('p', { taskId: 't', sortOrder: 4 });
    const d = build(tasks, day(null), [p]);
    expect(find(d, 't').dayTaskId).toBe('p');
    const out = confirmPlan(d, [p], sessions);
    expect(out.insert.some((r) => r.taskId === 't')).toBe(false);
    expect(out.update).toEqual([{ ...p, budgetSec: 1800, cue: null, treat: null, sortOrder: 0 }]);
    expect(out.deleteIds).toEqual([]);
    expect(out.insert.map((r) => r.taskId)).toEqual(['chk']);
  });

  it('(2) prefilled row without progress: update, not delete + insert', () => {
    const p = dayTask('p', { taskId: 't', budgetSec: 2400 });
    const d = stepMinutes(build(tasks, day(null), [p]), 't', 5);
    const out = confirmPlan(d, [p], []);
    expect(out.update).toEqual([{ ...p, budgetSec: 45 * 60, sortOrder: 0 }]);
    expect(out.deleteIds).toEqual([]);
    expect(out.insert.some((r) => r.taskId === 't')).toBe(false);
  });

  it('(3) unticking a prefilled row without progress deletes it, with no insert', () => {
    const p = dayTask('p', { taskId: 't' });
    const d = setTicked(build(tasks, day(null), [p]), 't', false);
    const out = confirmPlan(d, [p], []);
    expect(out.deleteIds).toEqual(['p']);
    expect(out.update).toEqual([]);
    expect(out.insert.some((r) => r.taskId === 't')).toBe(false);
  });

  it('unticking a prefilled row WITH a session keeps it untouched', () => {
    const p = dayTask('p', { taskId: 't' });
    const out = confirmPlan(setTicked(build(tasks, day(null), [p]), 't', false), [p], sessions);
    expect(out).toEqual({ insert: [expect.objectContaining({ taskId: 'chk' })], update: [], deleteIds: [] });
  });
});

describe('library filtering and ordering', () => {
  it('drops deleted and blank-named tasks and tasks of unknown topics; orders by sortOrder', () => {
    const tasks = [
      task('b2', 'B', 2), task('b1', 'B', 1), task('a1', 'A', 1),
      task('gone', 'A', 2, { deletedAt: 1 }), task('blank', 'A', 3, { name: '   ' }),
      task('orph', 'Z', 1),
    ];
    const d = build(tasks);
    expect(d.groups.map((g) => g.topicId)).toEqual(['A', 'B']);
    expect(d.groups[1].rows.map((r) => r.key)).toEqual(['b1', 'b2']);
    expect(rowsOf(d).map((r) => r.key).sort()).toEqual(['a1', 'b1', 'b2']);
  });

  it('omits topics with no rows and deleted topics', () => {
    const d = build([task('b1', 'B', 1), task('c1', 'C', 1)], null, [], [topic('A', 1), topic('B', 2), topic('C', 0, { deletedAt: 5 })]);
    expect(d.groups.map((g) => g.topicId)).toEqual(['B']);
  });

  it('notOn is ordered by topic then task', () => {
    const d = build([
      task('b', 'B', 1, { repeatMask: MON_BIT }), task('a2', 'A', 2, { repeatMask: MON_BIT }),
      task('a1', 'A', 1, { repeatMask: MON_BIT }),
    ]);
    expect(d.notOn.map((r) => r.key)).toEqual(['a1', 'a2', 'b']);
  });

  it('weekday mapping uses repeatMask for the target dayKey', () => {
    const t = task('f', 'A', 1, { repeatMask: FRI_BIT });
    expect(buildPlan({ dayKey: '2026-10-30', topics, tasks: [t], day: null, dayTasks: [] }).groups[0].rows[0].reason).toBe('default');
    expect(buildPlan({ dayKey: THU, topics, tasks: [t], day: null, dayTasks: [] }).notOn).toHaveLength(1);
    const sun = task('s', 'A', 1, { repeatMask: 64 });
    expect(buildPlan({ dayKey: '2026-11-01', topics, tasks: [sun], day: null, dayTasks: [] }).groups).toHaveLength(1);
  });
});

describe('buildPlan, confirmed plan', () => {
  const tasks = [
    task('t1', 'A', 1), task('t2', 'A', 2, { isDefault: false }), task('t3', 'A', 3, { repeatMask: MON_BIT }),
    task('t4', 'A', 4),
  ];

  it('saved rows are ticked with per-day values; the rest appear unticked', () => {
    const dts = [
      dayTask('d1', { taskId: 't1', budgetSec: 2700, cue: 'cue', treat: 'tr', sortOrder: 0 }),
      dayTask('d2', { topicId: 'B', colorKey: 'health', name: 'once', sortOrder: 1 }),
      dayTask('d3', { taskId: 't4', kind: 'check', budgetSec: 0 }),
    ];
    const d = build(tasks, day(100), dts);
    expect(find(d, 'd1')).toMatchObject({ ticked: true, reason: 'saved', minutes: 45, cue: 'cue', treat: 'tr', dayTaskId: 'd1', taskId: 't1' });
    expect(find(d, 'd2')).toMatchObject({ ticked: true, reason: 'saved', taskId: null, topicId: 'B' });
    expect(find(d, 'd3')).toMatchObject({ ticked: true, minutes: 30, kind: 'check' });
    expect(find(d, 't2')).toMatchObject({ ticked: false, reason: 'repeats', dayTaskId: null });
    expect(find(d, 't3')).toMatchObject({ ticked: false, reason: 'not_on_day' });
    expect(rowsOf(d).some((r) => r.key === 't1' || r.key === 't4')).toBe(false);
    expect(d.notOn.map((r) => r.key)).toEqual(['t3']);
  });

  it('an unticked default stays unticked and keeps the default reason', () => {
    const d = build(tasks, day(100), [dayTask('d2', { taskId: 't2' })]);
    expect(find(d, 't1')).toMatchObject({ ticked: false, reason: 'default' });
  });

  it('forwarded rows keep their reason; one-offs after library rows; check minutes fall back to 15', () => {
    const dts = [
      dayTask('f', { forwardedFromDayKey: '2026-10-28', kind: 'check', budgetSec: 0, sortOrder: 0 }),
      dayTask('o', { sortOrder: 1 }),
      dayTask('l', { taskId: 't2', sortOrder: 2 }),
    ];
    const d = build(tasks, day(100), dts);
    expect(find(d, 'f')).toMatchObject({ reason: 'forwarded', minutes: 15 });
    expect(d.groups[0].rows.map((r) => r.key)).toEqual(['t1', 'l', 't4', 'f', 'o']);
  });

  it('a deleted task whose day row exists stays as a saved row; a deleted task without a row does not', () => {
    const ts = [task('t1', 'A', 1, { deletedAt: 9 }), task('t2', 'A', 2, { deletedAt: 9 })];
    const d = build(ts, day(100), [dayTask('d1', { taskId: 't1' })]);
    expect(rowsOf(d).map((r) => r.key)).toEqual(['d1']);
    expect(find(d, 'd1').reason).toBe('saved');
  });

  it('a deleted task referenced only by a forwarded row keeps that row', () => {
    const ts = [task('t1', 'A', 1, { deletedAt: 9 })];
    const d = build(ts, null, [dayTask('f', { taskId: 't1', forwardedFromDayKey: '2026-10-28' })]);
    expect(rowsOf(d).map((r) => r.key)).toEqual(['f']);
  });

  it('topics referenced only by dayTasks (deleted or unknown) get groups at the end, in order', () => {
    const tps = [topic('A', 1), topic('X', 2, { deletedAt: 3 })];
    const dts = [
      dayTask('x1', { topicId: 'X', sortOrder: 0 }),
      dayTask('a1', { topicId: 'A', sortOrder: 1 }),
      dayTask('q', { topicId: 'Q', sortOrder: 2 }),
    ];
    const d = build([], day(1), dts, tps);
    expect(d.groups.map((g) => g.topicId)).toEqual(['A', 'X', 'Q']);
  });

  it('caps big saved budgets and keeps small or off-grid ones (carried time, ADR-014)', () => {
    const d = build([], day(1), [
      dayTask('big', { budgetSec: 99999 * 60 }), dayTask('small', { budgetSec: 60 }), dayTask('odd', { budgetSec: 13 * 60 }),
    ]);
    expect(find(d, 'big').minutes).toBe(180);
    expect(find(d, 'small').minutes).toBe(1);
    expect(find(d, 'odd').minutes).toBe(13);
  });

  it('confirming a plan keeps a carried 2-minute row at 2 minutes', () => {
    const p = dayTask('p', { taskId: 't', budgetSec: 2 * 60, forwardedFromDayKey: '2026-10-28' });
    const out = confirmPlan(build([task('t', 'A', 0)], day(null), [p]), [p], []);
    expect(out.update).toEqual([{ ...p, budgetSec: 2 * 60, sortOrder: 0 }]);
  });

  it('stepping an off-grid length snaps to the grid in that direction', () => {
    const d = build([], day(1), [dayTask('odd', { budgetSec: 13 * 60 }), dayTask('tiny', { budgetSec: 2 * 60 })]);
    expect(find(stepMinutes(d, 'odd', 5), 'odd').minutes).toBe(15);
    expect(find(stepMinutes(d, 'odd', -5), 'odd').minutes).toBe(10);
    expect(find(stepMinutes(d, 'tiny', 5), 'tiny').minutes).toBe(5);
    expect(find(stepMinutes(d, 'tiny', -5), 'tiny').minutes).toBe(2);
  });
});

describe('editors', () => {
  const base = build([task('t', 'A', 1), task('off', 'A', 2, { repeatMask: MON_BIT })]);

  it('are immutable and edit one row', () => {
    const snap = JSON.stringify(base);
    const d = setCue(setTreat(setTicked(base, 't', false), 't', 'tea'), 't', 'after coffee');
    expect(JSON.stringify(base)).toBe(snap);
    expect(find(d, 't')).toMatchObject({ ticked: false, treat: 'tea', cue: 'after coffee' });
    expect(find(setCue(d, 't', null), 't').cue).toBeNull();
  });

  it('unknown key returns the same draft', () => {
    expect(setTicked(base, 'nope', true)).toBe(base);
    expect(stepMinutes(base, 'nope', 5)).toBe(base);
    expect(setCue(base, 'nope', 'x')).toBe(base);
    expect(setTreat(base, 'nope', 'x')).toBe(base);
  });

  it('ticking a notOn row keeps it in notOn', () => {
    const d = setTicked(base, 'off', true);
    expect(d.notOn[0]).toMatchObject({ key: 'off', ticked: true });
    expect(d.groups[0].rows.map((r) => r.key)).toEqual(['t']);
  });

  it('stepMinutes steps and clamps to 5..180', () => {
    expect(find(stepMinutes(base, 't', 5), 't').minutes).toBe(35);
    expect(find(stepMinutes(base, 't', -5), 't').minutes).toBe(25);
    let d = base;
    for (let i = 0; i < 40; i++) d = stepMinutes(d, 't', 5);
    expect(find(d, 't').minutes).toBe(180);
    for (let i = 0; i < 60; i++) d = stepMinutes(d, 't', -5);
    expect(find(d, 't').minutes).toBe(5);
    expect(find(stepMinutes(base, 'off', -5), 'off').minutes).toBe(25);
  });
});

describe('addOneOff', () => {
  const base = build([task('t', 'A', 1)]);
  const spec = { topicId: 'A', name: ' Call bank ', colorKey: 'study' as const, kind: 'check' as const, minutes: 15 };

  it('adds a ticked one_off row to the topic group with unique keys', () => {
    const d1 = addOneOff(base, spec);
    const d2 = addOneOff(d1, { ...spec, name: 'Second' });
    expect(d2.groups[0].rows.map((r) => r.key)).toEqual(['t', 'oneoff:1', 'oneoff:2']);
    expect(find(d2, 'oneoff:1')).toMatchObject({
      name: 'Call bank', ticked: true, reason: 'one_off', taskId: null, dayTaskId: null, forwardedFromDayKey: null, kind: 'check',
    });
    expect(base.groups[0].rows).toHaveLength(1);
  });

  it('creates a group for a topic with no rows yet, and clamps minutes', () => {
    const d = addOneOff(base, { ...spec, topicId: 'B', kind: 'timed', minutes: 500 });
    expect(d.groups.map((g) => g.topicId)).toEqual(['A', 'B']);
    expect(find(d, 'oneoff:1').minutes).toBe(180);
    expect(find(addOneOff(base, { ...spec, minutes: 1 }), 'oneoff:1').minutes).toBe(5);
  });

  it('leaves other groups untouched', () => {
    const two = build([task('t', 'A', 1), task('u', 'B', 1)]);
    const d = addOneOff(two, spec);
    expect(d.groups[1]).toBe(two.groups[1]);
    expect(d.groups[0].rows).toHaveLength(2);
  });

  it('ignores blank names', () => {
    expect(addOneOff(base, { ...spec, name: '  ' })).toBe(base);
  });

  it('numbers after the highest existing key', () => {
    const d = addOneOff(base, spec);
    const renamed: PlanDraft = {
      ...d,
      groups: [{ ...d.groups[0], rows: d.groups[0].rows.map((r) => (r.key === 'oneoff:1' ? { ...r, key: 'oneoff:7' } : r)) }],
    };
    expect(addOneOff(renamed, spec).groups[0].rows.at(-1)!.key).toBe('oneoff:8');
  });
});

describe('canConfirm', () => {
  it('needs at least one ticked row', () => {
    const d = build([task('t', 'A', 1, { isDefault: false }), task('off', 'A', 2, { repeatMask: MON_BIT })]);
    expect(canConfirm(d)).toBe(false);
    expect(canConfirm(setTicked(d, 'off', true))).toBe(true);
    expect(canConfirm({ dayKey: THU, groups: [], notOn: [] })).toBe(false);
  });
});

describe('confirmPlan', () => {
  it('inserts ticked new rows as snapshots with sortOrder = overall position', () => {
    const tasks = [
      task('a', 'A', 1), task('b', 'A', 2, { isDefault: false }),
      task('c', 'B', 1, { kind: 'check', minutes: 20, cue: 'q', treat: 'r' }),
    ];
    const out = confirmPlan(build(tasks), [], []);
    expect(out.update).toEqual([]);
    expect(out.deleteIds).toEqual([]);
    expect(out.insert).toEqual([
      { dayKey: THU, taskId: 'a', topicId: 'A', name: 'a', colorKey: 'study', kind: 'timed', budgetSec: 1800, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null, sortOrder: 0 },
      { dayKey: THU, taskId: 'c', topicId: 'B', name: 'c', colorKey: 'health', kind: 'check', budgetSec: 0, cue: 'q', treat: 'r', note: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null, sortOrder: 2 },
    ]);
  });

  it('updates ticked existing rows (keeping other fields), deletes unticked ones', () => {
    const dts = [
      dayTask('d1', { taskId: 't1', sortOrder: 5 }),
      dayTask('d2', { taskId: 't2', sortOrder: 6 }),
      dayTask('gone', { taskId: null, sortOrder: 7 }),
    ];
    let d = build([task('t1', 'A', 1), task('t2', 'A', 2)], day(1), dts);
    d = stepMinutes(setCue(d, 'd1', 'new'), 'd1', 5);
    d = setTicked(d, 'd2', false);
    d = setTicked(d, 'gone', false);
    const out = confirmPlan(d, dts, []);
    expect(out.update).toEqual([{ ...dts[0], budgetSec: 35 * 60, cue: 'new', sortOrder: 0 }]);
    expect(out.deleteIds.sort()).toEqual(['d2', 'gone']);
    expect(out.insert).toEqual([]);
  });

  it('check rows get budgetSec 0 even though they keep minutes', () => {
    const dts = [dayTask('c', { kind: 'check', budgetSec: 0 })];
    const d = build([], day(1), dts);
    expect(find(d, 'c').minutes).toBe(15);
    expect(confirmPlan(d, dts, []).update[0].budgetSec).toBe(0);
  });

  it('keeps unticked rows that have a session or completedAt (no delete, no update)', () => {
    const dts = [dayTask('s', { sortOrder: 0 }), dayTask('c', { completedAt: 5, sortOrder: 1 }), dayTask('n', { sortOrder: 2 })];
    const sessions: Session[] = [{ id: 'x', dayTaskId: 's', startedAt: 1, endedAt: 2 }];
    let d = build([], day(1), dts);
    for (const k of ['s', 'c', 'n']) d = setTicked(d, k, false);
    d = addOneOff(d, { topicId: 'A', name: 'new', colorKey: 'study', kind: 'timed', minutes: 10 });
    const out = confirmPlan(d, dts, sessions);
    expect(out.deleteIds).toEqual(['n']);
    expect(out.update).toEqual([]);
    expect(out.insert).toHaveLength(1);
    expect(out.insert[0].sortOrder).toBe(3);
  });

  it('a ticked row with progress is still updated', () => {
    const dts = [dayTask('s')];
    const d = stepMinutes(build([], day(1), dts), 's', -5);
    const out = confirmPlan(d, dts, [{ id: 'x', dayTaskId: 's', startedAt: 1, endedAt: null }]);
    expect(out.update[0].budgetSec).toBe(25 * 60);
    expect(out.deleteIds).toEqual([]);
  });

  it('(4) guard: an insert whose taskId exists in `existing` becomes an update; duplicates are dropped', () => {
    const p = dayTask('p', { taskId: 't', completedAt: 7, sortOrder: 3 });
    const q = dayTask('q', { taskId: 'u', sortOrder: 4 });
    const row = (key: string, taskId: string | null, dayTaskId: string | null, minutes = 20): PlanRow => ({
      key, taskId, topicId: 'A', name: key, colorKey: 'study', kind: 'timed', minutes, cue: 'c', treat: null, note: null,
      ticked: true, reason: 'default', forwardedFromDayKey: null, dayTaskId,
    });
    const draft: PlanDraft = {
      dayKey: THU,
      groups: [{
        topicId: 'A',
        rows: [
          row('t', 't', null),        // no dayTaskId, but taskId t exists as p -> update p
          row('t2', 't', null, 40),   // second row for t -> p already updated -> dropped
          row('u1', 'u', null),       // taskId u exists as q, but q is claimed by u2 -> dropped
          row('u2', 'u', 'q', 25),    // q via dayTaskId -> update q
          row('n', 'new', null),      // genuinely new -> insert
          row('o', null, null),       // one-off -> insert
        ],
      }],
      notOn: [],
    };
    const out = confirmPlan(draft, [p, q], []);
    expect(out.update).toEqual([
      { ...p, budgetSec: 1200, cue: 'c', sortOrder: 0 },
      { ...q, budgetSec: 1500, cue: 'c', sortOrder: 3 },
    ]);
    expect(out.insert.map((r) => [r.taskId, r.sortOrder])).toEqual([['new', 4], [null, 5]]);
    expect(out.deleteIds).toEqual([]);
  });

  it('inserts forwarded rows with forwardedFromDayKey when they are not in existing', () => {
    const fw = dayTask('f', { forwardedFromDayKey: '2026-10-28', kind: 'check', budgetSec: 0 });
    const out = confirmPlan(build([], null, [fw]), [], []);
    expect(out.insert[0]).toMatchObject({ forwardedFromDayKey: '2026-10-28', completedAt: null });
  });
});

describe('plannableDays', () => {
  it('tomorrow only once today is closed (confirmed or not)', () => {
    expect(plannableDays(THU, { ...day(1), closedAt: 5, closedBy: 'user' })).toEqual(['2026-10-30']);
    expect(plannableDays(THU, { ...day(null), closedAt: 5, closedBy: 'auto' })).toEqual(['2026-10-30']);
  });
  it('today stays plannable while open, even after its plan was confirmed (ADR-009)', () => {
    expect(plannableDays(THU, day(1))).toEqual([THU, '2026-10-30']);
  });
  it('today and tomorrow when today has no plan', () => {
    expect(plannableDays(THU, null)).toEqual([THU, '2026-10-30']);
    expect(plannableDays(THU, day(null))).toEqual([THU, '2026-10-30']);
  });
  it('crosses month ends', () => {
    expect(plannableDays('2026-10-31', null)).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('prefillUnplanned', () => {
  it('returns default rows as drafts, skipping non-default, not-on and forwarded rows', () => {
    const tasks = [
      task('a', 'A', 1), task('b', 'A', 2, { isDefault: false }),
      task('c', 'A', 3, { repeatMask: MON_BIT }), task('e', 'B', 1),
    ];
    const fw = dayTask('f', { forwardedFromDayKey: '2026-10-28', kind: 'check', budgetSec: 0 });
    const out = prefillUnplanned({ dayKey: THU, topics, tasks, day: null, dayTasks: [fw] });
    expect(out.map((r) => r.taskId)).toEqual(['a', 'e']);
    expect(out.every((r) => r.forwardedFromDayKey == null && r.completedAt == null)).toBe(true);
    // plan order: A group = a, b, f, then B's e at index 3
    expect(out.map((r) => r.sortOrder)).toEqual([0, 3]);
  });
  it('(5) is idempotent: a second call with the first result stored returns []', () => {
    const tasks = [task('a', 'A', 1), task('e', 'B', 1), task('b', 'A', 2, { isDefault: false })];
    const input = { dayKey: THU, topics, tasks, day: day(null), dayTasks: [] as DayTask[] };
    const first = prefillUnplanned(input);
    expect(first.map((r) => r.taskId)).toEqual(['a', 'e']);
    const stored = first.map((r, i) => ({ ...r, id: `p${i}` }));
    expect(prefillUnplanned({ ...input, dayTasks: stored })).toEqual([]);
    // Partly present: only the missing default is returned.
    expect(prefillUnplanned({ ...input, dayTasks: [stored[0]] }).map((r) => r.taskId)).toEqual(['e']);
  });
  it('is empty with no defaults', () => {
    expect(prefillUnplanned({ dayKey: THU, topics, tasks: [], day: null, dayTasks: [] })).toEqual([]);
  });
});

describe('drafts (ADR-010)', () => {
  it('draftableDays: [today + 2 .. today + 365], never today or tomorrow', () => {
    const list = draftableDays(THU);
    expect(list[0]).toBe('2026-10-31');
    expect(list[list.length - 1]).toBe('2027-10-29');
    expect(list).toHaveLength(364);
    expect(list).not.toContain(THU);
    expect(list).not.toContain('2026-10-30');
  });
  it('isDraftable agrees with the list and its edges', () => {
    expect(isDraftable(THU, THU)).toBe(false);
    expect(isDraftable(THU, '2026-10-30')).toBe(false);
    expect(isDraftable(THU, '2026-10-31')).toBe(true);
    expect(isDraftable(THU, '2027-10-29')).toBe(true);
    expect(isDraftable(THU, '2027-10-30')).toBe(false);
    expect(isDraftable(THU, '2026-10-01')).toBe(false);
  });
  it('buildPlan shows a draft like a confirmed plan: saved rows ticked, no defaults re-added', () => {
    const tasks = [task('def', 'A', 1), task('other', 'A', 2, { isDefault: false })];
    const drafted: Day = { ...day(null), planDraftedAt: 5 };
    const d = build(tasks, drafted, [dayTask('x', { taskId: 'other' })]);
    expect(find(d, 'x')).toMatchObject({ ticked: true, reason: 'saved', dayTaskId: 'x' });
    expect(find(d, 'def')).toMatchObject({ ticked: false });
    // an unplanned, undrafted day would have pre-ticked the default
    expect(find(build(tasks, day(null)), 'def').ticked).toBe(true);
  });
});

describe('default changed after the plan (chunk 9)', () => {
  const confirmed = (at: number): Day => day(at);
  const drafted = (at: number): Day => ({ ...day(null), planDraftedAt: at });

  it('default turned on after confirmation: a repeating library task shows ticked ("default")', () => {
    const d = build([task('b', 'A', 1, { isDefault: true, defaultChangedAt: 200 })], confirmed(100), [dayTask('x', { taskId: null })]);
    expect(find(d, 'b')).toMatchObject({ ticked: true, reason: 'default', dayTaskId: null });
  });
  it('default turned on before (or at) confirmation stays unticked: the user unticked it', () => {
    const before = build([task('b', 'A', 1, { defaultChangedAt: 50 })], confirmed(100), [dayTask('x', { taskId: null })]);
    const same = build([task('b', 'A', 1, { defaultChangedAt: 100 })], confirmed(100), [dayTask('x', { taskId: null })]);
    const never = build([task('b', 'A', 1)], confirmed(100), [dayTask('x', { taskId: null })]);
    for (const p of [before, same, never]) expect(find(p, 'b')).toMatchObject({ ticked: false, reason: 'default' });
  });
  it('default turned on after, but the task does not repeat that day: nothing', () => {
    const d = build([task('b', 'A', 1, { repeatMask: MON_BIT, defaultChangedAt: 200 })], confirmed(100), []);
    expect(find(d, 'b')).toMatchObject({ ticked: false, reason: 'not_on_day' });
  });
  it('a task whose default was turned off after: its saved row shows unticked', () => {
    const t = task('c', 'A', 1, { isDefault: false, defaultChangedAt: 200 });
    const d = build([t], confirmed(100), [dayTask('c1', { taskId: 'c' })]);
    expect(find(d, 'c1')).toMatchObject({ ticked: false, reason: 'saved', dayTaskId: 'c1' });
  });
  it('turned off after, but the row is finished or forwarded: stays ticked', () => {
    const t = task('c', 'A', 1, { isDefault: false, defaultChangedAt: 200 });
    const done = build([t], confirmed(100), [dayTask('c1', { taskId: 'c', completedAt: 150 })]);
    const fwd = build([t], confirmed(100), [dayTask('c1', { taskId: 'c', forwardedFromDayKey: '2026-10-28' })]);
    expect(find(done, 'c1').ticked).toBe(true);
    expect(find(fwd, 'c1').ticked).toBe(true);
  });
  it('a non-default task the user ticked stays ticked; other edits never move a tick', () => {
    const t = task('n', 'A', 1, { isDefault: false, defaultChangedAt: 50, name: 'renamed', minutes: 45 });
    const d = build([t], confirmed(100), [dayTask('n1', { taskId: 'n' })]);
    expect(find(d, 'n1').ticked).toBe(true);
    const nul = build([task('m', 'A', 1, { isDefault: false })], confirmed(100), [dayTask('m1', { taskId: 'm' })]);
    expect(find(nul, 'm1').ticked).toBe(true);
  });
  it('a default that stayed on keeps its saved row ticked', () => {
    const d = build([task('c', 'A', 1, { defaultChangedAt: 200 })], confirmed(100), [dayTask('c1', { taskId: 'c' })]);
    expect(find(d, 'c1').ticked).toBe(true);
  });
  it('the last save (planUpdatedAt) is the plan time when set: a re-confirm after the change wins', () => {
    const reconfirmed: Day = { ...confirmed(100), planUpdatedAt: 300 };
    const on = build([task('b', 'A', 1, { isDefault: true, defaultChangedAt: 200 })], reconfirmed, [dayTask('x', { taskId: null })]);
    expect(find(on, 'b').ticked).toBe(false);
    const off = build([task('c', 'A', 1, { isDefault: false, defaultChangedAt: 200 })], reconfirmed, [dayTask('c1', { taskId: 'c' })]);
    expect(find(off, 'c1').ticked).toBe(true);
    const after = build([task('b', 'A', 1, { isDefault: true, defaultChangedAt: 400 })], reconfirmed, [dayTask('x', { taskId: null })]);
    expect(find(after, 'b').ticked).toBe(true);
  });
  it('same rules for a drafted day', () => {
    const on = build([task('b', 'A', 1, { defaultChangedAt: 200 })], drafted(100), []);
    expect(find(on, 'b')).toMatchObject({ ticked: true, reason: 'default' });
    const off = build([task('c', 'A', 1, { isDefault: false, defaultChangedAt: 200 })], drafted(100), [dayTask('c1', { taskId: 'c' })]);
    expect(find(off, 'c1').ticked).toBe(false);
  });
  it('Confirm drops an unticked not-started row and inserts a newly ticked default', () => {
    const tasks = [
      task('b', 'A', 1, { defaultChangedAt: 200 }),
      task('c', 'A', 2, { isDefault: false, defaultChangedAt: 200 }),
    ];
    const existing = [dayTask('c1', { taskId: 'c' })];
    const r = confirmPlan(build(tasks, confirmed(100), existing), existing, []);
    expect(r.insert.map((i) => i.taskId)).toEqual(['b']);
    expect(r.deleteIds).toEqual(['c1']);
  });
});

describe('day notes (ADR-011)', () => {
  const lib = task('t', 'A', 1, { note: 'general: bring the book' });

  it('a new row starts with no day note; the library note is never copied in', () => {
    expect(find(build([lib]), 't').note).toBeNull();
  });

  it('setNote edits one row, blank becomes null, and the draft is not mutated', () => {
    const base = build([lib]);
    const snap = JSON.stringify(base);
    const d = setNote(base, 't', 'start with ch 3');
    expect(JSON.stringify(base)).toBe(snap);
    expect(find(d, 't').note).toBe('start with ch 3');
    expect(find(setNote(d, 't', '   '), 't').note).toBeNull();
    expect(setNote(base, 'nope', 'x')).toBe(base);
  });

  it('confirm writes the note on insert (library row and one-off); the library task is untouched', () => {
    let d = setNote(build([lib]), 't', 'ch 3 only');
    d = addOneOff(d, { topicId: 'A', name: 'Call', colorKey: 'study', kind: 'check', minutes: 5 });
    d = setNote(d, 'oneoff:1', 'ask about the fee');
    const r = confirmPlan(d, [], []);
    expect(r.insert.map((i) => [i.name, i.note])).toEqual([['t', 'ch 3 only'], ['Call', 'ask about the fee']]);
    expect(lib.note).toBe('general: bring the book');
  });

  it('an existing day row keeps its note in the plan, is edited, and the update carries it', () => {
    const ex = dayTask('d1', { taskId: 't', note: 'from yesterday' });
    const d = build([lib], day(5), [ex]);
    expect(find(d, 'd1').note).toBe('from yesterday');
    const kept = confirmPlan(d, [ex], []);
    expect(kept.update[0].note).toBe('from yesterday');
    const edited = confirmPlan(setNote(d, 'd1', 'changed'), [ex], []);
    expect(edited.update[0].note).toBe('changed');
    expect(confirmPlan(setNote(d, 'd1', ''), [ex], []).update[0].note).toBeNull();
  });

  it('an unconfirmed day attaches its prefilled row note to the library row', () => {
    const ex = dayTask('d1', { taskId: 't', note: 'prefilled' });
    expect(find(build([lib], null, [ex]), 't').note).toBe('prefilled');
  });
});

describe('addOneOff note (chunk 12)', () => {
  const base = build([task('t', 'A', 1)]);
  const spec = { topicId: 'A', name: 'Call bank', colorKey: 'study' as const, kind: 'check' as const, minutes: 15 };

  it('stores the note on the new row; blank or missing becomes null', () => {
    expect(find(addOneOff(base, { ...spec, note: 'ask about the fee' }), 'oneoff:1').note).toBe('ask about the fee');
    expect(find(addOneOff(base, { ...spec, note: '  ' }), 'oneoff:1').note).toBeNull();
    expect(find(addOneOff(base, spec), 'oneoff:1').note).toBeNull();
  });
});
