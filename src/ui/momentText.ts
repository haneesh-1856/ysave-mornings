import type { Moment } from '@/domain/moments';

// Pure text for the close moments player: H:MM readouts, headlines, telemetry and the screen reader sentences.

const MS_PER_MIN = 60_000;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Milliseconds as H:MM, rounded to the nearest minute: 0 -> "0:00", 3_900_000 -> "1:05". */
export function formatHM(ms: number): string {
  const total = Math.max(0, Math.round(ms / MS_PER_MIN));
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

/** Local clock time of an instant as HH:MM (24 hour), as the prototype's "21:42". */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Spoken duration: "1 hour 5 minutes", "2 hours", "45 minutes", "less than a minute". */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / MS_PER_MIN));
  if (total === 0) return 'less than a minute';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h > 0 ? plural(h, 'hour') : '', m > 0 ? plural(m, 'minute') : ''].filter(Boolean).join(' ');
}

/** The big uppercase headline, ending in a full stop (the player paints the stop yellow). */
export function momentHeadline(m: Moment): string {
  switch (m.kind) {
    case 'longest': return 'LONGEST TASK.';
    case 'day': return 'DAY COMPLETE.';
    case 'best': return 'PERSONAL BEST.';
    case 'streak': return `${m.days}-DAY STREAK.`;
    case 'week': return 'WEEK COMPLETE.';
    case 'month': return 'MONTHLY GOAL.';
  }
}

/** The telemetry row: yellow label and the stamp on the right. */
export function momentTelemetry(m: Moment): { label: string; stamp: string } {
  switch (m.kind) {
    case 'longest': return { label: 'LONGEST TASK', stamp: 'TODAY' };
    case 'day': return { label: 'DAY COMPLETE', stamp: formatClock(m.closedAt) };
    case 'best': return { label: 'PERSONAL BEST', stamp: 'TODAY' };
    case 'streak': return { label: 'STREAK', stamp: `DAY ${m.days}` };
    case 'week': return { label: 'WEEK COMPLETE', stamp: 'SUN' };
    case 'month': return { label: 'MONTHLY GOAL', stamp: m.goalHours === null ? 'REVIEW' : `GOAL ${m.goalHours} H` };
  }
}

/** The typed monospace detail line (uppercase). */
export function momentDetail(m: Moment): string {
  switch (m.kind) {
    case 'longest': return `${m.name.toUpperCase()}  ·  ${formatHM(m.focusedMs)} FOCUSED  ·  LONGEST TODAY`;
    case 'day': return `CLOSED ${formatClock(m.closedAt)}  ·  ${m.done} OF ${m.total} DONE`;
    case 'best': return `${formatHM(m.todayMs)} FOCUSED  ·  BEST WAS ${formatHM(m.previousBestMs)}`;
    case 'streak': return `${m.days} DAYS IN A ROW  ·  NO DAY MISSED`;
    case 'week': return `${m.tasksDone} TASKS  ·  ${formatHM(m.focusedMs)} FOCUSED  ·  ${m.daysShowedUp} / 7 DAYS`;
    case 'month':
      return m.goalHours === null
        ? `${formatHM(m.monthFocusMs)} FOCUSED  ·  NO GOAL SET  ·  REVIEW`
        : `${formatHM(m.monthFocusMs)} FOCUSED  ·  GOAL ${m.goalHours} H  ·  MET`;
  }
}

/** A plain sentence for screen readers, spoken as each moment plays. */
export function momentAnnouncement(m: Moment): string {
  switch (m.kind) {
    case 'longest': return `Longest task: ${m.name}, ${spokenDuration(m.focusedMs)}.`;
    case 'day': return `Day complete: ${m.done} of ${plural(m.total, 'task')}, ${spokenDuration(m.focusedMs)} focused.`;
    case 'best': return `Personal best: ${spokenDuration(m.todayMs)} focused today, up from ${spokenDuration(m.previousBestMs)}.`;
    case 'streak': return `${m.days}-day streak: ${m.days} days in a row.`;
    case 'week': return `Week complete: ${plural(m.tasksDone, 'task')} done, ${spokenDuration(m.focusedMs)} focused.`;
    case 'month':
      return m.goalHours === null
        ? `Month in review: ${spokenDuration(m.monthFocusMs)} focused.`
        : `Monthly goal reached: ${spokenDuration(m.monthFocusMs)} focused, goal ${m.goalHours} hours.`;
  }
}

/** What the ending says. `day` present means every task was done: the ring closes. Otherwise the quiet ending. */
export function endingText(moments: readonly Moment[]): { quiet: boolean; title: string; sub: string; announcement: string } {
  const finished = moments.some((m) => m.kind === 'day');
  if (!finished) {
    return { quiet: true, title: 'DAY CLOSED', sub: 'THE DAY CLOSES QUIETLY', announcement: 'Day closed. The day closes quietly.' };
  }
  const n = moments.length;
  return {
    quiet: false,
    title: 'YSAVE MORNINGS',
    sub: `${n} ${n === 1 ? 'MOMENT' : 'MOMENTS'} · DAY FINISHED`,
    announcement: `Day finished. ${plural(n, 'moment')} played.`,
  };
}
