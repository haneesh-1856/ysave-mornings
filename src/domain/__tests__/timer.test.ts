import {
  completionTime, extraMinutesLabel, focusedMs, isGold, minutesLeftLabel, overtimeMs, pendingCompletions,
  remainingMs, startDecision, timerState, toggleCheck,
} from '../timer';
import type { Day, DayTask, Session } from '../types';

const S = 1000;
const MIN = 60 * S;
const T0 = new Date(2026, 9, 29, 9, 0, 0).getTime();

const sess = (id: string, start: number, end: number | null, dayTaskId = 'a'): Session => ({
  id, dayTaskId, startedAt: start, endedAt: end,
});
const dt = (over: Partial<DayTask> = {}): DayTask => ({
  id: 'a', dayKey: '2026-10-29', taskId: null, topicId: 't', name: 'x', colorKey: 'study', kind: 'timed',
  budgetSec: 600, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt: null, closeOutcome: null,
  sortOrder: 0, ...over,
});
const day = (over: Partial<Day> = {}): Day => ({
  dayKey: '2026-10-29', planConfirmedAt: T0, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, ...over,
});

describe('focusedMs / remainingMs', () => {
  it('is 0 with no sessions', () => {
    expect(focusedMs([], T0)).toBe(0);
  });
  it('sums closed sessions and bounds the open one by now', () => {
    const ss = [sess('1', T0, T0 + 2 * MIN), sess('2', T0 + 5 * MIN, T0 + 6 * MIN), sess('3', T0 + 10 * MIN, null)];
    expect(focusedMs(ss, T0 + 13 * MIN)).toBe(6 * MIN);
  });
  it('clamps negative durations to 0', () => {
    expect(focusedMs([sess('1', T0 + 5000, T0)], T0)).toBe(0);
    expect(focusedMs([sess('1', T0 + 5000, null)], T0)).toBe(0);
  });
  it('remaining goes negative in overtime', () => {
    expect(remainingMs(600, [sess('1', T0, T0 + 4 * MIN)], T0 + 4 * MIN)).toBe(6 * MIN);
    expect(remainingMs(600, [sess('1', T0, T0 + 12 * MIN)], T0 + 12 * MIN)).toBe(-2 * MIN);
  });
});

describe('completionTime', () => {
  it('is null with no sessions or when budget not reached', () => {
    expect(completionTime(600, [], T0)).toBeNull();
    expect(completionTime(600, [sess('1', T0, T0 + 9 * MIN)], T0 + 20 * MIN)).toBeNull();
  });
  it('falls mid-session', () => {
    expect(completionTime(600, [sess('1', T0, T0 + 30 * MIN)], T0 + 30 * MIN)).toBe(T0 + 10 * MIN);
  });
  it('spans multiple sessions, regardless of array order', () => {
    const ss = [sess('2', T0 + 20 * MIN, T0 + 30 * MIN), sess('1', T0, T0 + 4 * MIN)];
    expect(completionTime(600, ss, T0 + 40 * MIN)).toBe(T0 + 26 * MIN);
  });
  it('completes exactly at a session end', () => {
    expect(completionTime(600, [sess('1', T0, T0 + 10 * MIN)], T0 + 10 * MIN)).toBe(T0 + 10 * MIN);
  });
  it('uses now for an open session; reached exactly at now counts', () => {
    expect(completionTime(600, [sess('1', T0, null)], T0 + 10 * MIN)).toBe(T0 + 10 * MIN);
    expect(completionTime(600, [sess('1', T0, null)], T0 + 10 * MIN - 1)).toBeNull();
  });
  it('kill-and-reopen: detected hours later still returns the exact earlier instant', () => {
    const ss = [sess('1', T0, null)];
    expect(completionTime(600, ss, T0 + 5 * MIN)).toBeNull();
    expect(completionTime(600, ss, T0 + 5 * 3600 * S)).toBe(T0 + 10 * MIN);
  });
  it('budget <= 0 completes at the first session start', () => {
    expect(completionTime(0, [sess('2', T0 + MIN, null), sess('1', T0, T0 + 1)], T0 + 2 * MIN)).toBe(T0);
    expect(completionTime(0, [], T0)).toBeNull();
    expect(completionTime(0, [sess('1', T0 + 5, null)], T0)).toBeNull();
  });
});

describe('overtime and gold', () => {
  const budget = 600;
  const at = (extra: number) => [sess('1', T0, T0 + 10 * MIN + extra)];
  it('overtime is 0 before the budget and positive after', () => {
    expect(overtimeMs(budget, at(-1), T0 + 20 * MIN)).toBe(0);
    expect(overtimeMs(budget, at(30 * S), T0 + 20 * MIN)).toBe(30 * S);
  });
  it('gold threshold: 59 999 ms is not gold, 60 000 ms is', () => {
    expect(isGold(budget, at(59_999), T0 + 20 * MIN)).toBe(false);
    expect(isGold(budget, at(60_000), T0 + 20 * MIN)).toBe(true);
  });
});

describe('labels', () => {
  it('minutesLeftLabel rounds up and floors at 0', () => {
    expect(minutesLeftLabel(600_000)).toBe(10);
    expect(minutesLeftLabel(599_999)).toBe(10);
    expect(minutesLeftLabel(540_001)).toBe(10);
    expect(minutesLeftLabel(540_000)).toBe(9);
    expect(minutesLeftLabel(1)).toBe(1);
    expect(minutesLeftLabel(0)).toBe(0);
    expect(minutesLeftLabel(-5000)).toBe(0);
  });
  it('extraMinutesLabel rounds down', () => {
    expect(extraMinutesLabel(0)).toBe(0);
    expect(extraMinutesLabel(59_999)).toBe(0);
    expect(extraMinutesLabel(60_000)).toBe(1);
    expect(extraMinutesLabel(119_999)).toBe(1);
    expect(extraMinutesLabel(-10)).toBe(0);
  });
});

describe('timerState', () => {
  it('idle with no sessions', () => expect(timerState(dt(), [])).toBe('idle'));
  it('running with an open session', () => expect(timerState(dt(), [sess('1', T0, null)])).toBe('running'));
  it('paused with only closed sessions', () => expect(timerState(dt(), [sess('1', T0, T0 + 1)])).toBe('paused'));
  it('overtime when completed with an open session', () =>
    expect(timerState(dt({ completedAt: T0 + 1 }), [sess('1', T0, null)])).toBe('overtime'));
  it('stopped when completed and no open session', () => {
    expect(timerState(dt({ completedAt: T0 + 1 }), [sess('1', T0, T0 + 5)])).toBe('stopped');
    expect(timerState(dt({ completedAt: T0 }), [])).toBe('stopped');
  });
});

describe('startDecision', () => {
  it('rejects check tasks', () =>
    expect(startDecision(dt({ kind: 'check' }), day(), null)).toEqual({ ok: false, reason: 'not_timed' }));
  it('rejects done tasks', () =>
    expect(startDecision(dt({ completedAt: T0 }), day(), null)).toEqual({ ok: false, reason: 'done' }));
  it('rejects when the day is closed', () =>
    expect(startDecision(dt(), day({ closedAt: T0 }), null)).toEqual({ ok: false, reason: 'day_closed' }));
  it('rejects when the target is already running', () =>
    expect(startDecision(dt(), day(), sess('s', T0, null, 'a'))).toEqual({ ok: false, reason: 'already_running' }));
  it('ok with nothing to close', () =>
    expect(startDecision(dt(), day(), null)).toEqual({ ok: true, closeSessionId: null }));
  it('ok and closes another task open session', () =>
    expect(startDecision(dt(), day(), sess('s9', T0, null, 'b'))).toEqual({ ok: true, closeSessionId: 's9' }));
});

describe('pendingCompletions', () => {
  it('lists reached, unmarked timed tasks with their exact instants', () => {
    const tasks = [
      dt({ id: 'a' }), // reached
      dt({ id: 'b' }), // not reached
      dt({ id: 'c', completedAt: T0 }), // already marked
      dt({ id: 'd', kind: 'check' }), // check
      dt({ id: 'e' }), // no sessions entry
    ];
    const by = {
      a: [sess('1', T0, T0 + 30 * MIN, 'a')],
      b: [sess('2', T0, T0 + MIN, 'b')],
      c: [sess('3', T0, T0 + 30 * MIN, 'c')],
      d: [sess('4', T0, T0 + 30 * MIN, 'd')],
    };
    expect(pendingCompletions(tasks, by, T0 + 40 * MIN)).toEqual([{ dayTaskId: 'a', completedAt: T0 + 10 * MIN }]);
  });
});

describe('toggleCheck', () => {
  it('rejects timed tasks', () =>
    expect(toggleCheck(dt(), day(), T0)).toEqual({ ok: false, reason: 'not_check' }));
  it('rejects when the day is closed', () =>
    expect(toggleCheck(dt({ kind: 'check' }), day({ closedAt: T0 }), T0)).toEqual({ ok: false, reason: 'day_closed' }));
  it('ticks to now', () =>
    expect(toggleCheck(dt({ kind: 'check' }), day(), T0)).toEqual({ ok: true, completedAt: T0 }));
  it('un-ticks to null', () =>
    expect(toggleCheck(dt({ kind: 'check', completedAt: T0 - 5 }), day(), T0)).toEqual({ ok: true, completedAt: null }));
});
