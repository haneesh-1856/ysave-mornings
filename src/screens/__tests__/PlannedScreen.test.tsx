import { act, fireEvent, screen } from '@testing-library/react-native';

import { getDay } from '@/data/repos/days';
import { applyOps } from '@/data/repos/ops';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft, PlanRow } from '@/domain/plan';
import { createTask, createTopic, removeTopic, updateTopic } from '@/state/actions/library';
import { confirmDayPlan } from '@/state/actions/plan';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { PlannedScreen } from '../PlannedScreen';

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
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30'; // Friday
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;

beforeEach(() => {
  setupState(NOW);
  mockPush.mockClear();
  mockReplace.mockClear();
  mockDismissTo.mockClear();
});
afterEach(teardownState);

/** Closes today in the db (as M5's close will), creating its day row if missing. */
function closeToday() {
  const db = getDb();
  const exists = getDay(db, TODAY) != null;
  const closed = { dayKey: TODAY, closedAt: NOW, closedBy: 'user' as const };
  applyOps(
    db,
    {
      closeSessions: [], completions: [], outcomes: [], insertDayTasks: [], forwardDayTasks: [],
      createDays: exists ? [] : [{ ...closed, planConfirmedAt: null, planDraftedAt: null, planUpdatedAt: null, dayStartHour: 4 }],
      closeDays: exists ? [closed] : [],
    },
    () => 'x',
    NOW,
  );
}

function row(topicId: string, name: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    key: `k-${name}`, taskId: null, topicId, name, colorKey: 'study', kind: 'timed', minutes: 45, cue: null,
    treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null, ...over,
  };
}

/** Confirms a plan with two timed rows (one forwarded from Thursday) and one checklist row. Returns the topic id. */
function plan(dayKey: string): string {
  const topic = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(topic.id, { name: 'unused', minutes: 5 });
  const draft: PlanDraft = {
    dayKey,
    groups: [
      {
        topicId: topic.id,
        rows: [
          row(topic.id, 'Read', { minutes: 45 }),
          row(topic.id, 'Notes', { kind: 'check' }),
          row(topic.id, 'Past', { minutes: 30, forwardedFromDayKey: TODAY, reason: 'forwarded' }),
        ],
      },
    ],
    notOn: [],
  };
  confirmDayPlan(dayKey, draft);
  return topic.id;
}

describe('PlannedScreen', () => {
  it('lists the planned tasks with the total, and Edit/Done for tomorrow', async () => {
    plan(TOMORROW);
    await renderThemed(<PlannedScreen dayKey={TOMORROW} />);
    expect(screen.getByText('Friday is planned')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('checklist')).toBeTruthy();
    expect(screen.getByText('Study · from Thursday')).toBeTruthy();
    expect(screen.getByText('3 tasks · 1h 15m')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Jar with 1 marble' })).toBeTruthy();
    // Edit: Plan takes Planned's place (Plan's confirm then replaces itself with a fresh Planned).
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
    expect(mockPush).not.toHaveBeenCalled();
    // Done: pops back to the existing tabs instead of stacking another.
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('shows live topic names from the topic list, and "Removed topic" once the topic is removed', async () => {
    const topicId = plan(TOMORROW);
    updateTopic(topicId, { name: 'Maths' });
    await renderThemed(<PlannedScreen dayKey={TOMORROW} />);
    expect(screen.getByText('Maths · from Thursday')).toBeTruthy();
    expect(screen.getAllByText('Maths')).toHaveLength(2);
    // The mounted screen re-reads via usePlanTopics (topics data version).
    await act(async () => {
      removeTopic(topicId);
    });
    expect(screen.getByText('Removed topic · from Thursday')).toBeTruthy();
    expect(screen.getAllByText('Removed topic')).toHaveLength(2);
    expect(screen.queryByText(/Maths/)).toBeNull();
    expect(screen.getByText('Read')).toBeTruthy();
  });

  it('shows Edit for an already-planned today while it is open (ADR-009)', async () => {
    plan(TODAY);
    await renderThemed(<PlannedScreen dayKey={TODAY} />);
    expect(screen.getByText('Today is planned')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TODAY } });
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('hides Edit for a closed today', async () => {
    plan(TODAY);
    closeToday();
    await renderThemed(<PlannedScreen dayKey={TODAY} />);
    expect(screen.getByText('Today is planned')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('shows the no-plan state with Plan it when plannable', async () => {
    await renderThemed(<PlannedScreen dayKey={TOMORROW} />);
    expect(screen.getByText('Nothing planned for Friday yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan it' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockDismissTo).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });

  it('offers only back for a past day with no plan', async () => {
    await renderThemed(<PlannedScreen dayKey="2026-10-20" />);
    expect(screen.queryByRole('button', { name: 'Plan it' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeTruthy();
  });

  it('rejects a bad key', async () => {
    await renderThemed(<PlannedScreen dayKey="nope" />);
    expect(screen.getByText('Not a day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/today');
  });
});
