import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { loadDayBundle } from '@/data/repos/days';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft, PlanRow } from '@/domain/plan';
import { createTopic, createTask } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { startTask } from '@/state/actions/run';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import CloseScreen from '../CloseScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    dismissTo: (...a: unknown[]) => mockDismissTo(...a),
  },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
const mockLid = jest.fn();
jest.mock('@/ui/collection/Collection', () => ({
  Collection: (p: { closed: boolean; animateLid?: boolean }) => {
    mockLid(p.closed, p.animateLid);
    return null;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30'; // Friday
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;
let t = NOW;

beforeEach(() => {
  setupState(NOW);
  t = NOW;
  setClockOverride(() => t);
  for (const m of [mockPush, mockReplace, mockDismissTo, mockLid, Haptics.notificationAsync]) (m as jest.Mock).mockClear();
});
afterEach(() => teardownState());

function row(topicId: string, name: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    key: `k-${name}`, taskId: null, topicId, name, colorKey: 'study', kind: 'timed', minutes: 5, cue: null,
    treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null, ...over,
  };
}

/** Today: Study Read (5 min timed), Notes + Essay (checks); Maths Sums (check). */
function plan() {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'unused', minutes: 5 });
  const maths = createTopic({ name: 'Maths', colorKey: 'health' });
  const draft: PlanDraft = {
    dayKey: TODAY,
    groups: [
      { topicId: study.id, rows: [row(study.id, 'Read'), row(study.id, 'Notes', { kind: 'check' }), row(study.id, 'Essay', { kind: 'check' })] },
      { topicId: maths.id, rows: [row(maths.id, 'Sums', { kind: 'check', colorKey: 'health' })] },
    ],
    notOn: [],
  };
  confirmDayPlan(TODAY, draft);
}

const today = () => loadDayBundle(getDb(), TODAY)!;
const idOf = (name: string) => today().dayTasks.find((d) => d.name === name)!.id;
const radio = (name: string, label: string) => screen.getByRole('radio', { name: `${name}: ${label}` });
const choose = async (...names: string[]) => {
  for (const n of names) await fireEvent.press(radio(n, 'Let it go'));
};

describe('Close screen', () => {
  it('shows the summary and a picker per unticked task', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    expect(screen.getByText('Close today')).toBeTruthy();
    expect(screen.getByText('0 of 4 done · 0m focused')).toBeTruthy();
    expect(screen.getByText('Not ticked today')).toBeTruthy();
    expect(screen.getByLabelText('Notes')).toBeTruthy();
    expect(screen.getByLabelText('Essay')).toBeTruthy();
    expect(screen.getByLabelText('Sums')).toBeTruthy();
    expect(screen.queryByLabelText('Read')).toBeNull();
    expect(screen.getAllByText('Move to Friday').length).toBe(3);
    expect(mockLid).toHaveBeenLastCalledWith(false, true);
  });

  it('Not yet goes back to Today with dismissTo', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not yet' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('Close with a missing choice highlights it and writes nothing', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    await choose('Notes');
    await fireEvent.press(screen.getByRole('button', { name: 'Close the jar' }));
    expect(screen.getByText('Choose Move or Let go for 2 tasks')).toBeTruthy();
    expect(screen.getAllByTestId('outcome-missing')).toHaveLength(2);
    expect(today().day.closedAt).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    await choose('Essay'); // choosing clears that highlight
    expect(screen.getAllByTestId('outcome-missing')).toHaveLength(1);
    await choose('Sums'); // and the button works again after the error
    await fireEvent.press(screen.getByRole('button', { name: 'Close the jar' }));
    expect(today().day.closedAt).not.toBeNull();
  });

  it('closes with choices: moves a row, animates the lid, offers Plan tomorrow (replace) and Back to Today', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    await fireEvent.press(radio('Notes', 'Move to Friday'));
    await choose('Essay', 'Sums');
    await fireEvent.press(screen.getByRole('button', { name: 'Close the jar' }));

    expect(today().day.closedAt).not.toBeNull();
    const tomorrow = loadDayBundle(getDb(), TOMORROW)!;
    expect(tomorrow.dayTasks.map((d) => d.name)).toEqual(['Notes']);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(mockLid).toHaveBeenLastCalledWith(true, true);
    expect(screen.getByText('Jar closed')).toBeTruthy();
    expect(screen.queryByLabelText('Notes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the jar' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Plan tomorrow' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('a double tap closes once', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    await choose('Notes', 'Essay', 'Sums');
    const btn = screen.getByRole('button', { name: 'Close the jar' });
    await fireEvent.press(btn);
    await fireEvent.press(btn); // a second tap on the stale button must not close again
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(today().day.closedBy).toBe('user');
  });

  it('stops a running timer at close time', async () => {
    plan();
    await renderThemed(<CloseScreen />);
    await act(async () => {
      startTask(idOf('Read'));
    });
    t += 2 * 60_000;
    await choose('Notes', 'Essay', 'Sums');
    await fireEvent.press(screen.getByRole('button', { name: 'Close the jar' }));
    const sessions = today().sessionsByDayTask[idOf('Read')];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).toBe(t);
  });

  it('opens an already closed day as a read-only summary with Plan tomorrow', async () => {
    plan();
    const first = await renderThemed(<CloseScreen />);
    await choose('Notes', 'Essay', 'Sums');
    await fireEvent.press(screen.getByRole('button', { name: 'Close the jar' }));
    await first.unmount();
    mockLid.mockClear();
    await renderThemed(<CloseScreen />);
    expect(screen.getByText('Today is closed')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Close the jar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan tomorrow' })).toBeTruthy();
    expect(mockLid).toHaveBeenLastCalledWith(true, true);
  });

  it('says there is nothing to close when nothing is planned', async () => {
    await renderThemed(<CloseScreen />);
    expect(screen.getByText('Nothing to close yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close the jar' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });
});
