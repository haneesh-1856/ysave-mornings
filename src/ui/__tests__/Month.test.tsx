import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { Month } from '../moments/Month';
import { MONTH_SLOTS } from '../moments/monthScene';
import { MomentsPlayer } from '../moments/MomentsPlayer';
import { MOMENT_DUR } from '../moments/timeline';
import { renderThemed } from '../testing';

jest.mock('../useMotion', () => ({ useMotion: () => ({ reduce: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.setTimeout(30_000);

const H = 3_600_000;
const size = { w: 390, h: 844 };
type MonthMoment = Extract<Moment, { kind: 'month' }>;
// 12 days of 2 h (rest day every 4th) = 18 h against a goal of 16 h.
const daily = Array.from({ length: 12 }, (_, i) => (i % 4 === 3 ? 0 : 2 * H));
const month = (o: Partial<MonthMoment> = {}): MonthMoment => ({
  kind: 'month', monthKey: '2026-11', monthFocusMs: daily.reduce((a, v) => a + v, 0), goalHours: 16, daysShowedUp: 9, dailyMs: daily, ...o,
});
const renderMonth = (m: MonthMoment) => renderThemed(<Month moment={m} lt={makeMutable(MOMENT_DUR)} size={size} />);
const hidden = { includeHiddenElements: true };

describe('Month', () => {
  it('draws the scene within its slot budget, the ring label, the running total (the month total) and the headline', async () => {
    await renderMonth(month());
    expect(screen.getAllByTestId('scene3d-path', { hidden: true })).toHaveLength(MONTH_SLOTS);
    expect(screen.getByText('GOAL 16 H', hidden)).toBeTruthy();
    expect(screen.getByDisplayValue('18.0 H', hidden)).toBeTruthy();
    expect(screen.getByText('MONTHLY GOAL.', hidden)).toBeTruthy();
    expect(screen.getByText('18:00 FOCUSED  ·  GOAL 16 H  ·  MET', hidden)).toBeTruthy();
  });

  it('the animated props carry the text at rest (the total of the month)', async () => {
    await renderMonth(month());
    expect(screen.getByTestId('month-total', hidden).props.text).toBe('18.0 H');
  });

  it('the running total at rest is monthFocusMs in hours to one decimal', async () => {
    await renderMonth(month({ monthFocusMs: 3 * H + 1_800_000, dailyMs: [H, 2 * H + 1_800_000], goalHours: 3 }));
    expect(screen.getByDisplayValue('3.5 H', hidden)).toBeTruthy();
  });

  it('review: the ring label is the total THIS MONTH, in steel, and the detail says NO GOAL SET', async () => {
    await renderMonth(month({ goalHours: null }));
    expect(screen.getByText('18.0 H THIS MONTH', hidden)).toBeTruthy();
    expect(screen.getByText('18:00 FOCUSED  ·  NO GOAL SET  ·  REVIEW', hidden)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('18.0 H THIS MONTH', hidden).props.style).color).toBe('#8b9099');
  });

  it('the ring label follows the goal and is yellow once the goal is met', async () => {
    await renderMonth(month({ goalHours: 12 }));
    const label = screen.getByText('GOAL 12 H', hidden);
    expect(StyleSheet.flatten(label.props.style).color).toBe('#f7d45e');
  });
});

describe('MomentsPlayer with a month moment', () => {
  it('renders the Month scene (not the placeholder), reduced motion draws the final frame', async () => {
    await renderThemed(<MomentsPlayer moments={[month()]} bars={[]} onDone={() => {}} />);
    expect(screen.getByTestId('moment-month', { hidden: true })).toBeTruthy();
    expect(screen.getByTestId('scene3d', { hidden: true })).toBeTruthy();
    expect(screen.getAllByText('GOAL 16 H', hidden)).toHaveLength(2); // the ring label and the player's stamp
    expect(screen.getByDisplayValue('18.0 H', hidden)).toBeTruthy();
  });
});
