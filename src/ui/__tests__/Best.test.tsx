import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { Best } from '../moments/Best';
import { BEST_SLOTS } from '../moments/bestScene';
import { MomentsPlayer } from '../moments/MomentsPlayer';
import { MOMENT_DUR } from '../moments/timeline';
import { renderThemed } from '../testing';

jest.mock('../useMotion', () => ({ useMotion: () => ({ reduce: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.setTimeout(30_000);

const MIN = 60_000;
const size = { w: 390, h: 844 };
type BestMoment = Extract<Moment, { kind: 'best' }>;
const best = (o: Partial<BestMoment> = {}): BestMoment => ({
  kind: 'best', todayMs: 150 * MIN, previousBestMs: 140 * MIN,
  recentMs: [96, 110, 104, 128, 0, 95, 119, 134, 101, 122, 88, 131, 113].map((m) => m * MIN), ...o,
});
const renderBest = (m: BestMoment) => renderThemed(<Best moment={m} lt={makeMutable(MOMENT_DUR)} size={size} />);
const hidden = { includeHiddenElements: true };

describe('Best', () => {
  it('draws the scene within its slot budget and the three labels with the moment values', async () => {
    await renderBest(best());
    expect(screen.getAllByTestId('scene3d-path', { hidden: true })).toHaveLength(BEST_SLOTS);
    expect(screen.getByText('BEST 2:20', hidden)).toBeTruthy();
    expect(screen.getByText('2:30', hidden)).toBeTruthy();
    expect(screen.getByText('+0:10', hidden)).toBeTruthy();
    expect(screen.getByText('PERSONAL BEST.', hidden)).toBeTruthy();
    expect(screen.getByText('2:30 FOCUSED  ·  BEST WAS 2:20', hidden)).toBeTruthy();
  });

  it('the labels follow other values (formatHM of the moment): 3:05 over a 2:45 best is +0:20', async () => {
    await renderBest(best({ todayMs: 185 * MIN, previousBestMs: 165 * MIN }));
    expect(screen.getByText('BEST 2:45', hidden)).toBeTruthy();
    expect(screen.getByText('3:05', hidden)).toBeTruthy();
    expect(screen.getByText('+0:20', hidden)).toBeTruthy();
  });

  it('the labels are steel, white and yellow', async () => {
    await renderBest(best());
    const color = (t: string) => StyleSheet.flatten(screen.getByText(t, hidden).props.style).color;
    expect(color('BEST 2:20')).toBe('#8b9099');
    expect(color('2:30')).toBe('#f2f3f5');
    expect(color('+0:10')).toBe('#f7d45e');
  });

  it('settled, the final frame has today gold and the rest graphite', async () => {
    await renderBest(best());
    const fills = screen.getAllByTestId('scene3d-path', { hidden: true }).map((p) => p.props.fill?.payload);
    // a gold-shaded rgb has red well above blue: payload is 0xAARRGGBB
    const gold = fills.filter((f: number | undefined) => f !== undefined && ((f >> 16) & 255) - (f & 255) > 40);
    expect(gold.length).toBeGreaterThanOrEqual(3);
    expect(gold.length).toBeLessThanOrEqual(6);
  });
});

describe('MomentsPlayer with a best moment', () => {
  it('renders the Best scene (not the placeholder), reduced motion draws the final frame', async () => {
    await renderThemed(<MomentsPlayer moments={[best()]} bars={[]} onDone={() => {}} />);
    expect(screen.getByTestId('moment-best', { hidden: true })).toBeTruthy();
    expect(screen.getByTestId('scene3d', { hidden: true })).toBeTruthy();
    expect(screen.getByText('BEST 2:20', hidden)).toBeTruthy();
    expect(screen.getByText('+0:10', hidden)).toBeTruthy();
  });
});
