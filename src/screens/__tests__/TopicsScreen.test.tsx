import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { listTasks } from '@/data/repos/tasks';
import { getTopic } from '@/data/repos/topics';
import { createTask, createTopic, updateTopic } from '@/state/actions/library';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { TopicsScreen } from '../TopicsScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AT = Date.UTC(2026, 9, 29, 8, 0, 0);
const saved = () => listTasks(getDb());

function openTopic(name = 'Study') {
  const topic = createTopic({ name, colorKey: 'study' });
  if (!topic.isOpen) updateTopic(topic.id, { isOpen: true });
  return topic;
}

beforeEach(() => {
  setupState(AT);
  mockPush.mockClear();
});
afterEach(teardownState);

describe('TopicsScreen', () => {
  it('shows the empty state and opens the new-topic form', async () => {
    await renderThemed(<TopicsScreen />);
    expect(screen.getByText('0 topics · 0 tasks')).toBeTruthy();
    expect(screen.getByText('No topics yet')).toBeTruthy();
    expect(screen.getByText('Start with one thing you want to give time to.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '+ New topic' }));
    expect(mockPush).toHaveBeenCalledWith('/topic/new');
  });

  it('lists topics with counts, weekly time and the edit button', async () => {
    const study = openTopic();
    createTask(study.id, { name: 'Read', minutes: 45, repeatMask: 0b0011111 }); // 5 x 45 = 225
    createTask(study.id, { name: 'Notes', kind: 'check' });
    await renderThemed(<TopicsScreen />);
    expect(screen.getByText('1 topic · 2 tasks')).toBeTruthy();
    expect(screen.getByText("Tap a task to flip it. Dots are this week's marbles.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Study, 2 tasks · 3h 45m / week' })).toBeTruthy();
    expect(screen.getByText('Weekdays · 45 min')).toBeTruthy();
    expect(screen.getByText('No repeat days · checklist')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Study' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/topic/[id]', params: { id: study.id } });
  });

  it('toggling a fold persists isOpen', async () => {
    const study = openTopic();
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Study/ }));
    expect(getTopic(getDb(), study.id)?.isOpen).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: /^Study/ }));
    expect(getTopic(getDb(), study.id)?.isOpen).toBe(true);
  });

  it('a blank draft is discarded; a named one is saved with the draft defaults', async () => {
    openTopic();
    await renderThemed(<TopicsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add the first task to Study' }));
    expect(screen.getByLabelText('Task name')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' })); // blank -> nothing written
    expect(saved()).toHaveLength(0);
    expect(screen.queryByLabelText('Task name')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add the first task to Study' }));
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read');
    await waitFor(() => expect(saved()).toHaveLength(1), { timeout: 2000 });
    expect(saved()[0]).toMatchObject({ name: 'Read', kind: 'timed', minutes: 30, repeatMask: 0, isDefault: false });
    // the card stays open on the same draft, and now edits the real task
    await fireEvent.press(screen.getByRole('switch', { name: 'Default task' }));
    expect(saved()[0].isDefault).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('No repeat days · 30 min · default')).toBeTruthy();
    expect(screen.getByText('1 topic · 1 task')).toBeTruthy();
  });

  it('flipping to another card discards a blank draft', async () => {
    const study = openTopic();
    createTask(study.id, { name: 'Read' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add task to Study' }));
    expect(screen.getByLabelText('Task name')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));
    expect(saved()).toHaveLength(1);
    expect(screen.getAllByLabelText('Task name')).toHaveLength(1);
    expect(screen.getByDisplayValue('Read')).toBeTruthy();
  });

  it('edits save: debounced name, flushed on Done; a blank name is not saved', async () => {
    const study = openTopic();
    createTask(study.id, { name: 'Read' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));

    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read more');
    expect(saved()[0].name).toBe('Read'); // not yet: debounced
    await waitFor(() => expect(saved()[0].name).toBe('Read more'), { timeout: 2000 });

    await fireEvent.changeText(screen.getByLabelText('Task name'), '   ');
    expect(screen.getByText('A task needs a name')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'chapter 3');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' })); // flushes at once
    expect(saved()[0]).toMatchObject({ name: 'Read more', note: 'chapter 3' });

    await fireEvent.press(screen.getByRole('button', { name: /^Read more,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Checklist' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'After class' }));
    expect(saved()[0]).toMatchObject({ kind: 'check', cue: 'After class', minutes: 30 });
  });

  it('only one card is flipped at a time', async () => {
    const study = openTopic();
    createTask(study.id, { name: 'Read' });
    createTask(study.id, { name: 'Write' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Write,/ }));
    expect(screen.getAllByLabelText('Task name')).toHaveLength(1);
    expect(screen.getByDisplayValue('Write')).toBeTruthy();
  });

  it('delete asks first, then removes the task', async () => {
    const study = openTopic();
    createTask(study.id, { name: 'Read' });
    await renderThemed(<TopicsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Read,/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
    expect(saved()).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(saved()).toHaveLength(0);
    expect(screen.getByText('1 topic · 0 tasks')).toBeTruthy();
  });
});
