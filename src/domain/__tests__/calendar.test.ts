import { chain, glows } from '../calendar';
import type { Day, DayBundle, DayTask } from '../types';

const day = (o: Partial<Day> = {}): Day => ({
  dayKey: '2026-10-28', planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, closedAt: null, closedBy: null, dayStartHour: 4, ...o,
});
const dt = (id: string, completedAt: number | null): DayTask => ({
  id, dayKey: '2026-10-28', taskId: null, topicId: 't', name: id, colorKey: 'study', kind: 'check',
  budgetSec: 0, cue: null, treat: null, forwardedFromDayKey: null, completedAt,
  closeOutcome: null, sortOrder: 0,
});
const b = (d: Day, t: DayTask[]): DayBundle => ({ day: d, dayTasks: t, sessionsByDayTask: {} });

describe('glows', () => {
  it('glows for a past day with everything done', () => {
    expect(glows(b(day(), [dt('a', 1), dt('b', 2)]), '2026-10-29')).toBe(true);
  });
  it('glows for a closed day even if it is today', () => {
    expect(glows(b(day({ closedAt: 9 }), [dt('a', 1)]), '2026-10-28')).toBe(true);
  });
  it('does not glow for an open today', () => {
    expect(glows(b(day(), [dt('a', 1)]), '2026-10-28')).toBe(false);
  });
  it('does not glow with an incomplete task (moved) or with no tasks', () => {
    expect(glows(b(day(), [dt('a', 1), dt('b', null)]), '2026-10-29')).toBe(false);
    expect(glows(b(day(), []), '2026-10-29')).toBe(false);
  });
});

describe('chain', () => {
  it('returns 8 links oldest first, last is today', () => {
    const links = chain('2026-10-29', {
      '2026-10-22': 1, '2026-10-24': 3, '2026-10-28': 2, '2026-10-29': 5, '2026-10-21': 4,
    });
    expect(links).toEqual(['solid', 'rest', 'solid', 'rest', 'rest', 'rest', 'solid', 'today']);
    expect(links).toHaveLength(8);
  });
  it('treats a zero count as rest and spans month boundaries', () => {
    const links = chain('2026-11-02', { '2026-10-31': 0, '2026-11-01': 1 });
    expect(links[5]).toBe('rest');
    expect(links[6]).toBe('solid');
    expect(links[7]).toBe('today');
  });
});
