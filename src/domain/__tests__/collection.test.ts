import { collectionItems, isLidClosed } from '../collection';
import type { Day, DayBundle, DayTask, Session } from '../types';

const day = (o: Partial<Day> = {}): Day => ({
  dayKey: '2026-10-28', planConfirmedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, ...o,
});
const dt = (id: string, o: Partial<DayTask> = {}): DayTask => ({
  id, dayKey: '2026-10-28', taskId: null, topicId: 't1', name: id, colorKey: 'study', kind: 'timed',
  budgetSec: 600, cue: null, treat: null, forwardedFromDayKey: null, completedAt: null,
  closeOutcome: null, sortOrder: 0, ...o,
});
const bundle = (d: Day, dayTasks: DayTask[], s: Record<string, Session[]> = {}): DayBundle => ({
  day: d, dayTasks, sessionsByDayTask: s,
});

describe('collectionItems', () => {
  it('is empty for an unplanned day with nothing done', () => {
    expect(collectionItems(bundle(day(), [dt('a')]), 1000)).toEqual([]);
  });

  it('puts the planning marble first', () => {
    const items = collectionItems(bundle(day({ planConfirmedAt: 500 }), [dt('a', { completedAt: 100 })]), 1000);
    expect(items[0]).toEqual({ kind: 'planning', dayTaskId: null, colorKey: 'sun', small: false, gold: false, at: 500 });
    expect(items[1].dayTaskId).toBe('a');
  });

  it('orders by completedAt, ties by sortOrder, and skips incomplete', () => {
    const tasks = [
      dt('late', { completedAt: 300 }),
      dt('tieB', { completedAt: 200, sortOrder: 2 }),
      dt('tieA', { completedAt: 200, sortOrder: 1 }),
      dt('open'),
    ];
    expect(collectionItems(bundle(day(), tasks), 1000).map((i) => i.dayTaskId)).toEqual(['tieA', 'tieB', 'late']);
  });

  it('uses snapshot color, small for check, gold for timed overtime', () => {
    const tasks = [
      dt('chk', { kind: 'check', colorKey: 'home', completedAt: 1 }),
      dt('gold', { colorKey: 'health', completedAt: 2, budgetSec: 60 }),
      dt('plain', { completedAt: 3, budgetSec: 60 }),
      dt('nosess', { completedAt: 4 }),
    ];
    const s: Record<string, Session[]> = {
      gold: [{ id: 's1', dayTaskId: 'gold', startedAt: 0, endedAt: 130_000 }],
      plain: [{ id: 's2', dayTaskId: 'plain', startedAt: 0, endedAt: 70_000 }],
    };
    const [chk, gold, plain, nosess] = collectionItems(bundle(day(), tasks, s), 1_000_000);
    expect(chk).toMatchObject({ colorKey: 'home', small: true, gold: false });
    expect(gold).toMatchObject({ colorKey: 'health', small: false, gold: true });
    expect(plain.gold).toBe(false);
    expect(nosess.gold).toBe(false);
  });

  it('check tasks are never gold', () => {
    const t = dt('c', { kind: 'check', completedAt: 1, budgetSec: 0 });
    const s = { c: [{ id: 's', dayTaskId: 'c', startedAt: 0, endedAt: 999_999 }] };
    expect(collectionItems(bundle(day(), [t], s), 1_000_000)[0].gold).toBe(false);
  });
});

describe('isLidClosed', () => {
  it('follows closedAt', () => {
    expect(isLidClosed(day())).toBe(false);
    expect(isLidClosed(day({ closedAt: 5, closedBy: 'user' }))).toBe(true);
  });
});
