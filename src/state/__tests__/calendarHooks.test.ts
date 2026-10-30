import { renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan } from '../../domain/plan';
import type { DayCardLineInput } from '../../ui/dayCardLine';
import type { MonthGridCell } from '../../ui/MonthGrid';
import { closeToday } from '../actions/close';
import { createTask, createTopic } from '../actions/library';
import { confirmDayPlan } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { startTask, stopTask, toggleCheckTask } from '../actions/run';
import { setClockOverride } from '../clock';
import { useCalendarMonth } from '../hooks/useCalendarMonth';
import type { CalendarCell } from '../hooks/useCalendarMonth';
import { useDayCard } from '../hooks/useDayCard';
import { useProfileStats } from '../hooks/useProfileStats';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const TODAY = '2026-10-29';
const TOMORROW = '2026-10-30';
const MIN = 60_000;
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000; // 10:00

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T0);
  t = T0;
  setClockOverride(() => t);
});
afterEach(() => teardownState());

/** Study: A (30 min timed), C1, C2 (checks). Returns today's day-task ids by name. */
function seed() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'A', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C1', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  createTask(study.id, { name: 'C2', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile();
  const b = loadDayBundle(db, TODAY)!;
  return Object.fromEntries(b.dayTasks.map((d) => [d.name, d.id]));
}

function finishEverything(id: Record<string, string>) {
  toggleCheckTask(id.C1);
  toggleCheckTask(id.C2);
  startTask(id.A);
  t = T0 + 30 * MIN;
  stopTask(id.A);
}

const cellOf = (weeks: (CalendarCell | null)[][], k: string) =>
  weeks.flat().find((c) => c?.dayKey === k) as CalendarCell;

describe('useCalendarMonth', () => {
  it('flags today, tomorrow and future; empty cells for days with no row', async () => {
    seed();
    const { result } = await renderHook(() => useCalendarMonth('2026-10'));
    const r = result.current;
    expect(r).toMatchObject({ month: '2026-10', todayKey: TODAY, tomorrowKey: TOMORROW, dayNumber: 1 });
    expect(r.weeks).toHaveLength(5);
    expect(cellOf(r.weeks, TODAY)).toMatchObject({ isToday: true, isTomorrow: false, isFuture: false, glows: false, closed: false });
    expect(cellOf(r.weeks, TOMORROW)).toMatchObject({ isToday: false, isTomorrow: true, isFuture: true, items: [] });
    expect(cellOf(r.weeks, '2026-10-05')).toMatchObject({ items: [], glows: false, closed: false, isFuture: false });
    expect(r.weeks[0][0]).toBeNull(); // Oct 2026 starts on a Thursday
    const ui: MonthGridCell | null = r.weeks[0][3]; // assignable to the UI cell type
    expect(ui?.dayKey).toBe('2026-10-01');
  });

  it('glows with a closed lid when everything planned is done', async () => {
    const id = seed();
    finishEverything(id);
    closeToday({});
    const { result } = await renderHook(() => useCalendarMonth('2026-10'));
    const c = cellOf(result.current.weeks, TODAY);
    expect(c).toMatchObject({ closed: true, glows: true });
    expect(c.items).toHaveLength(3);
  });

  it('does not glow when something was let go', async () => {
    const id = seed();
    toggleCheckTask(id.C1);
    closeToday({ [id.C2]: 'let_go', [id.A]: 'let_go' });
    const { result } = await renderHook(() => useCalendarMonth('2026-10'));
    const c = cellOf(result.current.weeks, TODAY);
    expect(c).toMatchObject({ closed: true, glows: false });
    expect(c.items).toHaveLength(1);
  });

  it('any month can be shown: past and future months have only empty cells', async () => {
    seed();
    const aug = await renderHook(() => useCalendarMonth('2026-08'));
    expect(aug.result.current.weeks.flat().filter((c) => c && c.items.length > 0)).toHaveLength(0);
    expect(cellOf(aug.result.current.weeks, '2026-08-15')).toMatchObject({ isFuture: false, isToday: false });
    const jan = await renderHook(() => useCalendarMonth('2027-01'));
    expect(cellOf(jan.result.current.weeks, '2027-01-01')).toMatchObject({ isFuture: true, items: [], closed: false });
    expect('canPrev' in jan.result.current).toBe(false);
    expect('canNext' in jan.result.current).toBe(false);
  });

  it('with no rows at all, Day 1 and today still flagged', async () => {
    const { result } = await renderHook(() => useCalendarMonth('2026-10'));
    expect(result.current.dayNumber).toBe(1);
    expect(cellOf(result.current.weeks, TODAY).isToday).toBe(true);
  });
});

describe('useDayCard', () => {
  it('today: counts, focus, extra time and plannable', async () => {
    const id = seed();
    startTask(id.A);
    t = T0 + 40 * MIN; // 10 minutes over
    toggleCheckTask(id.C1);
    const { result } = await renderHook(() => useDayCard(TODAY));
    const c = result.current;
    expect(c).toMatchObject({ kind: 'today', planned: false, closed: false, done: 2, total: 3, canPlan: true, glows: false });
    expect(c.focusedMs).toBe(40 * MIN);
    expect(c.extraMs).toBe(10 * MIN);
    const line: DayCardLineInput = c; // assignable to the UI line input
    expect(line.kind).toBe('today');
  });

  it('kinds and canPlan: past, tomorrow, later; a closed today leaves only tomorrow', async () => {
    const id = seed();
    const past = await renderHook(() => useDayCard('2026-10-28'));
    expect(past.result.current).toMatchObject({ kind: 'past', total: 0, items: [], canPlan: false, planned: false });
    const tom = await renderHook(() => useDayCard(TOMORROW));
    expect(tom.result.current).toMatchObject({ kind: 'tomorrow', canPlan: true, total: 0 });
    const later = await renderHook(() => useDayCard('2026-11-05'));
    expect(later.result.current).toMatchObject({ kind: 'later', canPlan: false });
    closeToday({ [id.C1]: 'let_go', [id.C2]: 'let_go', [id.A]: 'let_go' });
    const today = await renderHook(() => useDayCard(TODAY));
    expect(today.result.current).toMatchObject({ closed: true, canPlan: false });
    const tom2 = await renderHook(() => useDayCard(TOMORROW));
    expect(tom2.result.current.canPlan).toBe(true);
  });

  it('a closed all-done day glows', async () => {
    const id = seed();
    finishEverything(id);
    closeToday({});
    const { result } = await renderHook(() => useDayCard(TODAY));
    expect(result.current).toMatchObject({ glows: true, closed: true, done: 3, total: 3 });
  });
});

describe('useProfileStats', () => {
  it('starts at day 1 with zeros', async () => {
    const { result } = await renderHook(() => useProfileStats());
    expect(result.current).toEqual({ dayNumber: 1, daysShowedUp: 0, focusedHours: 0, marbles: 0 });
  });

  it('totals marbles, days showed up and focused hours', async () => {
    const id = seed();
    startTask(id.A);
    t = T0 + 30 * MIN;
    stopTask(id.A);
    toggleCheckTask(id.C1);
    const { result } = await renderHook(() => useProfileStats());
    expect(result.current.dayNumber).toBe(1);
    expect(result.current.daysShowedUp).toBe(1);
    expect(result.current.marbles).toBe(2);
    expect(result.current.focusedHours).toBeCloseTo(0.5, 5);
  });

  it('a planned tomorrow does not count yet (no extra day, no extra marble)', async () => {
    seed();
    const plan = buildPlan({ dayKey: TOMORROW, topics: listTopics(db), tasks: listTasks(db), day: null, dayTasks: [] });
    confirmDayPlan(TOMORROW, plan);
    const { result } = await renderHook(() => useProfileStats());
    expect(result.current).toMatchObject({ dayNumber: 1, daysShowedUp: 0, marbles: 0 });
  });
});
