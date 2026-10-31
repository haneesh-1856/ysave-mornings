import { act, fireEvent, screen } from '@testing-library/react-native';

import { getDay, loadDayBundle } from '@/data/repos/days';
import { applyOps } from '@/data/repos/ops';
import { getTask, listTasks } from '@/data/repos/tasks';
import { listTopics } from '@/data/repos/topics';
import { buildPlan } from '@/domain/plan';
import { saveDayDraft } from '@/state/actions/plan';
import { createTask, createTopic, setTaskNote } from '@/state/actions/library';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { PlanScreen } from '../PlanScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockParam = '2026-10-30';
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: () => mockBack(), canGoBack: () => mockCanGoBack() },
  useLocalSearchParams: () => ({ dayKey: mockParam }),
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AT = Date.UTC(2026, 9, 29, 12, 0, 0); // Thursday 29 Oct; tomorrow is Friday 30 Oct
const ALL_DAYS = 0b1111111;
const MON_ONLY = 0b0000001; // not on Fridays
const MESSAGE =
  'You can plan today until it closes, or tomorrow. Days further out can be drafted from the Calendar with "Plan ahead".';

function seed() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  const read = createTask(study.id, { name: 'Read', minutes: 45, repeatMask: ALL_DAYS, isDefault: true });
  createTask(study.id, { name: 'Notes', kind: 'check', repeatMask: ALL_DAYS, isDefault: true });
  createTask(study.id, { name: 'Long run', minutes: 30, repeatMask: MON_ONLY });
  return { study, read };
}

beforeEach(() => {
  setupState(AT);
  mockParam = '2026-10-30';
  mockReplace.mockClear();
  mockBack.mockClear();
  mockCanGoBack.mockReturnValue(true);
});
afterEach(teardownState);

describe('PlanScreen', () => {
  it('shows tomorrow with defaults ticked, topic header and the Not on group', async () => {
    seed();
    await renderThemed(<PlanScreen />);
    expect(screen.getByText('Plan Friday')).toBeTruthy();
    expect(screen.getByText('Study')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Include Read' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Include Long run' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByText('Not on Fridays · tap to add once')).toBeTruthy();
    expect(screen.getByText('2 tasks · 45m planned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Friday looks like this ✓' })).toBeTruthy();
  });

  it('ticking and unticking changes the footer', async () => {
    seed();
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Long run' }));
    expect(screen.getByText('3 tasks · 1h 15m planned')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Read' }));
    expect(screen.getByText('2 tasks · 30m planned')).toBeTruthy();
  });

  it('adds a one-off task', async () => {
    seed();
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Dentist call');
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Dentist call')).toBeTruthy();
    expect(screen.getByText('just for Friday')).toBeTruthy();
    expect(screen.getByText('3 tasks · 1h 15m planned')).toBeTruthy();
  });

  it('confirm writes the plan and replaces once, even on a double tap', async () => {
    seed();
    await renderThemed(<PlanScreen />);
    const confirm = screen.getByRole('button', { name: 'Friday looks like this ✓' });
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/planned/[dayKey]', params: { dayKey: '2026-10-30' } });
    expect(getDay(getDb(), '2026-10-30')?.planConfirmedAt).not.toBeNull();
    expect(loadDayBundle(getDb(), '2026-10-30')?.dayTasks.map(d => d.name).sort()).toEqual(['Notes', 'Read']);
    // the screen still shows the plan (frozen draft), not the not-plannable message
    expect(screen.getByText('Plan Friday')).toBeTruthy();
  });

  it('shows the message and Back for a day that cannot be planned', async () => {
    seed();
    mockParam = '2026-10-28'; // yesterday
    await renderThemed(<PlanScreen />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Back with no history (Plan opened by replace) goes to Today', async () => {
    seed();
    mockCanGoBack.mockReturnValue(false);
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/today');
  });

  it('shows the message for a closed today', async () => {
    seed();
    applyOps(
      getDb(),
      {
        closeSessions: [], completions: [], outcomes: [], insertDayTasks: [], forwardDayTasks: [], closeDays: [],
        createDays: [{ dayKey: '2026-10-29', planConfirmedAt: null, planDraftedAt: null, closedAt: 1, closedBy: 'user', dayStartHour: 4 }],
      },
      () => 'x',
      1,
    );
    mockParam = '2026-10-29';
    await renderThemed(<PlanScreen />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it('shows the message for a malformed param', async () => {
    mockParam = 'not-a-day';
    await renderThemed(<PlanScreen />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it('titles today "Plan today" when today has no plan', async () => {
    seed();
    mockParam = '2026-10-29';
    await renderThemed(<PlanScreen />);
    expect(screen.getByText('Plan today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thursday looks like this ✓' })).toBeTruthy();
  });

  it('re-opens a confirmed today for editing (ADR-009): rows load saved, Confirm keeps planConfirmedAt', async () => {
    seed();
    mockParam = '2026-10-29';
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Thursday looks like this ✓' }));
    const first = getDay(getDb(), '2026-10-29')!.planConfirmedAt;
    expect(first).not.toBeNull();
    await act(async () => {
      screen.unmount();
    });
    mockReplace.mockClear();
    await renderThemed(<PlanScreen />);
    expect(screen.getByText('Plan today')).toBeTruthy();
    expect(screen.queryByText(MESSAGE)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Thursday looks like this ✓' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/planned/[dayKey]', params: { dayKey: '2026-10-29' } });
    expect(getDay(getDb(), '2026-10-29')!.planConfirmedAt).toBe(first);
  });

  it('saves a note to the library task after the debounce', async () => {
    const { read } = seed();
    jest.useFakeTimers();
    try {
      await renderThemed(<PlanScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Edit Read for Friday' }));
      await fireEvent.changeText(screen.getByLabelText('Note'), 'chapter 3');
      expect(getTask(getDb(), read.id)?.note).toBe('');
      await act(async () => {
        jest.advanceTimersByTime(450);
      });
      expect(getTask(getDb(), read.id)?.note).toBe('chapter 3');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a one-off row has no Note field', async () => {
    seed();
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Dentist call');
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Dentist call for Friday' }));
    expect(screen.getByLabelText('After class')).toBeTruthy(); // the row really is expanded
    expect(screen.queryByLabelText('Note')).toBeNull();
  });

  it('shows the library note when a row expands and a new topic appears live', async () => {
    const { read } = seed();
    setTaskNote(read.id, 'ch 2');
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Read for Friday' }));
    expect(screen.getByLabelText('Note').props.value).toBe('ch 2');
    await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
    expect(screen.queryByRole('radio', { name: 'Home' })).toBeNull();
    await act(async () => {
      createTopic({ name: 'Home', colorKey: 'home' });
    });
    expect(screen.getByRole('radio', { name: 'Home' })).toBeTruthy();
  });

  it('flushes a pending note when the row collapses', async () => {
    const { read } = seed();
    await renderThemed(<PlanScreen />);
    const edit = screen.getByRole('button', { name: 'Edit Read for Friday' });
    await fireEvent.press(edit);
    await fireEvent.changeText(screen.getByLabelText('Note'), 'quick');
    await fireEvent.press(edit);
    expect(getTask(getDb(), read.id)?.note).toBe('quick');
  });

  describe('draft mode (a day after tomorrow)', () => {
    const LATER = '2026-11-04'; // Wednesday

    it('titles it Plan ahead with the date, and offers Save draft instead of confirm', async () => {
      seed();
      mockParam = LATER;
      await renderThemed(<PlanScreen />);
      expect(screen.getByText('Plan ahead')).toBeTruthy();
      expect(screen.getByText('Wednesday, 4 November')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /looks like this/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull(); // nothing saved yet
      expect(screen.getByText('A draft is saved for later. You confirm it the evening before.')).toBeTruthy();
      expect(screen.queryByText(/planned$/)).toBeNull();
    });

    it('Save draft writes a draft (not a plan), goes back once, never opens Planned', async () => {
      seed();
      mockParam = LATER;
      await renderThemed(<PlanScreen />);
      const save = screen.getByRole('button', { name: 'Save draft' });
      await fireEvent.press(save);
      await fireEvent.press(save);
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(getDay(getDb(), LATER)).toMatchObject({ planConfirmedAt: null });
      expect(getDay(getDb(), LATER)?.planDraftedAt).not.toBeNull();
    });

    it('Save draft with no history (cold deep link) goes to Today', async () => {
      seed();
      mockParam = LATER;
      mockCanGoBack.mockReturnValue(false);
      await renderThemed(<PlanScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
      expect(getDay(getDb(), LATER)?.planDraftedAt).not.toBeNull();
    });

    it('Save draft is disabled while nothing is ticked', async () => {
      seed();
      mockParam = LATER;
      await renderThemed(<PlanScreen />);
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Read' }));
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Notes' }));
      expect(screen.getByRole('button', { name: 'Save draft' }).props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
      expect(screen.getByText('Tick at least one task, or discard the draft.')).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('hides the draft hint once a draft has been saved', async () => {
      seed();
      mockParam = LATER;
      saveDayDraft(LATER, buildPlan({ dayKey: LATER, topics: listTopics(getDb()), tasks: listTasks(getDb()), day: null, dayTasks: [] }));
      await renderThemed(<PlanScreen />);
      expect(screen.queryByText(/A draft is saved for later/)).toBeNull();
    });

    it('Discard draft asks first, can be cancelled, then discards and goes back', async () => {
      seed();
      mockParam = LATER;
      saveDayDraft(LATER, buildPlan({ dayKey: LATER, topics: listTopics(getDb()), tasks: listTasks(getDb()), day: null, dayTasks: [] }));
      await renderThemed(<PlanScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
      expect(screen.getByText('Discard this draft? Nothing else changes.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Discard this draft? Nothing else changes.')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(getDay(getDb(), LATER)).toBeNull();
    });

    it('Discard draft with no history (cold deep link) goes to Today', async () => {
      seed();
      mockParam = LATER;
      mockCanGoBack.mockReturnValue(false);
      saveDayDraft(LATER, buildPlan({ dayKey: LATER, topics: listTopics(getDb()), tasks: listTasks(getDb()), day: null, dayTasks: [] }));
      await renderThemed(<PlanScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
      expect(getDay(getDb(), LATER)).toBeNull();
    });
  });
});
