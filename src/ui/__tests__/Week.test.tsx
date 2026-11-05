import { screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { MomentsPlayer } from '../moments/MomentsPlayer';
import { MOMENT_DUR } from '../moments/timeline';
import { Week } from '../moments/Week';
import { WEEK_SLOTS } from '../moments/weekScene';
import { renderThemed } from '../testing';

let mockReduce = true;
jest.mock('../useMotion', () => ({ useMotion: () => ({ reduce: mockReduce }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.setTimeout(30_000);

const MIN = 60_000;
const size = { w: 390, h: 844 };
type WeekMoment = Extract<Moment, { kind: 'week' }>;
const week = (o: Partial<WeekMoment> = {}): WeekMoment => ({
  kind: 'week', weekStart: '2026-10-26', tasksDone: 31, focusedMs: 285 * MIN, goldRings: 3, daysShowedUp: 5,
  dailyMs: [90 * MIN, 0, 45 * MIN, 120 * MIN, 30 * MIN, 0, 0], ...o,
});
const renderWeek = (m: WeekMoment) => renderThemed(<Week moment={m} lt={makeMutable(MOMENT_DUR)} size={size} settled />);

describe('Week', () => {
  it('shows exactly the moment\'s values in the four readouts (settled)', async () => {
    await renderWeek(week());
    expect(screen.getByLabelText('TASKS DONE 31')).toBeTruthy();
    expect(screen.getByLabelText('FOCUS H:MM 4:45')).toBeTruthy();
    expect(screen.getByLabelText('GOLD RINGS 3')).toBeTruthy();
    expect(screen.getByLabelText('DAYS SHOWED UP 5 / 7')).toBeTruthy();
  });

  it('an empty week shows zeros, nothing invented', async () => {
    await renderWeek(week({ tasksDone: 0, focusedMs: 0, goldRings: 0, daysShowedUp: 0, dailyMs: [0, 0, 0, 0, 0, 0, 0] }));
    expect(screen.getByLabelText('TASKS DONE 0')).toBeTruthy();
    expect(screen.getByLabelText('FOCUS H:MM 0:00')).toBeTruthy();
    expect(screen.getByLabelText('GOLD RINGS 0')).toBeTruthy();
    expect(screen.getByLabelText('DAYS SHOWED UP 0 / 7')).toBeTruthy();
  });

  it('days showed up comes from the moment, not from the focus days', async () => {
    await renderWeek(week({ daysShowedUp: 6, dailyMs: [90 * MIN, 0, 0, 0, 0, 0, 0] }));
    expect(screen.getByLabelText('DAYS SHOWED UP 6 / 7')).toBeTruthy();
  });

  it('draws the dial within its slot budget, the seven weekday letters and the headline', async () => {
    await renderWeek(week());
    expect(screen.getAllByTestId('scene3d-path', { hidden: true })).toHaveLength(WEEK_SLOTS);
    expect(screen.getAllByText('M', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByText('S', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getAllByText('T', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByText('WEEK COMPLETE.')).toBeTruthy();
  });

  it('settled, the final frame has Sunday gold', async () => {
    await renderWeek(week());
    const fills = screen.getAllByTestId('scene3d-path', { hidden: true }).map((p) => p.props.fill?.payload);
    // a gold-shaded rgb has red well above blue: payload is 0xAARRGGBB
    const gold = fills.filter((f: number | undefined) => f !== undefined && ((f >> 16) & 255) - (f & 255) > 40);
    expect(gold.length).toBeGreaterThan(0);
  });
});

describe('MomentsPlayer with a week moment', () => {
  it('renders the Week scene (not the placeholder)', async () => {
    mockReduce = true;
    await renderThemed(<MomentsPlayer moments={[week()]} bars={[]} onDone={() => {}} />);
    expect(screen.getByTestId('moment-week', { hidden: true })).toBeTruthy();
    expect(screen.getByTestId('scene3d', { hidden: true })).toBeTruthy();
    expect(screen.getByLabelText('TASKS DONE 31', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Week readout colours', () => {
  it('TASKS DONE is yellow like the bench, the others white', async () => {
    await renderWeek(week());
    expect(screen.getByText('31').props.style).toMatchObject({ color: '#f7d45e' });
    expect(screen.getByText('4:45').props.style).toMatchObject({ color: '#f2f3f5' });
    expect(screen.getByText('3').props.style).toMatchObject({ color: '#f2f3f5' });
  });
});
