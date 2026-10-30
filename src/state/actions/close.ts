import { ValidationError } from '../../data/errors';
import { getDay, loadDayBundle } from '../../data/repos/days';
import { applyOps } from '../../data/repos/ops';
import { getDayStartHour } from '../../data/repos/settings';
import { addDays } from '../../domain/dayKey';
import { closeByHand, missingOutcomes } from '../../domain/rollover';
import type { CloseOutcome } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';
import { todayKey as resolveTodayKey } from '../today';
import { reconcile } from './reconcile';

/** A ValidationError that also carries the day-task ids still lacking a choice (so the screen can highlight them). */
export class MissingOutcomesError extends ValidationError {
  constructor(public readonly missing: string[]) {
    super('outcomes', `Choose Move or Let go for ${missing.length} ${missing.length === 1 ? 'task' : 'tasks'}`);
    this.name = 'MissingOutcomesError';
  }
}

/**
 * Closes today by hand (doc 04 section 6). `outcomes` maps each unticked checklist day-task id to 'moved' | 'let_go'.
 * Reconciles first so a stale day is auto-closed and today exists. Throws ValidationError if today is already closed,
 * or MissingOutcomesError (a ValidationError with `.missing`) if any unticked check lacks a choice.
 */
export function closeToday(outcomes: Record<string, CloseOutcome>): void {
  reconcile();
  const db = getDb();
  const at = now();
  const dayStartHour = getDayStartHour(db);
  const todayKey = resolveTodayKey(db, at);
  const bundle = loadDayBundle(db, todayKey);
  if (!bundle) throw new ValidationError('day', 'Nothing to close yet');
  if (bundle.day.closedAt !== null) throw new ValidationError('day', 'Today is already closed');
  const missing = missingOutcomes(bundle, outcomes);
  if (missing.length > 0) throw new MissingOutcomesError(missing);

  const tomorrowKey = addDays(todayKey, 1);
  const tomorrow = loadDayBundle(db, tomorrowKey);
  const ops = closeByHand(
    bundle,
    outcomes,
    { day: tomorrow?.day ?? getDay(db, tomorrowKey), dayTasks: tomorrow?.dayTasks ?? [], dayStartHour },
    at,
  );
  applyOps(db, ops, newId, at);
  bump('days', 'sessions');
}
