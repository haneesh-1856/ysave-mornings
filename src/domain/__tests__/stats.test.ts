import { dayNumber, daysShowedUp, focusedHours, marbles, topicWeeklyMinutes, weekDots } from '../stats';
import type { DayBundle, DayTask, Session, Task } from '../types';

const task = (o: Partial<Task>): Task => ({
  id: 'x', topicId: 'a', name: 'n', kind: 'timed', minutes: 30, repeatMask: 0b0000101,
  isDefault: true, cue: null, treat: null, note: '', sortOrder: 0, deletedAt: null, defaultChangedAt: null, ...o,
});
const dt = (id: string, topicId: string, completedAt: number | null): DayTask => ({
  id, dayKey: '2026-10-26', taskId: null, topicId, name: id, colorKey: 'study', kind: 'check',
  budgetSec: 0, cue: null, treat: null, note: null, forwardedFromDayKey: null, completedAt,
  closeOutcome: null, sortOrder: 0,
});
const bundle = (dayTasks: DayTask[], planConfirmedAt: number | null = null): DayBundle => ({
  day: { dayKey: '2026-10-26', planConfirmedAt, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4 },
  dayTasks, sessionsByDayTask: {},
});

describe('dayNumber', () => {
  it('is 1 when first is null or today', () => {
    expect(dayNumber(null, '2026-10-29')).toBe(1);
    expect(dayNumber('2026-10-29', '2026-10-29')).toBe(1);
  });
  it('counts inclusively, across DST and months', () => {
    expect(dayNumber('2026-10-22', '2026-10-29')).toBe(8);
    expect(dayNumber('2026-10-20', '2026-11-03')).toBe(15);
    expect(dayNumber('2026-03-01', '2026-04-01')).toBe(32);
  });
  it('never goes below 1 if first is in the future', () => {
    expect(dayNumber('2026-11-01', '2026-10-29')).toBe(1);
  });
});

describe('counts', () => {
  const counts = { '2026-10-27': 3, '2026-10-28': 0, '2026-10-29': 2 };
  it('daysShowedUp and marbles', () => {
    expect(daysShowedUp(counts)).toBe(2);
    expect(marbles(counts)).toBe(5);
    expect(daysShowedUp({})).toBe(0);
    expect(marbles({})).toBe(0);
  });
});

describe('focusedHours', () => {
  it('sums closed and open sessions, unrounded', () => {
    const s: Session[] = [
      { id: '1', dayTaskId: 'a', startedAt: 0, endedAt: 1_800_000 },
      { id: '2', dayTaskId: 'b', startedAt: 2_000_000, endedAt: null },
    ];
    expect(focusedHours(s, 3_800_000)).toBeCloseTo(1.0, 10);
    expect(focusedHours([], 5)).toBe(0);
  });
});

describe('topicWeeklyMinutes', () => {
  it('sums minutes x repeat days for live timed tasks of the topic', () => {
    const tasks = [
      task({ id: '1', minutes: 30, repeatMask: 0b0000101 }),
      task({ id: '2', minutes: 45, repeatMask: 0b1111111 }),
      task({ id: '3', kind: 'check', repeatMask: 0b1111111 }),
      task({ id: '4', deletedAt: 5 }),
      task({ id: '5', topicId: 'b' }),
      task({ id: '6', repeatMask: 0b11111111 }),
      task({ id: '7', repeatMask: 0 }),
    ];
    expect(topicWeeklyMinutes(tasks, 'a')).toBe(60 + 315 + 210);
    expect(topicWeeklyMinutes(tasks, 'none')).toBe(0);
  });
});

describe('weekDots', () => {
  it('collects the topic task items across bundles in time order, excluding planning marbles', () => {
    const b1 = bundle([dt('a1', 'a', 300), dt('b1', 'b', 100), dt('a2', 'a', 100), dt('a3', 'a', null)], 50);
    const b2 = bundle([dt('a4', 'a', 200)]);
    expect(weekDots('a', [b1, b2], 1000).map((d) => d.dayTaskId)).toEqual(['a2', 'a4', 'a1']);
  });
  it('caps at 6', () => {
    const many = Array.from({ length: 9 }, (_, i) => dt(`t${i}`, 'a', i + 1));
    const dots = weekDots('a', [bundle(many)], 1000);
    expect(dots).toHaveLength(6);
    expect(dots[5].dayTaskId).toBe('t5');
  });
  it('is empty with no bundles', () => {
    expect(weekDots('a', [], 1)).toEqual([]);
  });
});
