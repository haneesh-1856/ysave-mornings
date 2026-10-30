import { ValidationError } from '../../data/errors';
import { discardDraft, getDay, loadDayBundle, saveConfirmedPlan, saveDraftPlan } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
import * as tasksRepo from '../../data/repos/tasks';
import { canConfirm, confirmPlan, isDraftable, plannableDays } from '../../domain/plan';
import type { PlanDraft } from '../../domain/plan';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';
import { todayKey as resolveTodayKey } from '../today';

/** Confirms the draft in one transaction. Throws ValidationError if the day isn't plannable right now. */
export function confirmDayPlan(dayKey: DayKey, draft: PlanDraft): void {
  const db = getDb();
  const at = now();
  const todayKey = resolveTodayKey(db, at);
  if (!plannableDays(todayKey, getDay(db, todayKey)).includes(dayKey)) {
    throw new ValidationError('dayKey', `${dayKey} cannot be planned now`);
  }
  const bundle = loadDayBundle(db, dayKey);
  const existing = bundle?.dayTasks ?? [];
  const sessions = Object.values(bundle?.sessionsByDayTask ?? {}).flat();
  saveConfirmedPlan(db, {
    dayKey,
    dayStartHour: getDayStartHour(db),
    result: confirmPlan({ ...draft, dayKey }, existing, sessions),
    now: at,
    newId,
  });
  bump('days');
}

/**
 * Saves the draft plan for a later day (ADR-010): rows are written, the day is NOT planned (no planConfirmedAt).
 * Throws ValidationError if the day isn't draftable (after tomorrow, within a year) or nothing is ticked.
 */
export function saveDayDraft(dayKey: DayKey, draft: PlanDraft): void {
  const db = getDb();
  const at = now();
  if (!isDraftable(resolveTodayKey(db, at), dayKey)) {
    throw new ValidationError('dayKey', `${dayKey} cannot be drafted`);
  }
  if (!canConfirm(draft)) throw new ValidationError('draft', 'tick at least one task to save a draft');
  const bundle = loadDayBundle(db, dayKey);
  const existing = bundle?.dayTasks ?? [];
  const sessions = Object.values(bundle?.sessionsByDayTask ?? {}).flat();
  saveDraftPlan(db, {
    dayKey,
    dayStartHour: getDayStartHour(db),
    result: confirmPlan({ ...draft, dayKey }, existing, sessions),
    now: at,
    newId,
  });
  bump('days');
}

/** Throws away the draft of a later day (ADR-010). Throws ValidationError if the day isn't draftable. */
export function discardDayDraft(dayKey: DayKey): void {
  const db = getDb();
  const at = now();
  if (!isDraftable(resolveTodayKey(db, at), dayKey)) {
    throw new ValidationError('dayKey', `${dayKey} cannot be drafted`);
  }
  discardDraft(db, dayKey, at);
  bump('days');
}

/** Notes edit the library task (doc 04 section 2). */
export function setTaskNoteFromPlan(taskId: string, note: string): void {
  tasksRepo.setTaskNote(getDb(), taskId, note, now());
  bump('tasks');
}
