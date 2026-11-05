import { loadDayBundle } from '../../data/repos/days';
import { focusTotalsByDay } from '../../data/repos/sessions';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import type { Moment } from '../../domain/moments';
import { closeToday } from '../actions/close';
import { createTask, createTopic, removeTask } from '../actions/library';
import { reconcile } from '../actions/reconcile';
import { startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { letGoAll, setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const MIN = 60_000;
// 2026-11-01 is the day the clocks go back (US): a 25-hour day, with a real session on it. at() hours count from the day start.
const at = (day: string, hours = 6) => dayStartOf(day, 4) + hours * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(at('2026-10-12'));
  t = at('2026-10-12');
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
});
afterEach(() => teardownState());

function row(d: string, name: string): string {
  return loadDayBundle(db, d)!.dayTasks.find((x) => x.name === name)!.id;
}

type Best = Extract<Moment, { kind: 'best' }>;
/**
 * Live day `d` 6 h after its start and run 'A' for `minutes`. By default the session is left running for the close to end.
 * With `stop` (minutes > 30): the budget is passed (reconcile finishes the task) and the user stops it at the end.
 */
function work(d: string, minutes: number, stop = false) {
  t = at(d);
  reconcile();
  startTask(row(d, 'A'));
  if (stop) {
    t += (minutes - 1) * MIN;
    reconcile();
    t += MIN;
    stopTask(row(d, 'A'));
  } else {
    t += minutes * MIN;
  }
}
/** Close the live day by hand; returns its best moment (if any). */
function close(): Best | undefined {
  return closeToday(letGoAll()).find((m): m is Best => m.kind === 'best');
}
/** Live day `d`, tick only the checklist item (focus 0), close by hand. */
function checklistOnly(d: string) {
  t = at(d);
  reconcile();
  toggleCheckTask(row(d, 'C'));
  close();
}
function day(d: string, minutes: number) {
  work(d, minutes);
  return close();
}

/**
 * About three weeks of history, all closed by hand, ending on 11-02. Focus per day (minutes):
 *   10-12 100 (the best, more than 13 days before 11-03 and 11-04), 10-13 no row, 10-15 20, 10-19 5, 10-21 8,
 *   10-22 checklist only = 0, 10-23 no row, 10-24 30, 10-25 45, 10-26 no row, 10-27 10, 10-28 no row,
 *   10-29 60, 10-30 5, 10-31 25, 11-01 15 (the 25-hour day), 11-02 40.
 * None of them beats 100 after 10-12, so none plays a best moment (and 10-12 has no earlier focus: none either).
 */
function history() {
  const plan: [string, number | 'C'][] = [
    ['2026-10-12', 100], ['2026-10-15', 20], ['2026-10-19', 5], ['2026-10-21', 8], ['2026-10-22', 'C'],
    ['2026-10-24', 30], ['2026-10-25', 45], ['2026-10-27', 10], ['2026-10-29', 60], ['2026-10-30', 5],
    ['2026-10-31', 25], ['2026-11-01', 15], ['2026-11-02', 40],
  ];
  for (const [d, v] of plan) {
    if (v === 'C') checklistOnly(d);
    else expect(day(d, v)).toBeUndefined();
  }
}

describe('best moment: data traced from real days', () => {
  it('the best is older than the 13 bars: the glass stands above every bar, previousBestMs from the old day', () => {
    history();
    // 11-03 (Tue): a session still running at the close, 110 min -> closeToday ends it at the close instant.
    work('2026-11-03', 110, false);
    const best = close()!;
    // todayMs = 110 min. earlierBest = max(100 (10-12), 60, ...) = 100 min, markers.bestMs 0 -> previousBestMs 100 min.
    expect(best.todayMs).toBe(110 * MIN);
    expect(best.previousBestMs).toBe(100 * MIN);
    // Window = 13 days before 11-03, oldest first: index i = 10-21 + i (10-21 .. 11-02):
    //   10-21 8, 10-22 0 (checklist only), 10-23 0 (no row), 10-24 30, 10-25 45, 10-26 0 (no row), 10-27 10,
    //   10-28 0 (no row), 10-29 60, 10-30 5, 10-31 25, 11-01 15, 11-02 40.
    // 10-12 (100) and 10-19 (5) are before the window start 10-21, so they are not shown.
    expect(best.recentMs).toEqual([8, 0, 0, 30, 45, 0, 10, 0, 60, 5, 25, 15, 40].map((m) => m * MIN));
    expect(Math.max(...best.recentMs)).toBeLessThan(best.previousBestMs);
  });

  it('a day that ties the best plays nothing; the next close beats it; the one after beats the new best', () => {
    history();
    // 11-03: running at the close, exactly 100 min = the best of 10-12. Not greater: no moment.
    work('2026-11-03', 100, false);
    expect(close()).toBeUndefined();

    // 11-04: 110 min, stopped by hand. previousBestMs = max(100 (10-12 and 11-03), markers 0) = 100 min.
    work('2026-11-04', 110, true);
    const b1 = close()!;
    expect(b1.todayMs).toBe(110 * MIN);
    expect(b1.previousBestMs).toBe(100 * MIN);
    // Window = 10-22 .. 11-03: 10-22 0, 10-23 0, 10-24 30, 10-25 45, 10-26 0, 10-27 10, 10-28 0, 10-29 60, 10-30 5,
    //   10-31 25, 11-01 15, 11-02 40, 11-03 100 (the tie, now a bar level with the glass).
    expect(b1.recentMs).toEqual([0, 0, 30, 45, 0, 10, 0, 60, 5, 25, 15, 40, 100].map((m) => m * MIN));

    // 11-05: 120 min beats yesterday's new best (110): plays again, previousBestMs = yesterday.
    work('2026-11-05', 120, true);
    const b2 = close()!;
    expect(b2.todayMs).toBe(120 * MIN);
    expect(b2.previousBestMs).toBe(110 * MIN);
    // Window = 10-23 .. 11-04: the 10-22 zero drops off, 11-04 (110) joins as index 12.
    expect(b2.recentMs).toEqual([0, 30, 45, 0, 10, 0, 60, 5, 25, 15, 40, 100, 110].map((m) => m * MIN));
  });

  it('forwarded, soft-deleted and auto-closed days keep their focus on their own day', () => {
    // 10-12: 500 min, the best (before the 13-day window of the final close, 10-13..10-25).
    expect(day('2026-10-12', 500)).toBeUndefined();

    // 10-20: A runs 20 min of 30 and is MOVED. The 20 min stay on 10-20; the forwarded row on 10-21 has no session.
    work('2026-10-20', 20);
    const aId = row('2026-10-20', 'A');
    expect(closeToday(letGoAll({ [aId]: 'moved' })).find((m) => m.kind === 'best')).toBeUndefined();
    expect(loadDayBundle(db, '2026-10-21')!.dayTasks.some((d) => d.forwardedFromDayKey === '2026-10-20')).toBe(true);
    t = at('2026-10-21');
    reconcile();
    expect(close()).toBeUndefined(); // 10-21 does nothing: 0 focus (a row with no session)

    // 10-22: a new task D runs 15 min, the day is closed, then D is soft-deleted. Its 15 min still count on 10-22.
    t = at('2026-10-22');
    const d = createTask(null, { name: 'D', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
    reconcile();
    startTask(row('2026-10-22', 'D'));
    t += 15 * MIN;
    expect(close()).toBeUndefined();
    removeTask(d.id);

    // 10-23: A starts 18 h into the day (22:00 local, hours count from the 04:00 day start) and is left running. Reconcile on 10-24 auto-closes 10-23 at its end, 10-24 04:00 local:
    //   22:00 -> 04:00 = 6 h = 360 min.
    t = at('2026-10-23');
    reconcile();
    t = at('2026-10-23', 18);
    startTask(row('2026-10-23', 'A'));
    t = at('2026-10-24');
    expect(reconcile().autoClosed).toEqual(['2026-10-23']);
    const early = focusTotalsByDay(db, '2026-10-24', at('2026-10-24'))['2026-10-23'];
    expect(early).toBe(360 * MIN);

    // 10-24: 10 min, closed by hand. 10-25: no row.
    work('2026-10-24', 10);
    expect(close()).toBeUndefined();

    // 10-26: 520 min beats the 500 of 10-12. The auto-closed day is still 360 min days later.
    work('2026-10-26', 520);
    expect(focusTotalsByDay(db, '2026-10-24', at('2026-10-26'))['2026-10-23']).toBe(early);
    const best = close()!;
    expect(best.todayMs).toBe(520 * MIN);
    expect(best.previousBestMs).toBe(500 * MIN);
    // Window 10-13 .. 10-25 (index i = 10-13 + i): 10-13..10-19 no rows = 0 (indexes 0-6), 10-20 = 20 (index 7, the
    //   moved task's session), 10-21 = 0 (forwarded row, no session), 10-22 = 15 (soft-deleted D), 10-23 = 360
    //   (auto-closed at day end), 10-24 = 10, 10-25 = 0 (no row).
    expect(best.recentMs).toEqual([0, 0, 0, 0, 0, 0, 0, 20, 0, 15, 360, 10, 0].map((m) => m * MIN));
  });
});
