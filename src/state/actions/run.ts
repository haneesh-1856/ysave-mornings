import { ValidationError } from '../../data/errors';
import { loadDayBundle, setCheckCompleted } from '../../data/repos/days';
import { endSession, getOpenSession, startSession } from '../../data/repos/sessions';
import { getDayStartHour } from '../../data/repos/settings';
import { dayKeyOf } from '../../domain/dayKey';
import { startDecision, toggleCheck } from '../../domain/timer';
import type { StartDecision } from '../../domain/timer';
import type { Day, DayTask, Session } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';
import { reconcile } from './reconcile';

const START_MESSAGES: Record<Extract<StartDecision, { ok: false }>['reason'], string> = {
  done: 'This task is done for today',
  day_closed: 'This day is closed',
  not_timed: 'Only timed tasks can be started',
  already_running: 'This task is already running',
};

/** Reconciles first (M1 carried requirement), then loads today's bundle and the target row fresh. */
function loadTarget(dayTaskId: string): { dayTask: DayTask; day: Day; sessions: Session[] } {
  reconcile();
  const db = getDb();
  const bundle = loadDayBundle(db, dayKeyOf(now(), getDayStartHour(db)));
  const dayTask = bundle?.dayTasks.find((t) => t.id === dayTaskId);
  if (!bundle || !dayTask) throw new ValidationError('dayTaskId', "This task is not on today's list");
  return { dayTask, day: bundle.day, sessions: bundle.sessionsByDayTask[dayTaskId] ?? [] };
}

/** Starts or resumes a timed task; another running task is paused at the same instant. */
export function startTask(dayTaskId: string): void {
  const { dayTask, day } = loadTarget(dayTaskId);
  const db = getDb();
  const decision = startDecision(dayTask, day, getOpenSession(db));
  if (!decision.ok) throw new ValidationError('dayTaskId', START_MESSAGES[decision.reason]);
  startSession(db, { dayTaskId, closeSessionId: decision.closeSessionId, now: now(), newId });
  bump('sessions');
}

/** Pauses: closes this task's open session. No-op if it has none. */
export function pauseTask(dayTaskId: string): void {
  const { sessions } = loadTarget(dayTaskId);
  const open = sessions.find((s) => s.endedAt === null);
  if (!open) return;
  endSession(getDb(), open.id, now());
  bump('sessions');
}

/** Stops the overtime session. Only valid once the task is done (completedAt set). */
export function stopTask(dayTaskId: string): void {
  const { dayTask, sessions } = loadTarget(dayTaskId);
  if (dayTask.completedAt === null) throw new ValidationError('dayTaskId', 'Only a finished task can be stopped');
  const open = sessions.find((s) => s.endedAt === null);
  if (!open) return;
  endSession(getDb(), open.id, now());
  bump('sessions');
}

/** Ticks or unticks a checklist task while its day is open. */
export function toggleCheckTask(dayTaskId: string): void {
  const { dayTask, day } = loadTarget(dayTaskId);
  const at = now();
  const r = toggleCheck(dayTask, day, at);
  if (!r.ok) {
    throw new ValidationError('dayTaskId', r.reason === 'day_closed' ? 'This day is closed' : 'Not a checklist task');
  }
  setCheckCompleted(getDb(), dayTaskId, r.completedAt, at);
  bump('days');
}
