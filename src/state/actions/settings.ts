import { ValidationError } from '../../data/errors';
import { setFutureDayStartHour } from '../../data/repos/days';
import { setDayStartHour, setMomentsEnabled as saveMomentsEnabled, setMonthlyGoalHours } from '../../data/repos/settings';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { bump } from '../store';
import { todayKey } from '../today';
import { reconcile } from './reconcile';

/**
 * Changes "my day starts" (doc 04 section 1). Today keeps its snapshot, so it still ends at the old hour;
 * days after today that already have a row (e.g. tomorrow planned) take the new hour, later rows snapshot it.
 * Reconciles first (at the same instant as the writes) so "today" is resolved against up-to-date rows.
 */
export function setDayStart(hour: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ValidationError('dayStartHour', 'Choose an hour from 0 to 23');
  }
  const at = now(); // one instant for reconcile and both writes
  reconcile(at);
  const db = getDb();
  setDayStartHour(db, hour, at);
  setFutureDayStartHour(db, todayKey(db, at), hour, at);
  bump('settings', 'days');
}

/**
 * Sets the monthly focus goal in whole hours (1-744), or clears it with null. Only the setting changes: moment
 * markers are untouched, so a month already celebrated is neither replayed nor reset.
 */
export function setMonthlyGoal(hours: number | null): void {
  if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 744)) {
    throw new ValidationError('monthlyGoalHours', 'Choose a whole number of hours from 1 to 744');
  }
  setMonthlyGoalHours(getDb(), hours, now());
  bump('settings');
}

/**
 * Turns the moments at close on or off. Only the setting changes: moment markers are untouched, so what was already
 * celebrated stays celebrated, and a goal reached while off can still play at the next close once moments are back on.
 */
export function setMomentsEnabled(on: boolean): void {
  saveMomentsEnabled(getDb(), on, now());
  bump('settings');
}
