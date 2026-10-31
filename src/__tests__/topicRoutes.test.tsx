import { act, fireEvent, screen } from '@testing-library/react-native';

import EditTopic from '../app/topic/[id]';
import NewTopic from '../app/topic/new';
import { ValidationError } from '../data/errors';
import * as topicsRepo from '../data/repos/topics';
import { listTasks } from '../data/repos/tasks';
import { getTopic, listUserTopics } from '../data/repos/topics';
import type { DB } from '../data/types';
import { createTask, createTopic, removeTopic } from '../state/actions/library';
import { setupState, teardownState } from '../state/testSupport';
import { renderThemed } from '../ui/testing';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const mockBack = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../state/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

let db: DB;
beforeEach(() => {
  db = setupState(Date.UTC(2026, 9, 29, 6));
  mockBack.mockClear();
  mockParams = {};
});
afterEach(() => {
  jest.restoreAllMocks();
  teardownState();
});

const COLORS = ['study', 'health', 'home', 'sun', 'c4', 'c5'] as const;

describe('new topic route', () => {
  it('creates a topic with the first unused color and goes back', async () => {
    createTopic({ name: 'Study', colorKey: 'study' });
    createTopic({ name: 'Health', colorKey: 'health' });
    await renderThemed(<NewTopic />);
    expect(screen.getByRole('header', { name: 'New topic' })).toBeTruthy();
    expect(screen.getByLabelText('Color 3').props.accessibilityState.selected).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Home');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(listUserTopics(db).find((t) => t.name === 'Home')?.colorKey).toBe('home');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to study when all colors are used', async () => {
    COLORS.forEach((k, i) => createTopic({ name: `T${i}`, colorKey: k }));
    await renderThemed(<NewTopic />);
    expect(screen.getByLabelText('Color 1').props.accessibilityState.selected).toBe(true);
  });

  it('back button goes back without saving', async () => {
    await renderThemed(<NewTopic />);
    await fireEvent.press(screen.getByLabelText('Back to Topics'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(listUserTopics(db)).toHaveLength(0);
  });

  it('shows a ValidationError inline instead of throwing, and stays', async () => {
    jest.spyOn(topicsRepo, 'createTopic').mockImplementation(() => {
      throw new ValidationError('name', 'Topic name must be 1-24 characters');
    });
    await renderThemed(<NewTopic />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Okay');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(screen.getByText('Topic name must be 1-24 characters')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('rethrows errors that are not validation errors', async () => {
    jest.spyOn(topicsRepo, 'createTopic').mockImplementation(() => {
      throw new Error('disk full');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderThemed(<NewTopic />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Okay');
    await expect(fireEvent.press(screen.getByLabelText('Save'))).rejects.toThrow('disk full');
  });

  it('double-pressing Save creates exactly one topic and goes back once', async () => {
    await renderThemed(<NewTopic />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Home');
    const save = screen.getByLabelText('Save');
    // both presses land before any re-render: only the synchronous ref guard can stop the second
    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    // and a press after the re-render hits a disabled button
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(listUserTopics(db)).toHaveLength(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Save').props.accessibilityState?.disabled).toBe(true);
  });

  it('a ValidationError re-enables Save so the user can correct and retry', async () => {
    const spy = jest.spyOn(topicsRepo, 'createTopic').mockImplementationOnce(() => {
      throw new ValidationError('name', 'Topic name must be 1-24 characters');
    });
    await renderThemed(<NewTopic />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Okay');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(screen.getByText('Topic name must be 1-24 characters')).toBeTruthy();
    expect(screen.getByLabelText('Save').props.accessibilityState?.disabled).toBeFalsy();
    spy.mockRestore();
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(listUserTopics(db).map((t) => t.name)).toEqual(['Okay']);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('edit topic route', () => {
  it('prefills, saves changes and goes back', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    mockParams = { id: t.id };
    await renderThemed(<EditTopic />);
    expect(screen.getByRole('header', { name: 'Edit topic' })).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Study');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Exams');
    await fireEvent.press(screen.getByLabelText('Color 2'));
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(getTopic(db, t.id)).toMatchObject({ name: 'Exams', colorKey: 'health' });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a ValidationError inline on edit', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    mockParams = { id: t.id };
    jest.spyOn(topicsRepo, 'updateTopic').mockImplementation(() => {
      throw new ValidationError('name', 'Topic name must be 1-24 characters');
    });
    await renderThemed(<EditTopic />);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(screen.getByText('Topic name must be 1-24 characters')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Save').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('double-pressing Save on edit goes back once', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    mockParams = { id: t.id };
    const spy = jest.spyOn(topicsRepo, 'updateTopic');
    await renderThemed(<EditTopic />);
    const save = screen.getByLabelText('Save');
    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('double-pressing the Remove confirm goes back once', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    mockParams = { id: t.id };
    const spy = jest.spyOn(topicsRepo, 'softDeleteTopic');
    await renderThemed(<EditTopic />);
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    const confirm = screen.getByLabelText('Remove');
    await act(async () => {
      fireEvent.press(confirm);
      fireEvent.press(confirm);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('remove soft-deletes the topic and its tasks, then goes back', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    createTask(t.id, { name: 'Read' });
    expect(listTasks(db)).toHaveLength(1);
    mockParams = { id: t.id };
    await renderThemed(<EditTopic />);
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    await fireEvent.press(screen.getByLabelText('Remove'));
    expect(listUserTopics(db)).toHaveLength(0);
    expect(listTasks(db)).toHaveLength(0);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('unknown id shows the missing message and a working back button', async () => {
    mockParams = { id: 'nope' };
    await renderThemed(<EditTopic />);
    expect(screen.getByText('This topic no longer exists')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Back to Topics')[0]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('a topic removed while open turns into the missing message', async () => {
    const t = createTopic({ name: 'Study', colorKey: 'study' });
    mockParams = { id: t.id };
    await renderThemed(<EditTopic />);
    await act(() => removeTopic(t.id));
    expect(screen.getByText('This topic no longer exists')).toBeTruthy();
  });
});
