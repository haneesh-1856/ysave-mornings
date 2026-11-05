import type { Moment } from '@/domain/moments';

import {
  endingText, formatClock, formatHM, momentAnnouncement, momentDetail, momentHeadline, momentTelemetry, spokenDuration,
} from '../momentText';

const MIN = 60_000;
const DAILY = Array.from({ length: 29 }, (_, i) => (i % 3 === 2 ? 0 : 183 * MIN)); // 20 non-zero days, 3660 min = 61 h
const RECENT = [96, 110, 104, 128, 0, 95, 119, 134, 101, 122, 88, 131, 113].map((m) => m * MIN); // 13 days, oldest first, none above the previous best (140 min)
const longest: Moment = { kind: 'longest', name: 'Study', colorKey: 'study', focusedMs: 65 * MIN, budgetSec: 3600 };
const day: Moment = { kind: 'day', done: 5, total: 5, focusedMs: 130 * MIN, closedAt: new Date(2026, 9, 29, 21, 42).getTime() };
const best: Moment = { kind: 'best', todayMs: 150 * MIN, previousBestMs: 140 * MIN, recentMs: RECENT };
const streak: Moment = { kind: 'streak', days: 14, endDayKey: '2026-10-29' };
const week: Moment = { kind: 'week', weekStart: '2026-10-26', tasksDone: 31, focusedMs: 600 * MIN, goldRings: 9, daysShowedUp: 7, dailyMs: [0, 0, 0, 0, 0, 0, 0] };
const monthGoal: Moment = { kind: 'month', monthKey: '2026-10', monthFocusMs: DAILY.reduce((a, v) => a + v, 0), goalHours: 60, daysShowedUp: 20, dailyMs: DAILY };
const monthReview: Moment = { ...monthGoal, goalHours: null };

describe('formatHM', () => {
  it('shows hours and zero padded minutes, rounded to the nearest minute', () => {
    expect(formatHM(0)).toBe('0:00');
    expect(formatHM(65 * MIN)).toBe('1:05');
    expect(formatHM(130 * MIN)).toBe('2:10');
    expect(formatHM(59 * MIN + 31_000)).toBe('1:00');
    expect(formatHM(-5)).toBe('0:00');
  });
});

describe('formatClock', () => {
  it('is the local 24 hour clock', () => {
    expect(formatClock(new Date(2026, 9, 29, 21, 42).getTime())).toBe('21:42');
    expect(formatClock(new Date(2026, 9, 29, 6, 5).getTime())).toBe('06:05');
  });
});

describe('spokenDuration', () => {
  it('says hours and minutes with the right plurals', () => {
    expect(spokenDuration(65 * MIN)).toBe('1 hour 5 minutes');
    expect(spokenDuration(120 * MIN)).toBe('2 hours');
    expect(spokenDuration(45 * MIN)).toBe('45 minutes');
    expect(spokenDuration(MIN)).toBe('1 minute');
    expect(spokenDuration(10_000)).toBe('less than a minute');
  });
});

describe('announcements', () => {
  it('reads the two drawn moments as plain sentences', () => {
    expect(momentAnnouncement(longest)).toBe('Longest task: Study, 1 hour 5 minutes.');
    expect(momentAnnouncement(day)).toBe('Day complete: 5 of 5 tasks, 2 hours 10 minutes focused.');
    expect(momentAnnouncement({ ...day, done: 1, total: 1, focusedMs: 20 * MIN })).toBe('Day complete: 1 of 1 task, 20 minutes focused.');
  });

  it('reads the other four too', () => {
    expect(momentAnnouncement(best)).toBe('Personal best: 2 hours 30 minutes focused today, up from 2 hours 20 minutes.');
    expect(momentAnnouncement(streak)).toBe('14-day streak: 14 days in a row.');
    expect(momentAnnouncement(week)).toBe('Week complete: 31 tasks done, 10 hours focused.');
    expect(momentAnnouncement(monthGoal)).toBe('Monthly goal reached: 61 hours focused, goal 60 hours.');
    expect(momentAnnouncement(monthReview)).toBe('Month in review: 61 hours focused.');
  });
});

describe('headlines, telemetry and detail lines', () => {
  it('use the names the user chose, ending in a full stop', () => {
    expect([longest, day, best, week, monthGoal].map(momentHeadline)).toEqual([
      'LONGEST TASK.', 'DAY COMPLETE.', 'PERSONAL BEST.', 'WEEK COMPLETE.', 'MONTHLY GOAL.',
    ]);
    expect(momentHeadline({ ...streak, days: 7 })).toBe('7-DAY STREAK.');
    expect(momentHeadline(streak)).toBe('14-DAY STREAK.');
  });

  it('gives each a label and a stamp', () => {
    expect(momentTelemetry(longest)).toEqual({ label: 'LONGEST TASK', stamp: 'TODAY' });
    expect(momentTelemetry(day)).toEqual({ label: 'DAY COMPLETE', stamp: '21:42' });
    expect(momentTelemetry(streak)).toEqual({ label: 'STREAK', stamp: 'DAY 14' });
    expect(momentTelemetry(monthGoal).stamp).toBe('GOAL 60 H');
    expect(momentTelemetry(monthReview).stamp).toBe('REVIEW');
    expect(momentTelemetry(best).label).toBe('PERSONAL BEST');
    expect(momentTelemetry(week).label).toBe('WEEK COMPLETE');
  });

  it('types a detail line per kind', () => {
    expect(momentDetail(longest)).toBe('STUDY  ·  1:05 FOCUSED  ·  LONGEST TODAY');
    expect(momentDetail(day)).toBe('CLOSED 21:42  ·  5 OF 5 DONE');
    expect(momentDetail(best)).toBe('2:30 FOCUSED  ·  BEST WAS 2:20');
    expect(momentDetail(streak)).toBe('14 DAYS IN A ROW  ·  NO DAY MISSED');
    expect(momentDetail(week)).toContain('31 TASKS');
    expect(momentDetail(monthGoal)).toContain('GOAL 60 H');
    expect(momentDetail(monthReview)).toContain('NO GOAL SET');
  });
});

describe('endingText', () => {
  it('is the finished ending when Day complete is among the moments', () => {
    expect(endingText([longest, day])).toMatchObject({ quiet: false, title: 'YSAVE MORNINGS', sub: '2 MOMENTS · DAY FINISHED' });
    expect(endingText([day]).sub).toBe('1 MOMENT · DAY FINISHED');
  });

  it('is the quiet ending otherwise', () => {
    expect(endingText([longest])).toMatchObject({ quiet: true, title: 'DAY CLOSED', sub: 'THE DAY CLOSES QUIETLY' });
    expect(endingText([longest, best]).quiet).toBe(true);
  });
});
