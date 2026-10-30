import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { loadDayBundle } from '@/data/repos/days';
import { applyOps } from '@/data/repos/ops';
import { getTask } from '@/data/repos/tasks';
import type { Session } from '@/domain/types';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft, PlanRow } from '@/domain/plan';
import { createTask, createTopic } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { RunScreen } from '../RunScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: { dismissTo: (...a: unknown[]) => mockDismissTo(...a) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-haptics');
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockRenders = 0;
jest.mock('@/state/hooks/useRunTask', () => {
  const actual = jest.requireActual('@/state/hooks/useRunTask');
  return {
    ...actual,
    useRunTask: (id: string) => {
      mockRenders++;
      return actual.useRunTask(id);
    },
  };
});

const TODAY = '2026-10-29';
const T0 = dayStartOf(TODAY, 4) + 6 * 3_600_000;
let clock = T0;

function row(topicId: string, name: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    key: `k-${name}`, taskId: null, topicId, name, colorKey: 'study', kind: 'timed', minutes: 5, cue: null,
    treat: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null, ...over,
  };
}

/** Plans today with a 5-min "Read" (library task, cue + treat), a 5-min one-off "Other" and a checklist "Tick". */
function plan() {
  const topic = createTopic({ name: 'Study', colorKey: 'study' });
  const lib = createTask(topic.id, { name: 'Read', minutes: 5 });
  const draft: PlanDraft = {
    dayKey: TODAY,
    groups: [
      {
        topicId: topic.id,
        rows: [
          row(topic.id, 'Read', { taskId: lib.id, cue: 'After coffee', treat: 'Tea' }),
          row(topic.id, 'Other'),
          row(topic.id, 'Tick', { kind: 'check' }),
        ],
      },
    ],
    notOn: [],
  };
  confirmDayPlan(TODAY, draft);
  const tasks = loadDayBundle(getDb(), TODAY)!.dayTasks;
  const id = (n: string) => tasks.find((t) => t.name === n)!.id;
  return { read: id('Read'), other: id('Other'), tick: id('Tick'), libId: lib.id };
}

const allSessions = (): Session[] => Object.values(loadDayBundle(getDb(), TODAY)!.sessionsByDayTask).flat();
const sessionCount = (): number => allSessions().length;

/** Moves the fake clock and the fake timers together. */
async function advance(ms: number) {
  clock += ms;
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  clock = T0;
  setupState(T0);
  setClockOverride(() => clock);
  mockRenders = 0;
  mockDismissTo.mockClear();
  jest.clearAllMocks();
});
afterEach(() => {
  teardownState();
  jest.useRealTimers();
});

describe('RunScreen', () => {
  it('shows the task details and starts: running label, keep-awake on, light haptic', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('Study')).toBeTruthy();
    expect(screen.getByText('Cue: After coffee')).toBeTruthy();
    expect(screen.getByText('Treat: Tea')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('min left')).toBeTruthy();
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(sessionCount()).toBe(1);
  });

  it('pauses and resumes, releasing and re-taking the keep-awake', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await advance(60_000);
    expect(screen.getByText('4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
    await advance(600); // cooldown over
    await advance(120_000); // paused time does not count
    expect(screen.getByText('4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByText('Running')).toBeTruthy();
    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(2);
    expect(sessionCount()).toBe(2);
  });

  it('leaving via back does not pause, and releases the keep-awake on unmount', async () => {
    const { read } = plan();
    const view = await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
    const open = allSessions().filter((s) => s.endedAt === null);
    expect(open).toHaveLength(1);
    await view.unmount();
    expect(deactivateKeepAwake).toHaveBeenCalled();
    expect(allSessions().filter((s) => s.endedAt === null)).toHaveLength(1);
  });

  it('reaching 0 on screen celebrates once, shows overtime and the jar; Stop earns gold at 60 s', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByText('Done for today')).toBeNull();
    await advance(5 * 60_000 + 50);
    expect(screen.getByText('Done · still going')).toBeTruthy();
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText('min extra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.getByRole('image', { name: /^Jar with / })).toBeTruthy();
    await advance(10_000);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1); // re-renders never replay it

    await advance(70_000); // overtime now > 60 s
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Gold ring earned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeTruthy();
    expect(deactivateKeepAwake).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('stopping under 60 s of overtime has no gold note', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await advance(5 * 60_000 + 30_000);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByText('Gold ring earned')).toBeNull();
  });

  it('reopening a done task shows it without a haptic', async () => {
    const { read } = plan();
    const first = await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await advance(5 * 60_000 + 50);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    await first.unmount();
    jest.clearAllMocks();
    await renderThemed(<RunScreen dayTaskId={read} />);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('opens on a task whose time ran out while away: overtime, no celebration haptic', async () => {
    const { read } = plan();
    const first = await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await first.unmount();
    clock += 6 * 60_000; // phone locked past the end
    reconcile(); // what the foreground hook does on unlock, before the screen is shown
    jest.clearAllMocks();
    await renderThemed(<RunScreen dayTaskId={read} />);
    expect(screen.getByText('Done · still going')).toBeTruthy();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('ticks without re-rendering the screen', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    const before = mockRenders;
    await advance(10_000);
    expect(mockRenders).toBe(before);
    expect(screen.getByText('5')).toBeTruthy(); // 4:50 left rounds up
    await advance(60_000);
    expect(mockRenders).toBe(before);
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('double-tapping Start makes one session', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    const start = screen.getByRole('button', { name: 'Start' });
    await fireEvent.press(start);
    await fireEvent.press(start);
    expect(sessionCount()).toBe(1);
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('shows a ValidationError inline', async () => {
    const { read } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    // Close today behind the screen's back, then press Start.
    applyOps(
      getDb(),
      { closeSessions: [], completions: [], outcomes: [], insertDayTasks: [], createDays: [], closeDays: [{ dayKey: TODAY, closedAt: T0, closedBy: 'user' }] },
      () => 'x',
      T0,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('This day is closed')).toBeTruthy();
    expect(sessionCount()).toBe(0);
  });

  it('starting another task pauses the first (other row)', async () => {
    const { read, other } = plan();
    const first = await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await first.unmount();
    await renderThemed(<RunScreen dayTaskId={other} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(allSessions().filter((s) => s.endedAt === null)).toHaveLength(1);
  });

  it('edits the note inline: debounced save, flushed when leaving', async () => {
    const { read, libId } = plan();
    await renderThemed(<RunScreen dayTaskId={read} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a note' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Chapter 3');
    const noteOf = () => getTask(getDb(), libId)?.note;
    expect(noteOf()).not.toBe('Chapter 3');
    await advance(700);
    expect(noteOf()).toBe('Chapter 3');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Chapter 4');
    await fireEvent.press(screen.getByRole('button', { name: 'Today' })); // leave flushes
    expect(noteOf()).toBe('Chapter 4');
  });

  it('shows no note card for a one-off task', async () => {
    const { other } = plan();
    await renderThemed(<RunScreen dayTaskId={other} />);
    expect(screen.queryByRole('button', { name: 'Add a note' })).toBeNull();
  });

  it('invalid ids and checklist tasks show the not-running state with Back', async () => {
    const { tick } = plan();
    const view = await renderThemed(<RunScreen dayTaskId="nope" />);
    expect(screen.getByText("This task isn't running today")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
    await view.rerender(<RunScreen dayTaskId={tick} />);
    expect(screen.getByText("This task isn't running today")).toBeTruthy();
    await view.rerender(<RunScreen dayTaskId={undefined} />);
    expect(screen.getByText("This task isn't running today")).toBeTruthy();
  });
});
