import { ValidationError } from '../../data/errors';
import { getDay, loadDayBundle, saveConfirmedPlan } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import * as tasksRepo from '../../data/repos/tasks';
import { dayKeyOf } from '../../domain/dayKey';
import { confirmPlan, plannableDays } from '../../domain/plan';
import type { PlanDraft } from '../../domain/plan';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';

/** Confirms the draft in one transaction. Throws ValidationError if the day isn't plannable right now. */
export function confirmDayPlan(dayKey: DayKey, draft: PlanDraft): void {
  const db = getDb();
  const at = now();
  const dayStartHour = getDayStartHour(db);
  const todayKey = dayKeyOf(at, dayStartHour);
  if (!plannableDays(todayKey, getDay(db, todayKey)).includes(dayKey)) {
    throw new ValidationError('dayKey', `${dayKey} cannot be planned now`);
  }
  const bundle = loadDayBundle(db, dayKey);
  const existing = bundle?.dayTasks ?? [];
  const sessions = Object.values(bundle?.sessionsByDayTask ?? {}).flat();
  saveConfirmedPlan(db, {
    dayKey,
    dayStartHour,
    result: confirmPlan({ ...draft, dayKey }, existing, sessions),
    now: at,
    newId,
  });
  bump('days');
}

/** Notes edit the library task (doc 04 section 2). */
export function setTaskNoteFromPlan(taskId: string, note: string): void {
  tasksRepo.setTaskNote(getDb(), taskId, note, now());
  bump('tasks');
}
