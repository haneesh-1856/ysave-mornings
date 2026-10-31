import { act, fireEvent, screen } from '@testing-library/react-native';

import EditTopic from '../app/topic/[id]';
import { ValidationError } from '../data/errors';
import { loadDayBundle } from '../data/repos/days';
import { getTask, listTasks } from '../data/repos/tasks';
import * as topicsRepo from '../data/repos/topics';
import { getTopic, listTopics, listUserTopics } from '../data/repos/topics';
import { addDays } from '../domain/dayKey';
import type { PlanDraft } from '../domain/plan';
import { NO_TOPIC_ID } from '../domain/types';
import { createTask, createTopic, removeTask, removeTopic } from '../state/actions/library';
import { confirmDayPlan } from '../state/actions/plan';
import { now } from '../state/clock';
import { getDb } from '../state/dbRef';
import { setupState, teardownState } from '../state/testSupport';
import { todayKey } from '../state/today';
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

let db: ReturnType<typeof setupState>;
beforeEach(() => {
  db = setupState(Date.UTC(2026, 9, 29, 6));
  mockBack.mockClear();
  mockParams = {};
});
afterEach(() => {
  jest.restoreAllMocks();
  teardownState();
});

const names = (topicId: string) => listTasks(db, topicId).map(t => t.name);

/** Study with tasks Read, Sums, Walk (in order), the edit screen open on it. */
async function openStudy(extraTopic = false) {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  const home = extraTopic ? createTopic({ name: 'Home', colorKey: 'home' }) : null;
  const read = createTask(study.id, { name: 'Read' });
  const sums = createTask(study.id, { name: 'Sums' });
  const walk = createTask(study.id, { name: 'Walk' });
  mockParams = { id: study.id };
  await renderThemed(<EditTopic />);
  return { study, home, read, sums, walk };
}

const toStep = async () => {
  await fireEvent.press(screen.getByLabelText('Remove topic'));
  await fireEvent.press(screen.getByLabelText('Yes, move tasks'));
};
/** Open a task's destination and pick an option for it. */
const pick = async (task: string, from: string, option: string) => {
  await fireEvent.press(screen.getByLabelText(`${task}, moves to ${from}. Change`));
  await fireEvent.press(screen.getByLabelText(option));
};

describe('deleting a topic that has tasks', () => {
  it('(a) each task gets its own destination: Read -> Home, Sums -> No topic, Walk -> Delete', async () => {
    const { study, home } = await openStudy(true);
    createTask(home!.id, { name: 'Existing' });
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    expect(screen.getByText('Study has 3 tasks. Move any of them before deleting?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Yes, move tasks'));
    expect(screen.getByText('3 move · 0 are deleted')).toBeTruthy();
    await pick('Read', 'No topic', 'Home');
    expect(screen.getByLabelText('Read, moves to Home. Change')).toBeTruthy();
    await pick('Walk', 'No topic', 'Delete');
    expect(screen.getByLabelText('Walk, is deleted. Change')).toBeTruthy();
    expect(screen.getByText('2 move · 1 is deleted')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(getTopic(db, study.id)?.deletedAt).not.toBeNull();
    expect(names(home!.id)).toEqual(['Existing', 'Read']);
    expect(names(NO_TOPIC_ID)).toEqual(['Sums']);
    expect(listTasks(db).map(t => t.name).sort()).toEqual(['Existing', 'Read', 'Sums']);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('(b) two tasks to the same target keep their original order', async () => {
    const { home } = await openStudy(true);
    await toStep();
    await pick('Walk', 'No topic', 'Home');
    await pick('Read', 'No topic', 'Home');
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(names(home!.id)).toEqual(['Read', 'Walk']);
    expect(names(NO_TOPIC_ID)).toEqual(['Sums']);
  });

  it('(c) a task picker offers No topic, other topics and Delete, never the topic itself; one row open at a time', async () => {
    await openStudy(true);
    await toStep();
    await fireEvent.press(screen.getByLabelText('Read, moves to No topic. Change'));
    expect(screen.getByLabelText('Move Read to')).toBeTruthy();
    expect(screen.getByLabelText('No topic').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Delete')).toBeTruthy();
    expect(screen.queryByLabelText('Study')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Sums, moves to No topic. Change'));
    expect(screen.queryByLabelText('Move Read to')).toBeNull();
    expect(screen.getByLabelText('Move Sums to')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Home')); // picking collapses the row
    expect(screen.queryByLabelText('Move Sums to')).toBeNull();
    expect(screen.getByLabelText('Sums, moves to Home. Change')).toBeTruthy();
  });

  it('the summary counts singular and plural, and 0 move when all are deleted', async () => {
    await openStudy();
    await toStep();
    await pick('Read', 'No topic', 'Delete');
    await pick('Sums', 'No topic', 'Delete');
    expect(screen.getByText('1 moves · 2 are deleted')).toBeTruthy();
    await pick('Walk', 'No topic', 'Delete');
    expect(screen.getByText('0 move · 3 are deleted')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(listTasks(db)).toEqual([]);
  });

  it('No, delete all removes the topic and all its tasks', async () => {
    const { study } = await openStudy();
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    await fireEvent.press(screen.getByLabelText('No, delete all'));
    expect(getTopic(db, study.id)?.deletedAt).not.toBeNull();
    expect(listTasks(db)).toEqual([]);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('Cancel and Back change nothing', async () => {
    const { study } = await openStudy();
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.getByLabelText('Remove topic')).toBeTruthy();
    await toStep();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText('No, delete all')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(getTopic(db, study.id)?.deletedAt).toBeNull();
    expect(names(study.id)).toEqual(['Read', 'Sums', 'Walk']);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('double-pressing the move confirm acts once', async () => {
    await openStudy();
    await toStep();
    const go = screen.getByLabelText('Move and delete topic');
    await act(async () => {
      fireEvent.press(go);
      fireEvent.press(go);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(names(NO_TOPIC_ID)).toEqual(['Read', 'Sums', 'Walk']);
  });

  it('a refusal shows as text and does not go back', async () => {
    await openStudy();
    await toStep();
    jest.spyOn(topicsRepo, 'softDeleteTopic').mockImplementation(() => {
      throw new ValidationError('toTopicId', 'That topic no longer exists. Pick another.');
    });
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(screen.getByText('That topic no longer exists. Pick another.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('a task removed elsewhere meanwhile is skipped; one added meanwhile defaults to No topic', async () => {
    const { study, sums } = await openStudy();
    await toStep();
    await act(async () => {
      removeTask(sums.id);
      createTask(study.id, { name: 'Late' });
    });
    expect(screen.queryByLabelText('Sums, moves to No topic. Change')).toBeNull();
    expect(screen.getByLabelText('Late, moves to No topic. Change')).toBeTruthy();
    expect(screen.getByText('3 move · 0 are deleted')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(names(NO_TOPIC_ID)).toEqual(['Read', 'Walk', 'Late']);
  });

  it('a chosen topic removed elsewhere meanwhile falls back to No topic', async () => {
    const { home } = await openStudy(true);
    await toStep();
    await pick('Sums', 'No topic', 'Home');
    expect(screen.getByLabelText('Sums, moves to Home. Change')).toBeTruthy();
    await act(async () => { removeTopic(home!.id); });
    expect(screen.getByLabelText('Sums, moves to No topic. Change')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move and delete topic'));
    expect(names(NO_TOPIC_ID)).toEqual(['Read', 'Sums', 'Walk']);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('deleting a topic with no tasks', () => {
  it('keeps the simple confirm', async () => {
    const t = createTopic({ name: 'Empty', colorKey: 'home' });
    mockParams = { id: t.id };
    await renderThemed(<EditTopic />);
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    expect(screen.queryByLabelText('Yes, move tasks')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Remove'));
    expect(listUserTopics(db)).toHaveLength(0);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('removeTopic with moves (state)', () => {
  it('(d) is one transaction: an invalid target in one move leaves the topic and every task untouched', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const home = createTopic({ name: 'Home', colorKey: 'home' });
    const gone = createTopic({ name: 'Gone', colorKey: 'home' });
    const a = createTask(study.id, { name: 'A' });
    const b = createTask(study.id, { name: 'B' });
    removeTopic(gone.id);
    for (const toTopicId of [gone.id, 'missing', study.id, '']) {
      expect(() => removeTopic(study.id, { moves: [{ taskId: a.id, toTopicId: home.id }, { taskId: b.id, toTopicId }] })).toThrow(ValidationError);
    }
    expect(getTopic(db, study.id)?.deletedAt).toBeNull();
    expect(getTask(db, a.id)).toMatchObject({ topicId: study.id, deletedAt: null });
    expect(getTask(db, b.id)).toMatchObject({ topicId: study.id, deletedAt: null });
    expect(names(home.id)).toEqual([]);
  });

  it('(e) refuses a duplicate taskId, a foreign task, and No topic as the topic', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const home = createTopic({ name: 'Home', colorKey: 'home' });
    const a = createTask(study.id, { name: 'A' });
    const other = createTask(home.id, { name: 'Other' });
    expect(() => removeTopic(study.id, { moves: [{ taskId: a.id, toTopicId: home.id }, { taskId: a.id, toTopicId: NO_TOPIC_ID }] })).toThrow(ValidationError);
    expect(() => removeTopic(study.id, { moves: [{ taskId: other.id, toTopicId: NO_TOPIC_ID }] })).toThrow(ValidationError);
    expect(() => removeTopic(NO_TOPIC_ID, { moves: [] })).toThrow(ValidationError);
    expect(getTopic(db, study.id)?.deletedAt).toBeNull();
    expect(getTask(db, a.id)).toMatchObject({ topicId: study.id, deletedAt: null });
    expect(getTask(db, other.id)?.topicId).toBe(home.id);
    expect(listTopics(db).map(t => t.name)).toEqual(['Study', 'Home', 'No topic']);
  });

  it('(b) tasks sent to one target keep their old relative order whatever order the moves are given in', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const home = createTopic({ name: 'Home', colorKey: 'home' });
    const a = createTask(study.id, { name: 'A' });
    const b = createTask(study.id, { name: 'B' });
    const c = createTask(study.id, { name: 'C' });
    createTask(home.id, { name: 'Existing' });
    removeTopic(study.id, { moves: [{ taskId: c.id, toTopicId: home.id }, { taskId: a.id, toTopicId: home.id }, { taskId: b.id, toTopicId: NO_TOPIC_ID }] });
    expect(names(home.id)).toEqual(['Existing', 'A', 'C']);
    expect(names(NO_TOPIC_ID)).toEqual(['B']);
  });

  it('tasks not listed are deleted with the topic', () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const a = createTask(study.id, { name: 'A' });
    const b = createTask(study.id, { name: 'B' });
    removeTopic(study.id, { moves: [{ taskId: a.id, toTopicId: NO_TOPIC_ID }] });
    expect(names(NO_TOPIC_ID)).toEqual(['A']);
    expect(getTask(db, b.id)?.deletedAt).not.toBeNull();
  });

  it("(g) tomorrow's confirmed plan rows of those tasks stay as they were", () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const a = createTask(study.id, { name: 'A' });
    const b = createTask(study.id, { name: 'B' });
    const tomorrow = addDays(todayKey(getDb(), now()), 1);
    const row = (t: typeof a, key: string) => ({
      key, taskId: t.id, topicId: study.id, name: t.name, colorKey: 'study' as const, kind: 'timed' as const, minutes: 30,
      cue: null, treat: null, note: null, ticked: true, reason: 'default' as const, forwardedFromDayKey: null, dayTaskId: null,
    });
    const draft: PlanDraft = { dayKey: tomorrow, groups: [{ topicId: study.id, rows: [row(a, 'a'), row(b, 'b')] }], notOn: [] };
    confirmDayPlan(tomorrow, draft);
    const before = loadDayBundle(db, tomorrow)!.dayTasks;
    expect(before).toHaveLength(2);
    removeTopic(study.id, { moves: [{ taskId: a.id, toTopicId: NO_TOPIC_ID }] });
    expect(loadDayBundle(db, tomorrow)!.dayTasks).toEqual(before);
  });
});
