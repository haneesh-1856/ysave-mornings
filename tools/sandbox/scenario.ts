import { addDays, weekdayIndex } from '@/domain/dayKey';

import type { DayScript, Scenario } from './history';

// EXAMPLE data (not the user's phone data): three weeks of history ending Sun 1 Nov with nothing done, and Mon 2 Nov
// live, planned, waiting for you to focus and close it. Mon 19 Oct is the best day so far (2:55); 2 Nov's plan adds up to
// 2:45, so it becomes a personal best only if you focus past its times (e.g. "+2m gold" on each task).
const FIRST = '2026-10-13';
const LIVE = '2026-11-02';

const minutes: Record<string, [number, number, number]> = {
  // [Deep work, Reading, Workout]
  '2026-10-13': [90, 30, 0], '2026-10-14': [95, 30, 45], '2026-10-15': [60, 20, 0], '2026-10-16': [90, 30, 45],
  '2026-10-17': [0, 40, 0], '2026-10-18': [0, 30, 0], '2026-10-19': [100, 30, 45], '2026-10-20': [80, 30, 0],
  '2026-10-21': [90, 35, 45], '2026-10-22': [120, 35, 45], '2026-10-23': [70, 30, 30], '2026-10-24': [0, 30, 0],
  '2026-10-25': [0, 25, 0], '2026-10-26': [90, 30, 45], '2026-10-27': [60, 30, 0], '2026-10-28': [90, 30, 45],
  '2026-10-29': [45, 15, 0], '2026-10-30': [90, 30, 45], '2026-10-31': [0, 30, 0],
};

function day(k: string): DayScript {
  const wd = weekdayIndex(k);
  const work: DayScript['work'] = {};
  if (k === '2026-11-01') {
    // Sunday 1 Nov: planned, nothing done, never closed by hand (auto-closes on the next morning).
    work.Reading = 0;
    work.Groceries = 'open';
    return { day: k, work, end: 'auto', leftover: 'let_go' };
  }
  const m = minutes[k] ?? [0, 0, 0];
  if (wd < 5) work['Deep work'] = m[0];
  work.Reading = m[1];
  if (wd === 0 || wd === 2 || wd === 4) work.Workout = m[2];
  if (wd === 5) work.Laundry = 'done';
  if (wd === 6) work.Groceries = 'done';
  return { day: k, work, end: k === '2026-10-29' ? 'auto' : 'hand', leftover: 'let_go' };
}

const days: DayScript[] = [];
for (let k = FIRST; k < LIVE; k = addDays(k, 1)) days.push(day(k));
days.push({ day: LIVE, work: { 'Deep work': 0, Reading: 0, Workout: 0 }, end: 'hand', leftover: 'let_go' });

export const DEFAULT_SCENARIO: Scenario = {
  topics: [
    { name: 'Study', colorKey: 'study' },
    { name: 'Health', colorKey: 'health' },
    { name: 'Home', colorKey: 'home' },
  ],
  tasks: [
    { name: 'Deep work', topic: 'Study', kind: 'timed', minutes: 90, days: [0, 1, 2, 3, 4], isDefault: true },
    { name: 'Reading', topic: 'Study', kind: 'timed', minutes: 30, days: [0, 1, 2, 3, 4, 5, 6], isDefault: true },
    { name: 'Workout', topic: 'Health', kind: 'timed', minutes: 45, days: [0, 2, 4], isDefault: true },
    { name: 'Laundry', topic: 'Home', kind: 'check', minutes: 30, days: [5], isDefault: true },
    { name: 'Groceries', topic: 'Home', kind: 'check', minutes: 30, days: [6], isDefault: false },
  ],
  dayStartHour: 4,
  monthlyGoalHours: null,
  momentsOn: true,
  liveDay: LIVE,
  days,
};
