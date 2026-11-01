import { loadDayBundle } from '../../data/repos/days';
import * as settingsRepo from '../../data/repos/settings';
import { getMomentMarkers, setMomentsEnabled, setMonthlyGoalHours } from '../../data/repos/settings';
import type { DB } from '../../data/types';
import { DEFAULT_MARKERS } from '../../domain/moments';
import { dayStartOf } from '../../domain/dayKey';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask, stopTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
const D1 = '2026-10-29';
const D2 = '2026-10-30';
const D3 = '2026-10-31';
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(at(D1));
  t = at(D1);
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  reconcile();
});
afterEach(() => teardownState());

/** Starts A today, runs it `minutes`, leaves it running (the close ends it at the close instant). Returns A id. */
function work(day: string, minutes: number): string {
  const a = loadDayBundle(db, day)!.dayTasks.find((d) => d.name === 'A')!;
  startTask(a.id);
  t += minutes * MIN;
  return a.id;
}
const kinds = (ms: { kind: string }[]) => ms.map((m) => m.kind);

describe('closeToday moments', () => {
  it('first close with the task unfinished: longest only (the day closes quietly), no record; sessions count up to the close instant', () => {
    work(D1, 10);
    const ms = closeToday(letGoAll());
    expect(kinds(ms)).toEqual(['longest']);
    expect(ms[0]).toMatchObject({ kind: 'longest', name: 'A', focusedMs: 10 * MIN, budgetSec: 1800 });
    expect(getMomentMarkers(db)).toEqual(DEFAULT_MARKERS);
  });

  it('a record on day 2 plays once and is saved; day 3 at the same total does not repeat it', () => {
    work(D1, 10);
    closeToday(letGoAll());
    t = at(D2);
    reconcile();
    work(D2, 20);
    const second = closeToday(letGoAll());
    expect(kinds(second)).toEqual(['longest', 'best']);
    expect(second[1]).toEqual({ kind: 'best', todayMs: 20 * MIN, previousBestMs: 10 * MIN });
    expect(getMomentMarkers(db).bestMs).toBe(20 * MIN);

    t = at(D3);
    reconcile();
    work(D3, 20);
    // D3 is the last day of October and no goal is set, so the month in review plays; no second record.
    expect(kinds(closeToday(letGoAll()))).toEqual(['longest', 'month']);
    expect(getMomentMarkers(db).bestMs).toBe(20 * MIN);
  });

  it('a monthly goal fires at the first close that reaches it, once, and saves the month', () => {
    setMonthlyGoalHours(db, 1, t);
    work(D1, 30);
    stopTask(loadDayBundle(db, D1)!.dayTasks[0].id);
    // The task ran its full 30 min, so every task is done: Day complete plays.
    expect(kinds(closeToday(letGoAll()))).toEqual(['longest', 'day']);

    t = at(D2);
    reconcile();
    work(D2, 30);
    const ms = closeToday(letGoAll());
    expect(ms.at(-1)).toEqual({ kind: 'month', monthKey: '2026-10', monthFocusMs: 60 * MIN, goalHours: 1, daysShowedUp: 2 });
    expect(getMomentMarkers(db).monthCelebrated).toBe('2026-10');

    t = at(D3);
    reconcile();
    work(D3, 30);
    expect(kinds(closeToday(letGoAll()))).not.toContain('month');
  });

  it('turned off: returns [] and leaves markers alone', () => {
    setMomentsEnabled(db, false, t);
    work(D1, 10);
    t = at(D1, 7);
    expect(closeToday(letGoAll())).toEqual([]);
    expect(getMomentMarkers(db)).toEqual(DEFAULT_MARKERS);
    expect(loadDayBundle(db, D1)!.day.closedAt).toBe(t);
  });

  it('auto-close produces no moments and touches no markers', () => {
    work(D1, 10);
    t = at('2026-11-02');
    const { autoClosed } = reconcile();
    expect(autoClosed.length).toBeGreaterThan(0);
    expect(getMomentMarkers(db)).toEqual(DEFAULT_MARKERS);
  });
});

describe('closeToday when the moments code fails', () => {
  it('still closes the day, plays none, and warns in development', () => {
    work(D1, 10);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const boom = jest.spyOn(settingsRepo, 'getMomentsEnabled').mockImplementation(() => {
      throw new Error('boom');
    });
    try {
      expect(closeToday(letGoAll())).toEqual([]);
      expect(loadDayBundle(db, D1)!.day.closedAt).toBe(t);
      expect(warn).toHaveBeenCalledWith('closeToday: moments failed, playing none', expect.any(Error));
    } finally {
      boom.mockRestore();
      warn.mockRestore();
    }
  });
});
