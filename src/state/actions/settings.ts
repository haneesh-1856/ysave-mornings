import { ValidationError } from '../../data/errors';
import { setFutureDayStartHour } from '../../data/repos/days';
import { setDayStartHour } from '../../data/repos/settings';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { bump } from '../store';
import { todayKey } from '../today';
import { reconcile } from './reconcile';

/**
 * Changes "my day starts" (doc 04 section 1). Today keeps its snapshot, so it still ends at the old hour;
 * days after today that already have a row (e.g. tomorrow planned) take the new hour, later rows snapshot it.
 * Reconciles first so "today" is resolved against up-to-date rows.
 */
export function setDayStart(hour: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ValidationError('dayStartHour', 'Choose an hour from 0 to 23');
  }
  reconcile();
  const db = getDb();
  const at = now();
  setDayStartHour(db, hour, at);
  setFutureDayStartHour(db, todayKey(db, at), hour, at);
  bump('settings', 'days');
}
