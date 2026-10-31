import { act, fireEvent, screen } from '@testing-library/react-native';

import { getDayTask, loadDayBundle } from '@/data/repos/days';
import { applyOps } from '@/data/repos/ops';
import { getTask } from '@/data/repos/tasks';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft, PlanRow } from '@/domain/plan';
import { createTask, createTopic, setTaskNote } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import TodayScreen from '../../app/(tabs)/today';
import { RunScreen } from '../RunScreen';

/**
 * Chunk 11 (phone check): tapping a task on Today opens a task page with its cumulative notes and the action
 * (Start / Pause for timed, Mark done for checklist). A closed day opens it read-only.
 */

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), dismissTo: (...a: unknown[]) => mockDismissTo(...a) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const PLAN_DAY = '2026-10-29'; // Thursday
const TODAY = '2026-10-30'; // Friday
const PLANNED_AT = dayStartOf(PLAN_DAY, 4) + 6 * 3_600_000;
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;
let clock = PLANNED_AT;

function row(topicId: string, name: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    key: `k-${name}`, taskId: null, topicId, name, colorKey: 'study', kind: 'timed', minutes: 5, cue: null,
    treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null, ...over,
  };
}

/** Thursday: plan Friday with library task Read (library note "general", day note "do chapter 3") and a one-off checklist Sums. Then it is Friday. */
function planTomorrowAndAdvance() {
  const topic = createTopic({ name: 'Study', colorKey: 'study' });
  const lib = createTask(topic.id, { name: 'Read', minutes: 5 });
  setTaskNote(lib.id, 'general');
  const draft: PlanDraft = {
    dayKey: TODAY,
    groups: [{
      topicId: topic.id,
      rows: [
        row(topic.id, 'Read', { taskId: lib.id, note: 'do chapter 3' }),
        row(topic.id, 'Sums', { kind: 'check', note: 'page 12 only' }),
      ],
    }],
    notOn: [],
  };
  confirmDayPlan(TODAY, draft);
  clock = NOW;
  reconcile();
  const rows = loadDayBundle(getDb(), TODAY)!.dayTasks;
  const id = (n: string) => rows.find((r) => r.name === n)!.id;
  return { read: id('Read'), sums: id('Sums'), libId: lib.id };
}

function closeToday() {
  applyOps(
    getDb(),
    { closeSessions: [], completions: [], outcomes: [], insertDayTasks: [], forwardDayTasks: [], createDays: [], closeDays: [{ dayKey: TODAY, closedAt: NOW, closedBy: 'user' }] },
    () => 'x',
    NOW,
  );
}

const openedId = () => (mockPush.mock.calls.at(-1)![0] as { params: { dayTaskId: string } }).params.dayTaskId;

beforeEach(() => {
  setupState(PLANNED_AT);
  clock = PLANNED_AT;
  setClockOverride(() => clock);
  mockPush.mockClear();
  mockDismissTo.mockClear();
});
afterEach(() => teardownState());

describe('task page: the user path', () => {
  it('(a) a checklist row opens a page with its notes and Mark done; back shows the row done', async () => {
    planTomorrowAndAdvance();
    const today = await renderThemed(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sums, checklist, open' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/run/[dayTaskId]', params: { dayTaskId: expect.any(String) } });
    const id = openedId();
    await today.unmount();

    const page = await renderThemed(<RunScreen dayTaskId={id} />);
    expect(screen.getByText('Sums')).toBeTruthy();
    expect(screen.getByText('To do')).toBeTruthy();
    expect(screen.getByText('page 12 only')).toBeTruthy();
    expect(screen.queryByText('Library note')).toBeNull(); // one-off: no library note
    await fireEvent.press(screen.getByTestId('task-mark-done'));
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
    await page.unmount();

    await renderThemed(<TodayScreen />);
    expect(screen.getByRole('button', { name: 'Sums, done' })).toBeTruthy();
  });

  it('Mark not done undoes it', async () => {
    const { sums } = planTomorrowAndAdvance();
    await renderThemed(<RunScreen dayTaskId={sums} />);
    await fireEvent.press(screen.getByTestId('task-mark-done'));
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); }); // button cooldown
    await fireEvent.press(screen.getByRole('button', { name: 'Mark not done' }));
    expect(screen.getByText('To do')).toBeTruthy();
    expect(getDayTask(getDb(), sums)!.completedAt).toBeNull();
  });

  it('(b) a timed row shows library note and day note, and Start then Pause work', async () => {
    const { read } = planTomorrowAndAdvance();
    await renderThemed(<RunScreen dayTaskId={read} />);
    expect(screen.getByText('Library note')).toBeTruthy();
    expect(screen.getByText('general')).toBeTruthy();
    expect(screen.getByText('Note for Friday')).toBeTruthy();
    expect(screen.getByText('do chapter 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('run-start'));
    expect(screen.getByText('Running')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); }); // button cooldown
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('(c) editing the day note stores it on day_tasks.note and leaves tasks.note alone', async () => {
    const { read, libId } = planTomorrowAndAdvance();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Note for Friday: do chapter 3/ }));
    await fireEvent.changeText(screen.getByLabelText('Note for Friday'), ' chapter 4');
    expect(screen.getByLabelText('Note for Friday').props.value).toBe(' chapter 4'); // raw text kept while editing
    await fireEvent.press(screen.getByRole('button', { name: 'Today' })); // leave flushes
    expect(getDayTask(getDb(), read)!.note).toBe(' chapter 4');
    expect(getTask(getDb(), libId)!.note).toBe('general');
  });

  it('(d) on a closed day the page opens read-only: no action button, note not editable', async () => {
    const { read, sums } = planTomorrowAndAdvance();
    closeToday();
    const today = await renderThemed(<TodayScreen />);
    expect(screen.getByRole('button', { name: 'Sums, checklist, open' })).not.toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Read, 5 minutes, start' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    await today.unmount();

    for (const id of [read, sums]) {
      const page = await renderThemed(<RunScreen dayTaskId={id} />);
      expect(screen.getByText('Today is closed. It is read-only now.')).toBeTruthy();
      expect(screen.queryByTestId('run-start')).toBeNull();
      expect(screen.queryByTestId('task-mark-done')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Note for Friday/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Back to Today' })).toBeTruthy();
      await page.unmount();
    }
    await renderThemed(<RunScreen dayTaskId={read} />);
    expect(screen.getByText('do chapter 3')).toBeTruthy();
  });

  it('(e) Today has no checkbox and the checklist row says "checklist" after the name', async () => {
    planTomorrowAndAdvance();
    await renderThemed(<TodayScreen />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('checklist')).toBeTruthy();
  });

  it('a row that is not on the today list shows a friendly message with Back', async () => {
    planTomorrowAndAdvance();
    await renderThemed(<RunScreen dayTaskId="nope" />);
    expect(screen.getByText("This task isn't on today's list")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });
});
