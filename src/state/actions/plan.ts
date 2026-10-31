import { ValidationError } from '../../data/errors';
import { discardDraft, getDay, getDayTask, loadDayBundle, saveConfirmedPlan, saveDraftPlan, setDayTaskNote as storeDayTaskNote } from '../../data/repos/days';
import { getDayStartHour } from '../../data/repos/settings';
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

/**
 * Edits a stored day row's note (ADR-011): the per-day note, not the library one. Blank clears it.
 * Throws ValidationError if the row is unknown, its day is closed, or the note is over the limit.
 */
export function setDayTaskNote(dayTaskId: string, note: string | null): void {
  const db = getDb();
  const row = getDayTask(db, dayTaskId);
  if (!row) throw new ValidationError('dayTaskId', 'This task is not on a day list');
  if (getDay(db, row.dayKey)?.closedAt != null) throw new ValidationError('dayTaskId', 'This day is closed');
  storeDayTaskNote(db, dayTaskId, note, now());
  bump('days');
}
