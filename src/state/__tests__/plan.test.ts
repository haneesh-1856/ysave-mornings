import { act, renderHook } from '@testing-library/react-native';
import { getDay, loadDayBundle, setCheckCompleted } from '../../data/repos/days';
import { applyOps } from '../../data/repos/ops';
import { setDayStartHour } from '../../data/repos/settings';
import { getTask } from '../../data/repos/tasks';
import { startSession } from '../../data/repos/sessions';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import type { PlanDraft } from '../../domain/plan';
import { confirmDayPlan, setTaskNoteFromPlan } from '../actions/plan';
import { createTask, createTopic, removeTask } from '../actions/library';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { useDayPlan } from '../hooks/useDayPlan';
import { usePlanDraft } from '../hooks/usePlanDraft';
import { usePlannableDays } from '../hooks/usePlannableDays';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { bump } from '../store';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30'; // Friday
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;

let db: DB;
beforeEach(() => {
  db = setupState(NOW);
});
afterEach(teardownState);

/** Math topic: Daily (default, every day), Weekend (repeats Sat only), Optional (repeats Fri, not default). */
function seed() {
  const math = createTopic({ name: 'Math', colorKey: 'study' });
  const daily = createTask(math.id, { name: 'Daily', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  const weekend = createTask(math.id, { name: 'Weekend', kind: 'timed', minutes: 45, repeatMask: 1 << 5 });
  const check = createTask(math.id, { name: 'Check', kind: 'check', minutes: 15, repeatMask: 127, isDefault: true });
  return { math, daily, weekend, check };
}

/** Confirmed rows are keyed by dayTask id, not task id. */
const keyOf = (d: PlanDraft, taskId: string) => rows(d).find(r => r.taskId === taskId)!.key;
const rows = (d: PlanDraft) => [...d.groups.flatMap(g => g.rows), ...d.notOn];

/** Closes today in the db (creating its day row if missing), as M5's close will. */
function closeToday() {
  const exists = getDay(db, TODAY) != null;
  const closed = { dayKey: TODAY, closedAt: NOW, closedBy: 'user' as const };
  applyOps(
    db,
    {
      closeSessions: [], completions: [], outcomes: [], insertDayTasks: [], forwardDayTasks: [],
      createDays: exists ? [] : [{ ...closed, planConfirmedAt: null, planDraftedAt: null, dayStartHour: 4 }],
      closeDays: exists ? [closed] : [],
    },
    () => 'x',
    NOW,
  );
}

describe('usePlannableDays', () => {
  it('offers today and tomorrow while today is unplanned', async () => {
    const { result } = await renderHook(() => usePlannableDays());
    expect(result.current).toEqual({ todayKey: TODAY, days: [TODAY, TOMORROW] });
  });

  it('keeps today after it is planned (ADR-009), and never a past day', async () => {
    seed();
    const { result } = await renderHook(() => usePlannableDays());
    const draft = (await renderHook(() => usePlanDraft(TODAY))).result.current.draft!;
    await act(async () => {
      confirmDayPlan(TODAY, draft);
    });
    expect(result.current.days).toEqual([TODAY, TOMORROW]);
    expect(result.current.days).not.toContain('2026-10-28');
  });

  it('offers only tomorrow once today is closed', async () => {
    seed();
    closeToday();
    expect((await renderHook(() => usePlannableDays())).result.current.days).toEqual([TOMORROW]);
  });
});

describe('usePlanDraft', () => {
  it('builds from the library: defaults ticked, other-weekday tasks under Not on', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW)); // Friday
    const d = result.current.draft!;
    expect(result.current.plannable).toBe(true);
    expect(d.groups[0].rows.map(r => [r.name, r.ticked])).toEqual([
      ['Daily', true],
      ['Check', true],
    ]);
    expect(d.notOn.map(r => [r.name, r.ticked, r.reason])).toEqual([['Weekend', false, 'not_on_day']]);
    expect(result.current.dirty).toBe(false);
    expect(result.current.canConfirm).toBe(true);
    expect(result.current.totals).toEqual({ count: 2, minutes: 30 });
  });

  it('editing is in memory only, marks dirty and updates totals', async () => {
    const { daily, weekend } = seed();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      result.current.toggle(weekend.id);
    });
    await act(async () => {
      result.current.step(daily.id, 5);
    });
    await act(async () => {
      result.current.setCue(daily.id, 'after tea');
    });
    await act(async () => {
      result.current.setTreat(daily.id, 'walk');
    });
    expect(result.current.dirty).toBe(true);
    const r = rows(result.current.draft!);
    expect(r.find(x => x.key === daily.id)).toMatchObject({ minutes: 35, cue: 'after tea', treat: 'walk' });
    expect(result.current.totals).toEqual({ count: 3, minutes: 35 + 45 });
    expect(loadDayBundle(db, TOMORROW)).toBeNull();
    expect(getDay(db, TOMORROW)).toBeNull();
  });

  it('toggle with an unknown key and a blank one-off change nothing material', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    const before = result.current.draft;
    await act(async () => {
      result.current.toggle('nope');
    });
    expect(rows(result.current.draft!)).toEqual(rows(before!));
  });

  it('one-off takes the topic colour and is ticked', async () => {
    const { math } = seed();
    const art = createTopic({ name: 'Art', colorKey: 'health' });
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      result.current.addOneOff({ topicId: art.id, name: 'Sketch', kind: 'timed', minutes: 20 });
    });
    const row = rows(result.current.draft!).find(r => r.name === 'Sketch')!;
    expect(row).toMatchObject({ colorKey: 'health', ticked: true, reason: 'one_off', taskId: null });
    expect(result.current.totals.count).toBe(3);
    await act(async () => {
      result.current.addOneOff({ topicId: 'missing', name: 'Ghost', kind: 'check', minutes: 5 });
    });
    expect(rows(result.current.draft!).some(r => r.name === 'Ghost')).toBe(false);
    expect(math.id).toBeTruthy();
  });

  it('is not plannable for a past day or beyond the draft horizon: draft null', async () => {
    seed();
    const past = await renderHook(() => usePlanDraft('2026-10-28'));
    expect(past.result.current).toMatchObject({ draft: null, plannable: false, dirty: false, canConfirm: false });
    const far = await renderHook(() => usePlanDraft('2027-11-02'));
    expect(far.result.current.draft).toBeNull();
    await act(async () => {
      far.result.current.toggle('x');
    });
    expect(far.result.current.dirty).toBe(false);
  });

  it('keeps a deleted task that a confirmed day still references', async () => {
    const { daily } = seed();
    const first = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, first.result.current.draft!);
    });
    removeTask(daily.id);
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    const row = rows(result.current.draft!).find(r => r.taskId === daily.id);
    expect(row).toMatchObject({ name: 'Daily', ticked: true, reason: 'saved' });
  });

  it('switching day starts a fresh draft', async () => {
    seed();
    const { result, rerender } = await renderHook((p: { k: string }) => usePlanDraft(p.k), {
      initialProps: { k: TOMORROW },
    });
    await act(async () => {
      result.current.toggle(rows(result.current.draft!)[0].key);
    });
    expect(result.current.dirty).toBe(true);
    await rerender({ k: TODAY });
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft!.dayKey).toBe(TODAY);
  });

  it('rebuilds when the stored plan changes underneath only while not dirty', async () => {
    const { daily } = seed();
    const clean = await renderHook(() => usePlanDraft(TOMORROW));
    const dirtyHook = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      dirtyHook.result.current.toggle(daily.id);
    });
    const other = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, other.result.current.draft!);
    });
    expect(rows(clean.result.current.draft!).every(r => r.reason === 'saved' || !r.ticked)).toBe(true);
    expect(rows(dirtyHook.result.current.draft!).find(r => r.key === daily.id)!.ticked).toBe(false);
  });
});

describe('usePlanDraft confirm()', () => {
  it('today unplanned: confirms and freezes the draft (stays plannable, not null)', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TODAY));
    const before = result.current;
    const confirm = before.confirm;
    await act(async () => {
      result.current.confirm();
    });
    expect(getDay(db, TODAY)!.planConfirmedAt).toBe(NOW); // written
    expect(result.current.draft).not.toBeNull();
    expect(result.current.draft).toEqual(before.draft);
    expect(result.current.plannable).toBe(true);
    expect(result.current.totals).toEqual(before.totals);
    expect(result.current.canConfirm).toBe(before.canConfirm);
    expect(result.current.confirm).toBe(confirm); // stable identity
    // a later unrelated 'days' write still does not rebuild it
    const other = (await renderHook(() => usePlanDraft(TOMORROW))).result.current.draft!;
    await act(async () => {
      confirmDayPlan(TOMORROW, other);
    });
    expect(result.current.draft).toEqual(before.draft);
    // a fresh mount sees the real state: today is still plannable (ADR-009) and loads the saved rows
    const fresh = (await renderHook(() => usePlanDraft(TODAY))).result.current;
    expect(fresh.plannable).toBe(true);
    expect(rows(fresh.draft!).filter(r => r.ticked).every(r => r.reason === 'saved')).toBe(true);
  });

  it('tomorrow clean: rows keep their reasons after confirm', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    const before = result.current;
    await act(async () => {
      result.current.confirm();
    });
    expect(loadDayBundle(db, TOMORROW)!.dayTasks).toHaveLength(2);
    expect(result.current.draft).toEqual(before.draft);
    expect(rows(result.current.draft!).some(r => r.reason === 'saved')).toBe(false);
    expect(result.current).toMatchObject({ plannable: true, dirty: false, totals: before.totals, canConfirm: true });
    // a fresh mount gets the saved rows
    const fresh = await renderHook(() => usePlanDraft(TOMORROW));
    expect(rows(fresh.result.current.draft!).filter(r => r.ticked).every(r => r.reason === 'saved')).toBe(true);
  });

  it('a failing confirm throws and does not freeze', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TODAY));
    const stale = result.current;
    // close today elsewhere, so this mount's confirm must fail
    await act(async () => {
      closeToday();
      bump('days');
    });
    expect(result.current.plannable).toBe(false); // not frozen: follows the store
    await act(async () => {
      expect(() => stale.confirm()).toThrow(ValidationError);
    });
    expect(result.current).toMatchObject({ draft: null, plannable: false });
  });

  it('a dirty draft is frozen as edited and later edits are ignored', async () => {
    seed();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      result.current.toggle(rows(result.current.draft!)[0].key);
    });
    const edited = result.current.draft;
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.draft).toBe(edited);
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      result.current.toggle(rows(result.current.draft!)[1].key); // frozen: edits ignored
    });
    expect(result.current.draft).toBe(edited);
  });
});

describe('confirmDayPlan', () => {
  it('writes rows, planConfirmedAt once, and the day-start snapshot', async () => {
    seed();
    setDayStartHour(db, 5, NOW);
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, result.current.draft!);
    });
    const b = loadDayBundle(db, TOMORROW)!;
    expect(b.dayTasks.map(t => [t.name, t.budgetSec])).toEqual([
      ['Daily', 1800],
      ['Check', 0],
    ]);
    expect(b.day.planConfirmedAt).toBe(NOW);
    expect(b.day.dayStartHour).toBe(5);
  });

  it('keeps planConfirmedAt on a re-confirm and keeps rows with progress', async () => {
    const { daily, check } = seed();
    const first = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, first.result.current.draft!);
    });
    const dts = loadDayBundle(db, TOMORROW)!.dayTasks;
    const checkRow = dts.find(t => t.taskId === check.id)!;
    setCheckCompleted(db, checkRow.id, NOW + 1, NOW + 1);

    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      result.current.toggle(keyOf(result.current.draft!, check.id));
    }); // untick the completed row: confirmPlan keeps it
    await act(async () => {
      result.current.toggle(keyOf(result.current.draft!, daily.id));
    });
    await act(async () => {
      confirmDayPlan(TOMORROW, result.current.draft!);
    });
    const b = loadDayBundle(db, TOMORROW)!;
    expect(b.dayTasks.map(t => t.taskId)).toEqual([check.id]);
    expect(b.day.planConfirmedAt).toBe(NOW);
  });

  it('keeps a row that has a session', async () => {
    const { daily } = seed();
    const first = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, first.result.current.draft!);
    });
    const row = loadDayBundle(db, TOMORROW)!.dayTasks.find(t => t.taskId === daily.id)!;
    startSession(db, { dayTaskId: row.id, closeSessionId: null, now: NOW, newId: () => 's1' });
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      result.current.toggle(keyOf(result.current.draft!, daily.id));
    });
    await act(async () => {
      confirmDayPlan(TOMORROW, result.current.draft!);
    });
    expect(loadDayBundle(db, TOMORROW)!.dayTasks.some(t => t.id === row.id)).toBe(true);
  });

  it('throws a ValidationError for a past day and writes nothing', () => {
    seed();
    const draft: PlanDraft = { dayKey: '2026-10-28', groups: [], notOn: [] };
    expect(() => confirmDayPlan('2026-10-28', draft)).toThrow(ValidationError);
    expect(getDay(db, '2026-10-28')).toBeNull();
  });

  it('refuses today once today is closed, and writes nothing', async () => {
    seed();
    const t = await renderHook(() => usePlanDraft(TODAY));
    const draft = t.result.current.draft!;
    closeToday();
    expect(() => confirmDayPlan(TODAY, draft)).toThrow(ValidationError);
    expect(loadDayBundle(db, TODAY)!.dayTasks).toHaveLength(0);
    expect(getDay(db, TODAY)!.planConfirmedAt).toBeNull();
  });

  it('re-plans today after confirming (ADR-009): rows with progress stay, planConfirmedAt unchanged', async () => {
    const { daily, check } = seed();
    const first = await renderHook(() => usePlanDraft(TODAY));
    await act(async () => {
      confirmDayPlan(TODAY, first.result.current.draft!);
    });
    const dts = loadDayBundle(db, TODAY)!.dayTasks;
    const dailyRow = dts.find(t => t.taskId === daily.id)!;
    const checkRow = dts.find(t => t.taskId === check.id)!;
    startSession(db, { dayTaskId: dailyRow.id, closeSessionId: null, now: NOW, newId: () => 's1' });

    const { result } = await renderHook(() => usePlanDraft(TODAY));
    expect(result.current.plannable).toBe(true);
    await act(async () => {
      result.current.toggle(keyOf(result.current.draft!, daily.id)); // has a session: kept
    });
    await act(async () => {
      result.current.toggle(keyOf(result.current.draft!, check.id)); // no progress: removed
    });
    setClockOverride(() => NOW + 60_000);
    await act(async () => {
      result.current.confirm();
    });
    const b = loadDayBundle(db, TODAY)!;
    expect(b.dayTasks.map(t => t.id)).toEqual([dailyRow.id]);
    expect(b.dayTasks.some(t => t.id === checkRow.id)).toBe(false);
    expect(b.day.planConfirmedAt).toBe(NOW);
  });

  it('bumps days so useDayPlan re-reads', async () => {
    seed();
    const plan = await renderHook(() => useDayPlan(TOMORROW));
    expect(plan.result.current.day).toBeNull();
    const { result } = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, result.current.draft!);
    });
    expect(plan.result.current.rows).toHaveLength(2);
  });
});

describe('setTaskNoteFromPlan', () => {
  it('edits the library task note', () => {
    const { daily } = seed();
    setTaskNoteFromPlan(daily.id, 'bring book');
    expect(getTask(db, daily.id)!.note).toBe('bring book');
  });
});

describe('useDayPlan', () => {
  it('returns an empty plan for a day without a row', async () => {
    const { result } = await renderHook(() => useDayPlan(TOMORROW));
    expect(result.current).toEqual({ day: null, rows: [], items: [] });
  });

  it('lists sorted rows and the planning marble first', async () => {
    seed();
    const draftHook = await renderHook(() => usePlanDraft(TOMORROW));
    await act(async () => {
      confirmDayPlan(TOMORROW, draftHook.result.current.draft!);
    });
    const { result } = await renderHook(() => useDayPlan(TOMORROW));
    expect(result.current.rows.map(r => r.sortOrder)).toEqual([0, 1]);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ kind: 'planning', colorKey: 'sun', at: NOW });
    expect(result.current.day!.dayKey).toBe(TOMORROW);
  });
});

describe('useSubmitGuard', () => {
  it('a double run calls fn once, returns its result and stays busy', async () => {
    const { result } = await renderHook(() => useSubmitGuard());
    const fn = jest.fn(() => 42);
    let first: number | undefined;
    let second: number | undefined;
    await act(async () => {
      first = result.current.run(fn);
      second = result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect([first, second]).toEqual([42, undefined]);
    expect(result.current.busy).toBe(true);
  });

  it('resets and rethrows when fn throws, so a retry works', async () => {
    const { result } = await renderHook(() => useSubmitGuard());
    await act(async () => {
      expect(() =>
        result.current.run(() => {
          throw new Error('boom');
        }),
      ).toThrow('boom');
    });
    expect(result.current.busy).toBe(false);
    let out: string | undefined;
    await act(async () => {
      out = result.current.run(() => 'ok');
    });
    expect(out).toBe('ok');
  });

  it('reset() re-arms the guard', async () => {
    const { result } = await renderHook(() => useSubmitGuard());
    await act(async () => {
      result.current.run(() => 1);
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.busy).toBe(false);
    let out: number | undefined;
    await act(async () => {
      out = result.current.run(() => 2);
    });
    expect(out).toBe(2);
  });
});
