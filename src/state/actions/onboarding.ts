import { ValidationError } from '../../data/errors';
import { setDayStartHour, setSetting } from '../../data/repos/settings';
import * as tasksRepo from '../../data/repos/tasks';
import * as topicsRepo from '../../data/repos/topics';
import { MINUTES, type ColorKey, type DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';
import { todayKey } from '../today';

export const ONBOARDED_SETTING = 'onboardedAt';

const EVERY_DAY = 127; // repeatMask bits 0..6 (Monday..Sunday) all set

export interface OnboardingInput {
  dayStartHour: number; // 0..23
  topic: { name: string; colorKey: ColorKey }; // name trimmed, 1..24 chars (repo rules)
  task: { name: string; minutes: number | null }; // null = checklist task; else timed minutes (repo rules)
}

/**
 * Sets the day start, creates the topic and one task (repeats every day, isDefault so it is pre-ticked),
 * records `onboardedAt = now()`. One transaction with one clock reading: a validation error from any step
 * rolls everything back, so a bad input writes nothing. Checklist tasks store the minimum minutes (the
 * column is not null and unused for kind 'check').
 */
export function finishOnboarding(input: OnboardingInput): { todayKey: DayKey } {
  const { dayStartHour, topic, task } = input;
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new ValidationError('dayStartHour', 'Choose an hour from 0 to 23');
  }
  const db = getDb();
  const at = now();
  const key = db.transaction((tx) => {
    const t = tx as typeof db;
    setDayStartHour(t, dayStartHour, at);
    const created = topicsRepo.createTopic(t, topic, at, newId);
    tasksRepo.createTask(
      t,
      {
        topicId: created.id,
        name: task.name,
        kind: task.minutes === null ? 'check' : 'timed',
        minutes: task.minutes ?? MINUTES.min,
        repeatMask: EVERY_DAY,
        isDefault: true,
        cue: null,
        treat: null,
      },
      at,
      newId,
    );
    setSetting(t, ONBOARDED_SETTING, at, at);
    return todayKey(t, at);
  });
  bump('settings', 'topics', 'tasks');
  return { todayKey: key };
}

/** "I'll set things up myself": records `onboardedAt` only. */
export function skipOnboarding(): void {
  const at = now();
  setSetting(getDb(), ONBOARDED_SETTING, at, at);
  bump('settings');
}
