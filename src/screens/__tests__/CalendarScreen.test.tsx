import { act, fireEvent, screen } from '@testing-library/react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft } from '@/domain/plan';
import { createTask, createTopic } from '@/state/actions/library';
import { confirmDayPlan, saveDayDraft } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { setClockOverride } from '@/state/clock';
import { bump } from '@/state/store';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import CalendarScreen from '../../app/(tabs)/calendar';

let mockN = 0;
// These render large trees (a full month grid of day cells); motion is already mocked, but under full parallel load a test
// can pass 5 s though it takes well under that alone. A modest per-file timeout avoids the flake.
jest.setTimeout(15000);

jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30';
const FIRST = '2026-09-20'; // the first day with a row: September is reachable, August is not
const noon = (k: string) => dayStartOf(k, 4) + 6 * 3_600_000;
let t = noon(TODAY);

beforeEach(() => {
  setupState(noon(FIRST));
  t = noon(FIRST);
  setClockOverride(() => t);
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'Read', kind: 'check', minutes: 5, repeatMask: 127, isDefault: true });
  reconcile(); // a row for FIRST
  t = noon(TODAY);
  reconcile(); // a row for today
  mockPush.mockClear();
});
afterEach(() => teardownState());

function planTomorrow() {
  const topic = createTopic({ name: 'Maths', colorKey: 'health' });
  const draft: PlanDraft = {
    dayKey: TOMORROW,
    groups: [
      {
        topicId: topic.id,
        rows: [
          {
            key: 'k', taskId: null, topicId: topic.id, name: 'Sums', colorKey: 'health', kind: 'check', minutes: 5, cue: null,
            treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null,
          },
        ],
      },
    ],
    notOn: [],
  };
  confirmDayPlan(TOMORROW, draft);
}

/** Saves a one-row draft for a later day (state action, as the Plan screen would). */
function saveDraftFor(dayKey: string) {
  const topic = createTopic({ name: 'Maths', colorKey: 'health' });
  const draft: PlanDraft = {
    dayKey,
    groups: [
      {
        topicId: topic.id,
        rows: [
          {
            key: 'k', taskId: null, topicId: topic.id, name: 'Sums', colorKey: 'health', kind: 'check', minutes: 5, cue: null,
            treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null,
          },
        ],
      },
    ],
    notOn: [],
  };
  saveDayDraft(dayKey, draft);
}

const swipe = async (translationX: number) => {
  const c = createGestureController('calendar-swipe');
  await act(async () => {
    c.begin();
    c.activate();
    c.update({ translationX });
    c.end({ translationX });
  });
};

describe('Calendar screen', () => {
  it('renders the month, Day N, the legend and today\'s card', async () => {
    await renderThemed(<CalendarScreen />);
    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByText('Day 40')).toBeTruthy(); // 20 Sep -> 29 Oct
    expect(screen.getAllByText('Glowing days: everything you planned got done').length).toBeGreaterThan(0);
    expect(screen.getByText('Thursday, 29 October')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Thursday 29 October, today/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy();
  });

  it('selecting a day updates the card; only plannable days get an action', async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Friday 30 October, tomorrow/ }));
    expect(screen.getByText('Friday, 30 October')).toBeTruthy();
    expect(screen.getByText('Plan it tonight. One marble waiting.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });

    await fireEvent.press(screen.getByRole('button', { name: /^Saturday 31 October/ }));
    expect(screen.getByText('Saturday, 31 October')).toBeTruthy();
    expect(screen.getByText('Not planned yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan ahead' })).toBeTruthy(); // a later day can hold a draft (ADR-010)
  });

  it('shows Edit for a planned tomorrow and navigates with its key', async () => {
    planTomorrow();
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Friday 30 October, tomorrow/ }));
    expect(screen.getByText('Planned: 1 task. One marble waiting.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
  });

  it('arrows move to any past or future month, across the year boundary, both ways', async () => {
    await renderThemed(<CalendarScreen />);
    const next = () => screen.getByRole('button', { name: 'Next month' });
    const prev = () => screen.getByRole('button', { name: 'Previous month' });
    expect(next().props.accessibilityState?.disabled).toBeFalsy();
    expect(prev().props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(next());
    expect(screen.getByText('November')).toBeTruthy();
    await fireEvent.press(next());
    expect(screen.getByText('December')).toBeTruthy();
    await fireEvent.press(next());
    expect(screen.getByText('January 2027')).toBeTruthy();
    await fireEvent.press(prev());
    expect(screen.getByText('December')).toBeTruthy();
    for (let i = 0; i < 4; i++) await fireEvent.press(prev()); // Nov, Oct, Sep, Aug (before the first row)
    expect(screen.getByText('August')).toBeTruthy();
    for (let i = 0; i < 8; i++) await fireEvent.press(prev());
    expect(screen.getByText('December 2025')).toBeTruthy();
  });

  it('swipe moves through months both ways, across the year boundary', async () => {
    await renderThemed(<CalendarScreen />);
    await swipe(-120);
    await swipe(-120);
    await swipe(-120);
    expect(screen.getByText('January 2027')).toBeTruthy();
    await swipe(-10); // too short
    expect(screen.getByText('January 2027')).toBeTruthy();
    await swipe(120);
    expect(screen.getByText('December')).toBeTruthy();
    for (let i = 0; i < 10; i++) await swipe(120);
    expect(screen.getByText('February')).toBeTruthy();
  });

  it("Today chip: hidden in today's month, shown elsewhere, jumps back with the selection", async () => {
    await renderThemed(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('December')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByText('Thursday, 29 October')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();
  });

  it('a far-future day reads "Not planned yet." and offers neither Plan nor Edit', async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('Tuesday, 1 December')).toBeTruthy();
    expect(screen.getByText('Not planned yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('later day: Plan ahead opens the plan; a saved draft reads as a draft with Edit draft', async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Saturday 31 October/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Plan ahead' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: '2026-10-31' } });
    mockPush.mockClear();
    await act(async () => saveDraftFor('2026-10-31'));
    expect(await screen.findByText('Draft: 1 task. Finalize it the evening before.')).toBeTruthy();
    expect(screen.getByLabelText(/^Saturday 31 October.*draft plan/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit draft' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: '2026-10-31' } });
  });

  it('tomorrow with an unfinalized draft: Draft ready + Finalize', async () => {
    saveDraftFor('2026-10-31'); // drafted while it was a later day
    t = noon(TOMORROW); // now 31 October is tomorrow
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Saturday 31 October, tomorrow/ }));
    expect(screen.getByText('Draft ready: 1 task. Finalize it tonight.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Finalize' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: '2026-10-31' } });
  });

  it('arrows: the selection follows the month (the 1st, or today in today\'s month)', async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Saturday 31 October/ }));
    expect(screen.getByText('Saturday, 31 October')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September')).toBeTruthy();
    expect(screen.getByText('Tuesday, 1 September')).toBeTruthy();
    expect(screen.queryByText('Saturday, 31 October')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('Thursday, 29 October')).toBeTruthy();
  });

  it("swipe: the selection follows the month (the 1st, or today in today's month)", async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Friday 30 October, tomorrow/ }));
    await swipe(120); // previous
    expect(screen.getByText('September')).toBeTruthy();
    expect(screen.getByText('Tuesday, 1 September')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull();
    await swipe(-120); // next
    expect(screen.getByText('Thursday, 29 October')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy();
  });

  it('resets the month and selection to today when the day changes', async () => {
    await renderThemed(<CalendarScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Saturday 31 October/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September')).toBeTruthy();
    t = noon('2026-11-01');
    await act(async () => {
      reconcile();
      bump('days');
    });
    expect(screen.getByText('November')).toBeTruthy();
    expect(screen.getByText('Sunday, 1 November')).toBeTruthy();
  });
});
