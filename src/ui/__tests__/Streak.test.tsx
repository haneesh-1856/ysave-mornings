import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { MomentsPlayer } from '../moments/MomentsPlayer';
import { Streak } from '../moments/Streak';
import { STREAK_SLOTS } from '../moments/streakScene';
import { MOMENT_DUR } from '../moments/timeline';
import { renderThemed } from '../testing';

jest.mock('../useMotion', () => ({ useMotion: () => ({ reduce: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.setTimeout(30_000);

const size = { w: 390, h: 844 };
type StreakMoment = Extract<Moment, { kind: 'streak' }>;
const streak = (o: Partial<StreakMoment> = {}): StreakMoment => ({ kind: 'streak', days: 7, endDayKey: '2026-11-04', ...o });
const renderStreak = (m: StreakMoment) => renderThemed(<Streak moment={m} lt={makeMutable(MOMENT_DUR)} size={size} />);
const hidden = { includeHiddenElements: true };

describe('Streak', () => {
  it('draws the stair within its slot budget and the real weekday letters, today last', async () => {
    await renderStreak(streak());
    expect(screen.getAllByTestId('scene3d-path', { hidden: true })).toHaveLength(STREAK_SLOTS);
    // 7 days ending Wednesday: T F S S M T W
    expect(screen.getAllByText('T', hidden)).toHaveLength(2);
    expect(screen.getAllByText('S', hidden)).toHaveLength(2);
    expect(screen.getAllByText('F', hidden)).toHaveLength(1);
    expect(screen.getAllByText('M', hidden)).toHaveLength(1);
    expect(screen.getByText('W · TODAY', hidden)).toBeTruthy();
  });

  it('a 7-day run ending on Sunday reads M T W T F S S with today last', async () => {
    await renderStreak(streak({ endDayKey: '2026-11-08' }));
    expect(screen.getByText('S · TODAY', hidden)).toBeTruthy();
    expect(screen.getAllByText('S', hidden)).toHaveLength(1);
    expect(screen.getAllByText('M', hidden)).toHaveLength(1);
  });

  it('a long run labels only the latest week (7 labels), today yellow, and says LAST 21 DAYS', async () => {
    await renderStreak(streak({ days: 28 }));
    expect(screen.getAllByText(/^[MTWFS]( · TODAY)?$/, hidden)).toHaveLength(7);
    expect(StyleSheet.flatten(screen.getByText('W · TODAY', hidden).props.style).color).toBe('#f7d45e');
    expect(screen.getByText('LAST 21 DAYS', hidden)).toBeTruthy();
  });

  it('exactly 21 days does not say LAST 21 DAYS', async () => {
    await renderStreak(streak({ days: 21 }));
    expect(screen.queryByText('LAST 21 DAYS', hidden)).toBeNull();
  });

  it('settled, the final frame has the top step gold', async () => {
    await renderStreak(streak());
    const fills = screen.getAllByTestId('scene3d-path', { hidden: true }).map((p) => p.props.fill?.payload);
    // a gold-shaded rgb has red well above blue: payload is 0xAARRGGBB
    const gold = fills.filter((f: number | undefined) => f !== undefined && ((f >> 16) & 255) - (f & 255) > 40);
    expect(gold.length).toBeGreaterThan(0);
  });
});

describe('MomentsPlayer with a streak moment', () => {
  it('renders the Streak scene (not the placeholder), reduced motion', async () => {
    await renderThemed(<MomentsPlayer moments={[streak()]} bars={[]} onDone={() => {}} />);
    expect(screen.getByTestId('moment-streak', { hidden: true })).toBeTruthy();
    expect(screen.getByTestId('scene3d', { hidden: true })).toBeTruthy();
    expect(screen.getByText('W · TODAY', hidden)).toBeTruthy();
  });
});
