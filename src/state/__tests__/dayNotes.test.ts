import { act, renderHook } from '@testing-library/react-native';
import { loadDayBundle } from '../../data/repos/days';
import { getTask, listTasks } from '../../data/repos/tasks';
import { listTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { buildPlan, setNote } from '../../domain/plan';
import type { PlanDraft } from '../../domain/plan';
import { closeToday } from '../actions/close';
import { createTask, createTopic, setTaskNote } from '../actions/library';
import { confirmDayPlan, setDayTaskNote } from '../actions/plan';
import { reconcile } from '../actions/reconcile';
import { setClockOverride } from '../clock';
import { ValidationError } from '../errors';
import { usePlanDraft } from '../hooks/usePlanDraft';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const WED = '2026-10-28';
const THU = '2026-10-29';
const T_WED = dayStartOf(WED, 4) + 6 * 3_600_000;

let db: DB;
let t: number;
beforeEach(() => {
  db = setupState(T_WED);
  t = T_WED;
  setClockOverride(() => t);
});
afterEach(teardownState);

function seed() {
  const m = createTopic({ name: 'Math', colorKey: 'study' });
  const read = createTask(m.id, { name: 'Read', kind: 'timed', minutes: 30, repeatMask: 127, isDefault: true });
  const form = createTask(m.id, { name: 'Form', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  return { m, read, form };
}
const stored = (day: string, name: string) => loadDayBundle(db, day)!.dayTasks.find((d) => d.name === name)!;
type Plan = Awaited<ReturnType<typeof renderHook<ReturnType<typeof usePlanDraft>, unknown>>>;
const keyOf = (p: Plan, name: string) =>
  [...p.result.current.draft!.groups.flatMap((g) => g.rows), ...p.result.current.draft!.notOn].find((r) => r.name === name)!.key;

/** A plan built straight from the db (no hook), with an optional note on one named row. */
function planSnapshot(dayKey: string, name?: string, note?: string): PlanDraft {
  const b = loadDayBundle(db, dayKey);
  let d = buildPlan({ dayKey, topics: listTopics(db), tasks: listTasks(db), day: b?.day ?? null, dayTasks: b?.dayTasks ?? [] });
  if (name) {
    const row = [...d.groups.flatMap((g) => g.rows), ...d.notOn].find((r) => r.name === name)!;
    d = setNote(d, row.key, note ?? null);
  }
  return d;
}

describe('day notes (ADR-011): the user path', () => {
  it('a note on a library row and on a one-off, confirmed for tomorrow, lands on the day rows only', async () => {
    const { m, read } = seed();
    const p = await renderHook(() => usePlanDraft(THU));
    await act(async () => {
      p.result.current.setNote(keyOf(p, 'Read'), 'only ch 3');
      p.result.current.addOneOff({ topicId: m.id, name: 'Dentist', kind: 'check', minutes: 5 });
    });
    await act(async () => {
      p.result.current.setNote('oneoff:1', 'ask about the fee');
    });
    await act(async () => {
      p.result.current.confirm();
    });
    expect(stored(THU, 'Read').note).toBe('only ch 3');
    expect(stored(THU, 'Dentist').note).toBe('ask about the fee');
    expect(getTask(db, read.id)!.note).toBe('');
  });

  it('a library note is not copied into the day note', async () => {
    const { read } = seed();
    setTaskNote(read.id, 'general');
    const p = await renderHook(() => usePlanDraft(THU));
    await act(async () => {
      p.result.current.confirm();
    });
    expect(stored(THU, 'Read').note).toBeNull();
    expect(getTask(db, read.id)!.note).toBe('general');
  });

  it("editing today's plan keeps the day note and an edit replaces it on the same row", async () => {
    seed();
    const first = await renderHook(() => usePlanDraft(WED));
    await act(async () => {
      first.result.current.setNote(keyOf(first, 'Read'), 'morning: warm up');
    });
    await act(async () => {
      first.result.current.confirm();
    });
    const id = stored(WED, 'Read').id;
    const again = await renderHook(() => usePlanDraft(WED));
    expect(again.result.current.draft!.groups[0].rows.find((r) => r.name === 'Read')!.note).toBe('morning: warm up');
    await act(async () => {
      again.result.current.setNote(keyOf(again, 'Read'), 'evening: review');
    });
    await act(async () => {
      again.result.current.confirm();
    });
    expect(stored(WED, 'Read')).toMatchObject({ id, note: 'evening: review' });
    const cleared = await renderHook(() => usePlanDraft(WED));
    await act(async () => {
      cleared.result.current.setNote(keyOf(cleared, 'Read'), '  ');
    });
    await act(async () => {
      cleared.result.current.confirm();
    });
    expect(stored(WED, 'Read').note).toBeNull();
  });

  it('a draft for a later day saves the note too', async () => {
    seed();
    const later = '2026-11-03';
    const p = await renderHook(() => usePlanDraft(later));
    await act(async () => {
      p.result.current.setNote(keyOf(p, 'Read'), 'draft note');
    });
    await act(async () => {
      p.result.current.saveDraft();
    });
    expect(stored(later, 'Read').note).toBe('draft note');
  });
});

describe('the day note travels when a task is moved', () => {
  it('moves with a checklist task into a new next-day row', () => {
    const { form } = seed();
    reconcile();
    const d = stored(WED, 'Form');
    setDayTaskNote(d.id, 'bring the stamped copy');
    closeToday({ [d.id]: 'moved' });
    expect(stored(THU, 'Form')).toMatchObject({ forwardedFromDayKey: WED, note: 'bring the stamped copy' });
    expect(getTask(db, form.id)!.note).toBe('');
  });

  it("fills an empty note on the next day's existing row", () => {
    seed();
    reconcile();
    confirmDayPlan(THU, planSnapshot(THU));
    const d = stored(WED, 'Form');
    setDayTaskNote(d.id, 'from today');
    closeToday({ [d.id]: 'moved' });
    expect(stored(THU, 'Form')).toMatchObject({ forwardedFromDayKey: WED, note: 'from today' });
  });

  it('keeps the next-day row note when it already has one', () => {
    seed();
    reconcile();
    confirmDayPlan(THU, planSnapshot(THU, 'Form', 'mine for thursday'));
    const d = stored(WED, 'Form');
    setDayTaskNote(d.id, 'from today');
    closeToday({ [d.id]: 'moved' });
    expect(stored(THU, 'Form')).toMatchObject({ forwardedFromDayKey: WED, note: 'mine for thursday' });
  });
});

describe('setDayTaskNote', () => {
  it('edits an open day row; blank clears; the library note stays', () => {
    const { read } = seed();
    reconcile();
    const d = stored(WED, 'Read');
    setDayTaskNote(d.id, 'today I focus on proofs');
    expect(stored(WED, 'Read').note).toBe('today I focus on proofs');
    setDayTaskNote(d.id, '   ');
    expect(stored(WED, 'Read').note).toBeNull();
    expect(getTask(db, read.id)!.note).toBe('');
  });

  it('refuses on a closed day, an unknown row and an over-long note', () => {
    seed();
    reconcile();
    const d = stored(WED, 'Read');
    expect(() => setDayTaskNote(d.id, 'x'.repeat(1001))).toThrow(ValidationError);
    expect(() => setDayTaskNote('nope', 'x')).toThrow(ValidationError);
    closeToday({ [stored(WED, 'Form').id]: 'let_go' });
    expect(() => setDayTaskNote(d.id, 'too late')).toThrow(ValidationError);
    expect(stored(WED, 'Read').note).toBeNull();
  });
});
