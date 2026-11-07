import { readFileSync } from 'fs';
import { join } from 'path';

import { configure, screen, within } from '@testing-library/react-native';

import type { Insights } from '@/domain/insights';
import { useInsights } from '@/state/hooks/useInsights';
import { dateText } from '@/ui/insights/format';
import { renderThemed } from '@/ui/testing';

import { InsightsScreen } from '../InsightsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/state/hooks/useInsights', () => ({ useInsights: jest.fn() }));

// Axis and column text is hidden from the screen reader on purpose (the chart label says it); tests still read it.
configure({ defaultIncludeHiddenElements: true });

const H = 3_600_000;
const M = 60_000;
// Window 2026-10-07 .. 2026-11-05: weeks of Oct 5 (5 days), Oct 12, Oct 19, Oct 26 (7 each), Nov 2 (4 days).
const WEEKS = [
  { weekStart: '2026-10-05', daysInWindow: 5 },
  { weekStart: '2026-10-12', daysInWindow: 7 },
  { weekStart: '2026-10-19', daysInWindow: 7 },
  { weekStart: '2026-10-26', daysInWindow: 7 },
  { weekStart: '2026-11-02', daysInWindow: 4 },
];

const msByHour = new Array<number>(24).fill(0);
msByHour[9] = 5 * H + 30 * M; // 5:30
msByHour[10] = 3 * H;
msByHour[21] = 1 * H + 10 * M;

const FULL: Insights = {
  windowStart: '2026-10-07',
  windowEnd: '2026-11-05',
  totalFocusMs: 9 * H + 40 * M,
  hours: { msByHour },
  weekdays: {
    totalMs: [4 * H, 70 * M, 0, 2 * H, 0, 0, 30 * M],
    dayCount: [4, 4, 4, 5, 5, 4, 4],
    avgMs: [H, 17.5 * M, 0, 24 * M, 0, 0, 7.5 * M],
  },
  firstStart: {
    days: [
      { dayKey: '2026-10-08', minutes: 45 },
      { dayKey: '2026-10-09', minutes: 90 },
      { dayKey: '2026-10-12', minutes: 20 },
    ],
    medianMinutes: 45,
  },
  topics: [
    { topicId: 'a', name: 'Study', colorKey: 'study', ms: 6 * H },
    { topicId: 'b', name: 'Health', colorKey: 'health', ms: 2 * H + 40 * M },
    { topicId: 'c', name: 'Removed topic', colorKey: 'home', ms: H },
  ],
  planned: [
    { topicId: 'a', name: 'Study', colorKey: 'study', plannedMs: 8 * H, focusedMs: 6 * H },
    { topicId: 'b', name: 'Health', colorKey: 'health', plannedMs: 2 * H, focusedMs: 2 * H + 40 * M },
  ],
  sessions: { count: 12, medianMs: 40 * M, bins: [1, 2, 3, 4, 1, 1] },
  trend: WEEKS.map((w, i) => ({ ...w, ms: [H, 2 * H, 3 * H, 3 * H + 40 * M, 0][i] })),
  showedUp: { total: 18, byWeek: WEEKS.map((w, i) => ({ ...w, days: [3, 5, 6, 4, 0][i] })) },
  gold: { rings: 4, days: 3, byWeek: WEEKS.map((w, i) => ({ ...w, rings: [0, 1, 2, 1, 0][i], days: [0, 1, 1, 1, 0][i] })) },
  carry: { moved: 7, letGo: 2, byWeek: WEEKS.map((w, i) => ({ ...w, moved: [1, 2, 2, 2, 0][i], letGo: [0, 1, 1, 0, 0][i] })) },
  checks: { ticked: 11, notTicked: 5 },
  records: {
    bestDay: { dayKey: '2026-10-21', ms: 4 * H + 5 * M },
    longestSession: { dayKey: '2026-10-14', taskName: 'Thesis chapter', ms: 95 * M },
    longestRun: { days: 6, endDayKey: '2026-10-24' },
  },
};

const EMPTY: Insights = {
  windowStart: '2026-10-07',
  windowEnd: '2026-11-05',
  totalFocusMs: 0,
  hours: { msByHour: new Array<number>(24).fill(0) },
  weekdays: { totalMs: new Array<number>(7).fill(0), dayCount: [4, 4, 4, 5, 5, 4, 4], avgMs: new Array<number>(7).fill(0) },
  firstStart: { days: [], medianMinutes: null },
  topics: [],
  planned: [],
  sessions: { count: 0, medianMs: null, bins: new Array<number>(6).fill(0) },
  trend: WEEKS.map(w => ({ ...w, ms: 0 })),
  showedUp: { total: 0, byWeek: WEEKS.map(w => ({ ...w, days: 0 })) },
  gold: { rings: 0, days: 0, byWeek: WEEKS.map(w => ({ ...w, rings: 0, days: 0 })) },
  carry: { moved: 0, letGo: 0, byWeek: WEEKS.map(w => ({ ...w, moved: 0, letGo: 0 })) },
  checks: { ticked: 0, notTicked: 0 },
  records: { bestDay: null, longestSession: null, longestRun: null },
};

const mockHook = useInsights as jest.Mock;
const GROUPS = ['When you focus', 'What you spend it on', 'Over time', 'How days end'];
const TITLES = [
  'Hours you focus', 'Your week shape', 'First timer of the day',
  'Topic split', 'Planned and focused', 'Session lengths',
  'Weekly focus', 'Days you showed up', 'Gold rings',
  'Moved and let go', 'Checklist ticks', 'Your records',
];

const BANNED = /\b(good|great|only|just|should|try|better|worse|improve|keep it up|well done|amazing|nice)\b/i;

describe('InsightsScreen', () => {
  it('shows the header, the line under it, the 4 groups and the 12 cards in order', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    expect(screen.getByText('Insights')).toBeTruthy();
    expect(screen.getByText('Last 30 days')).toBeTruthy();
    expect(screen.getByText('Counted on this phone from your days, tasks and timers.')).toBeTruthy();
    const headings = screen.getAllByRole('header').map(h => h.props.children as string);
    const titles = headings.filter(h => TITLES.includes(h) || GROUPS.includes(h));
    expect(titles).toEqual([
      GROUPS[0], ...TITLES.slice(0, 3), GROUPS[1], ...TITLES.slice(3, 6), GROUPS[2], ...TITLES.slice(6, 9), GROUPS[3], ...TITLES.slice(9),
    ]);
    expect(screen.queryByText('Nothing in these 30 days yet.')).toBeNull();
  });

  it('shows the key numbers', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    expect(screen.getByText('9:00 to 10:00')).toBeTruthy();
    expect(screen.getByText('5:30')).toBeTruthy(); // that hour
    expect(screen.getByText('0:45')).toBeTruthy(); // first timer median
    expect(screen.getAllByText('9:40').length).toBeGreaterThanOrEqual(1); // weekly focus total (and the 30-day figure)
    expect(screen.getByText('Study  6:00')).toBeTruthy();
    expect(screen.getByText('Study  planned 8:00, focused 6:00')).toBeTruthy();
    expect(screen.getByLabelText('timer runs: 12')).toBeTruthy();
    expect(screen.getByLabelText('days you showed up, of 30: 18')).toBeTruthy();
    expect(screen.getByText('Ticked  11')).toBeTruthy();
    expect(screen.getByText('Not ticked  5')).toBeTruthy();
  });

  it('marks partial weeks', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    expect(screen.getAllByText('5 of 7 days')).toHaveLength(4); // the four week-by-week cards
    expect(screen.getAllByText('4 of 7 days')).toHaveLength(4);
  });

  it('records card has plain labels with dates and the task name', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    expect(screen.getByLabelText(`Most focus in a day, 4:05, ${dateText('2026-10-21')}`)).toBeTruthy();
    expect(screen.getByLabelText(`Longest timer run, 1:35, Thesis chapter · ${dateText('2026-10-14')}`)).toBeTruthy();
    expect(screen.getByLabelText(`Most days in a row, 6 days, ending ${dateText('2026-10-24')}`)).toBeTruthy();
    expect(screen.getByText('Most focus in a day')).toBeTruthy();
    expect(screen.getByText('Longest timer run')).toBeTruthy();
    expect(screen.getByText('Most days in a row')).toBeTruthy();
  });

  it('every chart states its numbers in words', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    const charts = screen.getAllByRole('image');
    expect(charts).toHaveLength(11); // every card but the records has one chart
    const labels = charts.map(c => c.props.accessibilityLabel as string);
    expect(labels.every(l => l.length > 20)).toBe(true);
    expect(labels[0]).toBe('Focus by hour of the day. 9 to 10, 5 hours 30 minutes; 10 to 11, 3 hours; 21 to 22, 1 hour 10 minutes.');
    expect(labels[1]).toContain('Monday 1 hour over 4 days');
    expect(labels[1]).toContain('Wednesday no focus over 4 days');
    expect(labels[2]).toBe(
      `First timer of each day, counted from when that day starts. 3 days. Median 45 minutes. Earliest 20 minutes on ${dateText('2026-10-12')}. Latest 1 hour 30 minutes on ${dateText('2026-10-09')}.`,
    );
    expect(labels[3]).toContain('Study 6 hours, Health 2 hours 40 minutes');
    expect(labels[4]).toContain('Study planned 8 hours, focused 6 hours');
    expect(labels[5]).toContain('15 to 29 min 3 runs');
    expect(labels[6]).toContain('(5 of 7 days) 1 hour');
    expect(labels[7]).toContain('(4 of 7 days) 0 days of 4');
    expect(labels[8]).toContain('1 ring on 1 day');
    expect(labels[9]).toContain('2 tasks moved, 1 task let go');
    expect(labels[10]).toBe('Checklist items on closed days. 11 items ticked, 5 items not ticked.');
  });


  it('shows exact values for the week shape, session bins, weekly focus, showed-up, gold and carry', async () => {
    mockHook.mockReturnValue(FULL);
    await renderThemed(<InsightsScreen />);
    // week shape: Mon 1:00, Tue 17.5 min -> 0:18, Thu 0:24, Sun 7.5 min -> 0:08; day counts 4,4,4,5,5,4,4
    expect(screen.getByText('0:18')).toBeTruthy();
    expect(screen.getByText('0:24')).toBeTruthy();
    expect(screen.getByText('0:08')).toBeTruthy();
    expect(screen.getAllByText('4 days')).toHaveLength(5);
    expect(screen.getAllByText('5 days')).toHaveLength(2);
    // session bins: [1,2,3,4,1,1], 12 runs, median run 0:40
    const bins: [string, string][] = [['<5 min', '1'], ['5-14 min', '2'], ['15-29 min', '3'], ['30-44 min', '4'], ['45-59 min', '1'], ['60+ min', '1']];
    for (const [name, n] of bins) expect(within(screen.getByText(name).parent!).getByText(n)).toBeTruthy();
    expect(screen.getByLabelText('median run, H:MM: 0:40')).toBeTruthy();
    // weekly focus columns 1:00, 2:00, 3:00, 3:40, 0:00 and the 30-day total
    expect(screen.getAllByText('3:40')).toHaveLength(1);
    expect(screen.getAllByText('2:00')).toHaveLength(1);
    expect(screen.getByLabelText('focused in 30 days: 9:40')).toBeTruthy();
    // showed up: 3 of 5, 5 of 7, 6 of 7, 4 of 7, 0 of 4
    for (const t of ['3 of 5', '5 of 7', '6 of 7', '4 of 7', '0 of 4']) expect(screen.getAllByText(t)).toHaveLength(1);
    // gold: 4 rings on 3 days; carry 7 moved, 2 let go, per week
    expect(screen.getByLabelText('gold rings: 4')).toBeTruthy();
    expect(screen.getByLabelText('days with a gold ring: 3')).toBeTruthy();
    expect(screen.getByLabelText('moved: 7')).toBeTruthy();
    expect(screen.getByLabelText('let go: 2')).toBeTruthy();
    expect(screen.getByText('1 / 0')).toBeTruthy();
    expect(screen.getAllByText('2 / 1')).toHaveLength(2);
    expect(screen.getByText('2 / 0')).toBeTruthy();
    expect(screen.getByText('0 / 0')).toBeTruthy();
    expect(screen.getByLabelText('days with a timer: 3')).toBeTruthy();
  });

  it('a "Removed topics" row (colorKey none) renders; a 29 second value shows <0:01 and is spoken as less than a minute', async () => {
    mockHook.mockReturnValue({
      ...FULL,
      topics: [...FULL.topics, { topicId: 'z', name: 'Removed topics', colorKey: 'none' as never, ms: 29_000 }],
      sessions: { ...FULL.sessions, medianMs: 29_000 },
      records: { ...FULL.records, longestSession: { dayKey: '2026-10-14', taskName: 'Quick', ms: 29_000 } },
    });
    await renderThemed(<InsightsScreen />);
    expect(screen.getByText('Removed topics  <0:01')).toBeTruthy();
    expect(screen.getByLabelText('median run, H:MM: <0:01')).toBeTruthy();
    expect(screen.getByLabelText(`Longest timer run, <0:01, Quick · ${dateText('2026-10-14')}`)).toBeTruthy();
    expect(screen.queryByText('Removed topics  0:00')).toBeNull();
    const labels = screen.getAllByRole('image').map(c => c.props.accessibilityLabel as string);
    expect(labels[3]).toContain('Removed topics less than a minute');
  });

  it('uses singular forms for a count of 1, and says 23 to 0 at midnight', async () => {
    const one = new Array<number>(24).fill(0);
    one[23] = 2 * H;
    mockHook.mockReturnValue({
      ...FULL,
      hours: { msByHour: one },
      weekdays: { ...FULL.weekdays, dayCount: [1, 1, 1, 1, 1, 1, 1] },
      firstStart: { days: [{ dayKey: '2026-10-08', minutes: 45 }], medianMinutes: 45 },
      sessions: { count: 1, medianMs: 40 * M, bins: [0, 0, 0, 1, 0, 0] },
      showedUp: { total: 1, byWeek: WEEKS.map((w, i) => ({ ...w, days: [1, 0, 0, 0, 0][i] })) },
      gold: { rings: 1, days: 1, byWeek: WEEKS.map((w, i) => ({ ...w, rings: [1, 0, 0, 0, 0][i], days: [1, 0, 0, 0, 0][i] })) },
      carry: { moved: 1, letGo: 1, byWeek: WEEKS.map((w, i) => ({ ...w, moved: [1, 0, 0, 0, 0][i], letGo: [1, 0, 0, 0, 0][i] })) },
      checks: { ticked: 1, notTicked: 1 },
    });
    await renderThemed(<InsightsScreen />);
    expect(screen.getAllByText('1 day')).toHaveLength(7);
    expect(screen.queryByText('1 days')).toBeNull();
    expect(screen.getByLabelText('timer run: 1')).toBeTruthy();
    expect(screen.getByLabelText('gold ring: 1')).toBeTruthy();
    expect(screen.getByLabelText('day with a gold ring: 1')).toBeTruthy();
    expect(screen.getByLabelText('day with a timer: 1')).toBeTruthy();
    expect(screen.getByLabelText('day you showed up, of 30: 1')).toBeTruthy();
    const labels = screen.getAllByRole('image').map(c => c.props.accessibilityLabel as string);
    expect(labels[0]).toBe('Focus by hour of the day. 23 to 0, 2 hours.');
    expect(labels[2]).toContain('1 day. Median 45 minutes. Earliest 45 minutes on');
    expect(labels[5]).toContain('30 to 44 min 1 run,');
    expect(labels[8]).toContain('1 ring on 1 day');
    expect(labels[9]).toContain('1 task moved, 1 task let go');
    expect(labels[10]).toBe('Checklist items on closed days. 1 item ticked, 1 item not ticked.');
  });

  it('each card says Nothing in these 30 days yet when its data is empty', async () => {
    mockHook.mockReturnValue(EMPTY);
    await renderThemed(<InsightsScreen />);
    expect(screen.getAllByText('Nothing in these 30 days yet.')).toHaveLength(12);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
    for (const title of TITLES) expect(screen.getByText(title)).toBeTruthy();
  });

  const renderedText = (toJSON: () => unknown): string[] => {
    const text: string[] = [];
    const walk = (n: unknown): void => {
      if (n === null || n === undefined) return;
      if (typeof n === 'string') text.push(n);
      else if (Array.isArray(n)) n.forEach(walk);
      else {
        const node = n as { props?: Record<string, unknown>; children?: unknown };
        for (const v of Object.values(node.props ?? {})) if (typeof v === 'string') text.push(v);
        walk(node.children);
      }
    };
    walk(toJSON());
    return text;
  };

  it.each([['a full screen', FULL], ['an empty screen', EMPTY]])('word scan: the rendered text of %s never judges, praises or suggests', async (_n, data) => {
    mockHook.mockReturnValue(data);
    const { toJSON } = await renderThemed(<InsightsScreen />);
    const text = renderedText(toJSON);
    expect(text.length).toBeGreaterThan(20);
    expect(text.filter(s => BANNED.test(s))).toEqual([]);
  });

  it('word scan: the screen source files never use those words', () => {
    const root = join(__dirname, '..', '..');
    for (const f of ['screens/InsightsScreen.tsx', 'ui/insights/charts.tsx', 'ui/insights/format.ts', 'app/insights.tsx']) {
      expect(readFileSync(join(root, f), 'utf8').match(BANNED)).toBeNull();
    }
  });
});
