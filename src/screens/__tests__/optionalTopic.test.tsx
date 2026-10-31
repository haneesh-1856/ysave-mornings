import { act, fireEvent, screen } from '@testing-library/react-native';

import { loadDayBundle } from '@/data/repos/days';
import { NO_TOPIC_ID } from '@/domain/types';
import { createTask, createTopic } from '@/state/actions/library';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { PlanScreen } from '../PlanScreen';
import { RunScreen } from '../RunScreen';
import { TopicsScreen } from '../TopicsScreen';

/** Chunk 12 (phone check): a one-off task needs no topic, and it can carry a note for the day. */

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true, push: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ dayKey: '2026-10-30' }),
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

const THURSDAY = Date.UTC(2026, 9, 29, 16, 0, 0); // noon in New York
const FRIDAY = Date.UTC(2026, 9, 30, 16, 0, 0);
let clock = THURSDAY;

beforeEach(() => {
  setupState(THURSDAY);
  clock = THURSDAY;
  setClockOverride(() => clock);
});
afterEach(teardownState);

async function addOneOff(name: string, note?: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
  await fireEvent.changeText(screen.getByLabelText('Task name'), name);
  if (note !== undefined) await fireEvent.changeText(screen.getByLabelText('Note for Friday'), note);
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

describe('one-off task without a topic', () => {
  it('(a) a name alone enables Add; the row sits under No topic and confirms with the No topic id', async () => {
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
    expect(screen.getByRole('button', { name: 'Add' }).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'No topic' }).props.accessibilityState.checked).toBe(true); // first, selected
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Call the bank');
    expect(screen.getByRole('button', { name: 'Add' }).props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Call the bank')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'No topic' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Friday looks like this ✓' }));
    const rows = loadDayBundle(getDb(), '2026-10-30')!.dayTasks;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Call the bank', topicId: NO_TOPIC_ID, colorKey: 'none', taskId: null, note: null });
  });

  it('the topic picker lists No topic first, then the real topics', async () => {
    createTopic({ name: 'Study', colorKey: 'study' });
    await renderThemed(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a one-off task' }));
    const names = screen.getAllByRole('radio').map(r => r.props.accessibilityLabel);
    expect(names.slice(0, 2)).toEqual(['No topic', 'Study']);
  });

  it('(b) a note typed in the form is stored on the day row and shows on the task page next day', async () => {
    await renderThemed(<PlanScreen />);
    await addOneOff('Call the bank', 'ask about the fee');
    await fireEvent.press(screen.getByRole('button', { name: 'Friday looks like this ✓' }));
    expect(loadDayBundle(getDb(), '2026-10-30')!.dayTasks[0].note).toBe('ask about the fee');

    clock = FRIDAY;
    reconcile();
    const id = loadDayBundle(getDb(), '2026-10-30')!.dayTasks[0].id;
    await renderThemed(<RunScreen dayTaskId={id} />);
    expect(screen.getByText('Note for Friday')).toBeTruthy();
    expect(screen.getByText('ask about the fee')).toBeTruthy();
  });

  it('a blank note stays null', async () => {
    await renderThemed(<PlanScreen />);
    await addOneOff('Call the bank', '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Friday looks like this ✓' }));
    expect(loadDayBundle(getDb(), '2026-10-30')!.dayTasks[0].note).toBeNull();
  });

  it('(e) the Library does not list No topic while empty, and lists it as a group once a task is in it', async () => {
    await renderThemed(<TopicsScreen />);
    expect(screen.queryByText('No topic')).toBeNull();
    expect(screen.getByText(/No topics yet/)).toBeTruthy();
    await act(async () => {
      createTask(null, { name: 'Loose task' });
    });
    expect(screen.getByText('No topic')).toBeTruthy();
  });
});
