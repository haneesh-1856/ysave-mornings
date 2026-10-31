import { act, renderHook } from '@testing-library/react-native';
import { getDayStartHour, getSetting } from '../../data/repos/settings';
import { listTasks } from '../../data/repos/tasks';
import { listUserTopics } from '../../data/repos/topics';
import type { DB } from '../../data/types';
import { dayStartOf } from '../../domain/dayKey';
import { createTopic } from '../actions/library';
import { finishOnboarding, ONBOARDED_SETTING, skipOnboarding } from '../actions/onboarding';
import type { OnboardingInput } from '../actions/onboarding';
import { reconcile } from '../actions/reconcile';
import { ValidationError } from '../errors';
import { needsOnboarding, useNeedsOnboarding } from '../hooks/useOnboarding';
import { setupState, teardownState } from '../testSupport';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const NOW = dayStartOf('2026-10-30', 4) + 5 * 3_600_000; // 09:00
let db: DB;
beforeEach(() => {
  db = setupState(NOW);
});
afterEach(() => teardownState());

const valid = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  dayStartHour: 6,
  topic: { name: 'Study', colorKey: 'study' },
  task: { name: 'Read', minutes: 25 },
  ...over,
});

function expectUnchanged() {
  expect(listUserTopics(db)).toHaveLength(0);
  expect(listTasks(db)).toHaveLength(0);
  expect(getSetting(db, ONBOARDED_SETTING)).toBeUndefined();
  expect(getDayStartHour(db)).toBe(4);
  expect(needsOnboarding()).toBe(true);
}

describe('needsOnboarding', () => {
  it('is true on an empty db', () => expect(needsOnboarding()).toBe(true));

  it('is false after skipOnboarding, which only records onboardedAt', () => {
    skipOnboarding();
    expect(needsOnboarding()).toBe(false);
    expect(getSetting(db, ONBOARDED_SETTING)).toBe(NOW);
    expect(listUserTopics(db)).toHaveLength(0);
  });

  it('is false for an existing install with a topic but no onboardedAt', () => {
    createTopic({ name: 'Old', colorKey: 'home' });
    expect(needsOnboarding()).toBe(false);
  });

  it('is false when only a days row exists', () => {
    reconcile(); // creates today's row with no topics
    expect(listUserTopics(db)).toHaveLength(0);
    expect(getSetting(db, ONBOARDED_SETTING)).toBeUndefined();
    expect(needsOnboarding()).toBe(false);
  });
});

describe('finishOnboarding', () => {
  it('creates one timed topic + task, sets hour and onboardedAt, returns today', () => {
    const { todayKey } = finishOnboarding(valid());
    expect(todayKey).toBe('2026-10-30');
    const topics = listUserTopics(db);
    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({ name: 'Study', colorKey: 'study' });
    const tasks = listTasks(db);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      topicId: topics[0].id,
      name: 'Read',
      kind: 'timed',
      minutes: 25,
      repeatMask: 127,
      isDefault: true,
      cue: null,
      treat: null,
    });
    expect(getDayStartHour(db)).toBe(6);
    expect(getSetting(db, ONBOARDED_SETTING)).toBe(NOW);
    expect(needsOnboarding()).toBe(false);
  });

  it('creates a checklist task when minutes is null', () => {
    finishOnboarding(valid({ task: { name: 'Stretch', minutes: null } }));
    expect(listTasks(db)[0]).toMatchObject({ kind: 'check', repeatMask: 127, isDefault: true });
  });

  it.each<[string, Partial<OnboardingInput>]>([
    ['hour 24', { dayStartHour: 24 }],
    ['hour -1', { dayStartHour: -1 }],
    ['hour 4.5', { dayStartHour: 4.5 }],
    ['empty topic name', { topic: { name: '  ', colorKey: 'study' } }],
    ['too-long topic name', { topic: { name: 'x'.repeat(25), colorKey: 'study' } }],
    ['empty task name', { task: { name: '', minutes: 25 } }],
    ['too-long task name', { task: { name: 'x'.repeat(41), minutes: 25 } }],
    ['minutes 0', { task: { name: 'Read', minutes: 0 } }],
    ['minutes 181', { task: { name: 'Read', minutes: 181 } }],
    ['minutes off-step', { task: { name: 'Read', minutes: 7 } }],
  ])('rejects %s and writes nothing', (_label, over) => {
    expect(() => finishOnboarding(valid(over))).toThrow(ValidationError);
    expectUnchanged();
  });
});

describe('useNeedsOnboarding', () => {
  it('flips to false after finishOnboarding', async () => {
    const { result } = await renderHook(() => useNeedsOnboarding());
    expect(result.current).toBe(true);
    await act(async () => {
      finishOnboarding(valid());
    });
    expect(result.current).toBe(false);
  });
});
