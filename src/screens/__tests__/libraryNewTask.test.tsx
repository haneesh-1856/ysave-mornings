import { act, fireEvent, screen } from '@testing-library/react-native';

import { softDeleteTopic } from '@/data/repos/topics';
import { listTasks } from '@/data/repos/tasks';
import { NO_TOPIC_ID } from '@/domain/types';
import { createTask, createTopic, removeTopic, updateTask, updateTopic } from '@/state/actions/library';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { PlanScreen } from '../PlanScreen';
import { TopicsScreen } from '../TopicsScreen';

/** Chunk 13 (phone check): the Library makes tasks without a topic ("+ New task") and moves them with a topic picker. */

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true, push: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ dayKey: '2026-10-30' }),
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const THURSDAY = Date.UTC(2026, 9, 29, 16, 0, 0); // noon in New York
const saved = () => listTasks(getDb());
const FRIDAY_ONLY = 0b0010000; // Mon = bit 0 ... Fri = bit 4

beforeEach(() => {
  setupState(THURSDAY);
  setClockOverride(() => THURSDAY);
});
afterEach(() => {
  jest.useRealTimers();
  teardownState();
});

function openTopic(name: string, colorKey: 'study' | 'health' = 'study') {
  const topic = createTopic({ name, colorKey });
  if (!topic.isOpen) updateTopic(topic.id, { isOpen: true });
  return topic;
}

/** Types a name into the open card and lets the 400 ms debounce fire. */
async function nameIt(text: string) {
  jest.useFakeTimers();
  await fireEvent.changeText(screen.getByLabelText('Task name'), text);
  await act(async () => { jest.advanceTimersByTime(450); });
  jest.useRealTimers();
}

describe('Library: new task without a topic', () => {
  it('(a) empty library -> "+ New task" -> name -> Done lists it under No topic, and Plan shows it', async () => {
    await renderThemed(<TopicsScreen />);
    expect(screen.getByText('No topics yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('library-new-task'));
    expect(screen.getByLabelText('Task name')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'No topic' }).props.accessibilityState.checked).toBe(true);
    await nameIt('Call the bank');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(saved()).toHaveLength(1);
    expect(saved()[0]).toMatchObject({ name: 'Call the bank', topicId: NO_TOPIC_ID });
    expect(screen.getByRole('button', { name: /^No topic, / })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Call the bank,/ })).toBeTruthy();
    expect(screen.queryByText('No topics yet')).toBeNull();

    updateTask(saved()[0].id, { repeatMask: FRIDAY_ONLY, isDefault: true });
    await renderThemed(<PlanScreen />);
    expect(screen.getByText('Call the bank')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'No topic' })).toBeTruthy();
  });

  it('an unnamed "+ New task" draft is discarded by Delete task and leaves no No topic group', async () => {
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(saved()).toHaveLength(0);
    expect(screen.queryByLabelText('Task name')).toBeNull();
    expect(screen.queryByText('No topic')).toBeNull();
    expect(screen.getByText('No topics yet')).toBeTruthy();
  });

  it('(b) with topics present, "+ New task" then picking Study creates the task inside Study', async () => {
    const study = openTopic('Study');
    openTopic('Move', 'health');
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    const names = screen.getAllByRole('radio').map(r => r.props.accessibilityLabel);
    expect(names.slice(0, 3)).toEqual(['No topic', 'Study', 'Move']);
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    await nameIt('Read');
    expect(saved()[0]).toMatchObject({ name: 'Read', topicId: study.id });
    expect(screen.getByRole('radio', { name: 'Study' }).props.accessibilityState.checked).toBe(true); // card stays open on the real task
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Study, 1 task · 0m / week' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^No topic, / })).toBeNull();
  });

  it('a draft keeps the topic picked before it has a name', async () => {
    const study = openTopic('Study');
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    expect(screen.getByRole('radio', { name: 'Study' }).props.accessibilityState.checked).toBe(true);
    expect(saved()).toHaveLength(0);
    await nameIt('Read');
    expect(saved()[0].topicId).toBe(study.id);
  });

  it('(c) an existing task in Study -> pick No topic -> moves to the No topic group; Study count updates', async () => {
    const study = openTopic('Study');
    createTask(study.id, { name: 'Read' });
    createTask(study.id, { name: 'Notes' });
    await renderThemed(<TopicsScreen />);
    expect(screen.queryByRole('button', { name: /^No topic, / })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));
    expect(screen.getByRole('radio', { name: 'Study' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'No topic' }));

    expect(saved().find(x => x.name === 'Read')!.topicId).toBe(NO_TOPIC_ID);
    expect(screen.getByRole('button', { name: /^No topic, / })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Study, 1 task/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'No topic' }).props.accessibilityState.checked).toBe(true); // still open, in its new group
  });

  it('(d) moving the last task out of No topic hides the group', async () => {
    const study = openTopic('Study');
    createTask(null, { name: 'Loose' });
    await renderThemed(<TopicsScreen />);
    expect(screen.getByRole('button', { name: /^No topic, / })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Loose,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    expect(saved()[0].topicId).toBe(study.id);
    expect(screen.queryByRole('button', { name: /^No topic, / })).toBeNull();
    expect(screen.getByRole('button', { name: /^Study, 1 task/ })).toBeTruthy();
  });

  it('(e) "+ Add task" inside a topic defaults the picker to that topic', async () => {
    openTopic('Study');
    openTopic('Move', 'health');
    createTask(null, { name: 'Loose' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add the first task to Move' }));
    expect(screen.getByRole('radio', { name: 'Move' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'No topic' }).props.accessibilityState.checked).toBe(false);
  });

  it('a move to a topic deleted meanwhile shows field error text and does not crash', async () => {
    const study = openTopic('Study');
    const move = openTopic('Move', 'health');
    createTask(study.id, { name: 'Read' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));
    softDeleteTopic(getDb(), move.id, THURSDAY); // behind the screen's back: the picker still lists it
    await fireEvent.press(screen.getByRole('radio', { name: 'Move' }));
    expect(screen.getByText('That topic no longer exists. Pick another.')).toBeTruthy();
    expect(saved()[0].topicId).toBe(study.id);
    await fireEvent.press(screen.getByRole('radio', { name: 'No topic' })); // a good choice clears it
    expect(screen.queryByText('That topic no longer exists. Pick another.')).toBeNull();
  });
});

describe('Library: new task, check and fix', () => {
  const rows = () => saved().map(x => [x.name, x.topicId]);

  it('"+ New task" again after the draft was named starts a second task and keeps the first', async () => {
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    await nameIt('First');
    await fireEvent.press(screen.getByTestId('library-new-task'));
    expect(screen.getByLabelText('Task name').props.value).toBe(''); // a fresh blank draft
    expect(screen.getByRole('button', { name: /^First,/ })).toBeTruthy(); // the first is a saved card now
    await nameIt('Second');
    expect(rows()).toEqual([['First', NO_TOPIC_ID], ['Second', NO_TOPIC_ID]]);
  });

  it('"+ Add task" in a topic after naming a draft there and closing it starts a second task', async () => {
    const study = openTopic('Study');
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add the first task to Study' }));
    await nameIt('Read');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add task to Study' }));
    expect(screen.getByLabelText('Task name').props.value).toBe('');
    await nameIt('Notes');
    expect(rows()).toEqual([['Read', study.id], ['Notes', study.id]]);
  });

  it('a name typed while the chosen topic was deleted is created once a good topic is picked', async () => {
    const study = openTopic('Study');
    const move = openTopic('Move', 'health');
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Move' }));
    await act(async () => { removeTopic(move.id); });
    await nameIt('Typed');
    expect(screen.getByText('That topic no longer exists. Pick another.')).toBeTruthy();
    expect(saved()).toHaveLength(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Study' }));
    expect(screen.queryByText('That topic no longer exists. Pick another.')).toBeNull();
    expect(rows()).toEqual([['Typed', study.id]]);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(rows()).toEqual([['Typed', study.id]]);
    expect(screen.getByRole('button', { name: /^Typed,/ })).toBeTruthy();
  });

  it('Done on a named draft whose topic is gone keeps the card open with the error', async () => {
    const move = openTopic('Move', 'health');
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByTestId('library-new-task'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Move' }));
    await act(async () => { removeTopic(move.id); });
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Typed'); // Done before the debounce
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(saved()).toHaveLength(0);
    expect(screen.getByLabelText('Task name').props.value).toBe('Typed');
    expect(screen.getByText('That topic no longer exists. Pick another.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'No topic' }));
    expect(rows()).toEqual([['Typed', NO_TOPIC_ID]]);
  });
});
