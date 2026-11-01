import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';

import { getDay } from '@/data/repos/days';
import { applyOps } from '@/data/repos/ops';
import { dayStartOf } from '@/domain/dayKey';
import type { PlanDraft, PlanRow } from '@/domain/plan';
import { createTask, createTopic } from '@/state/actions/library';
import { confirmDayPlan, saveDayDraft } from '@/state/actions/plan';
import { reconcile } from '@/state/actions/reconcile';
import { saveLook } from '@/state/actions/look';
import { pauseTask, startTask } from '@/state/actions/run';
import { setClockOverride } from '@/state/clock';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { DEFAULT_LOOK } from '@/theme/look';
import { renderThemed } from '@/ui/testing';

import type { TaskRow as TaskRowType } from '../../ui/TaskRow';
import TodayScreen from '../../app/(tabs)/today';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Render counter around the real TaskRow, keyed by task name.
const mockRenders: Record<string, number> = {};
jest.mock('@/ui/TaskRow', () => {
  const actual = jest.requireActual<{ TaskRow: typeof TaskRowType }>('@/ui/TaskRow');
  return {
    ...actual,
    TaskRow: (p: ComponentProps<typeof TaskRowType>) => {
      mockRenders[p.name] = (mockRenders[p.name] ?? 0) + 1;
      return actual.TaskRow(p);
    },
  };
});

const TODAY = '2026-10-29'; // Thursday
const TOMORROW = '2026-10-30';
const MIN = 60_000;
const NOW = dayStartOf(TODAY, 4) + 6 * 3_600_000;
let t = NOW;

beforeEach(() => {
  setupState(NOW);
  t = NOW;
  setClockOverride(() => t);
  mockPush.mockClear();
  (Haptics.impactAsync as jest.Mock).mockClear();
  for (const k of Object.keys(mockRenders)) delete mockRenders[k];
});
afterEach(() => {
  jest.useRealTimers();
  teardownState();
});

function row(topicId: string, name: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    key: `k-${name}`, taskId: null, topicId, name, colorKey: 'study', kind: 'timed', minutes: 5, cue: null,
    treat: null, note: null, ticked: true, reason: 'one_off', forwardedFromDayKey: null, dayTaskId: null, ...over,
  };
}

/** Plans `dayKey` with Study: Read (5 min), Quiz (10 min), Notes (check, from Wednesday) and Maths: Sums (check). */
function plan(dayKey: string) {
  const study = createTopic({ name: 'Study', colorKey: 'study' });
  createTask(study.id, { name: 'unused', minutes: 5 });
  const maths = createTopic({ name: 'Maths', colorKey: 'health' });
  const draft: PlanDraft = {
    dayKey,
    groups: [
      {
        topicId: study.id,
        rows: [
          row(study.id, 'Read', { minutes: 5 }),
          row(study.id, 'Quiz', { minutes: 10 }),
          row(study.id, 'Notes', { kind: 'check', forwardedFromDayKey: '2026-10-28', reason: 'forwarded' }),
        ],
      },
      { topicId: maths.id, rows: [row(maths.id, 'Sums', { kind: 'check', colorKey: 'health' })] },
    ],
    notOn: [],
  };
  confirmDayPlan(dayKey, draft);
}

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

describe('Today: header and rows', () => {
  it('shows n of m done, topic folds, rows and labels', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('0 of 4 done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Study, 0 of 3 done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Maths, 0 of 1 done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read, 5 minutes, start' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quiz, 10 minutes, start' })).toBeTruthy();
    expect(screen.getByText('from Wednesday')).toBeTruthy();
    expect(screen.getByRole('image', { name: /Jar with/ })).toBeTruthy();
  });

  it('pushes the run route for a timed row', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Read, 5 minutes, start' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0] as { pathname: string; params: { dayTaskId: string } };
    expect(arg.pathname).toBe('/run/[dayTaskId]');
    expect(typeof arg.params.dayTaskId).toBe('string');
  });

  it('pushes the run route for a checklist row too, and does not tick it', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Sums, checklist, open' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect((mockPush.mock.calls[0][0] as { pathname: string }).pathname).toBe('/run/[dayTaskId]');
    expect(screen.getByText('0 of 4 done')).toBeTruthy();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe('Today: running row', () => {
  it('ticks only the running row, and flips it to done when the time runs out', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    jest.useFakeTimers();
    await fireEvent.press(screen.getByRole('button', { name: 'Read, 5 minutes, start' }));
    const id = (mockPush.mock.calls[0][0] as { params: { dayTaskId: string } }).params.dayTaskId;
    await act(async () => {
      startTask(id);
    });
    expect(screen.getByText('5 min left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read, 5 min left, running' })).toBeTruthy();
    const quiz = mockRenders.Quiz;
    const read = mockRenders.Read;

    await act(async () => {
      t += 61_000;
      jest.advanceTimersByTime(61_000);
    });
    expect(screen.getByText('4 min left')).toBeTruthy();
    expect(mockRenders.Read).toBeGreaterThan(read);
    expect(mockRenders.Quiz).toBe(quiz); // idle rows did not re-render

    // Run out the clock: the watcher reconciles, the row becomes done (overtime), the count goes up.
    // Stop exactly at the watcher's timeout (300 s after start, 61 s already gone): letting more fake time
    // pass inside the same act() never returns under Jest's fake timers (a test-environment quirk).
    await act(async () => {
      t = NOW + 5 * MIN + 1000;
      jest.advanceTimersByTime(5 * MIN - 61_000);
    });
    expect(screen.getByText('1 of 4 done')).toBeTruthy();
    expect(screen.getByText('+0 min extra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read, done, +0 min extra' })).toBeTruthy();
  });

  it('shows a paused row with its time left', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Read, 5 minutes, start' }));
    const id = (mockPush.mock.calls[0][0] as { params: { dayTaskId: string } }).params.dayTaskId;
    await act(async () => {
      startTask(id);
    });
    await act(async () => {
      t += 2 * MIN;
      pauseTask(id);
    });
    expect(screen.getByText('paused · 3 min left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read, 3 min left, paused' })).toBeTruthy();
  });
});

describe('Today: entry cards', () => {
  it('shows Plan today and Plan tomorrow, and the empty state, when nothing is planned', async () => {
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Nothing planned for today')).toBeTruthy();
    expect(screen.queryByText(/ of .* done/)).toBeNull();
    expect(screen.queryByText(/Tomorrow is planned/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan today' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TODAY } });
    await fireEvent.press(screen.getByRole('button', { name: 'Plan tomorrow' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
  });

  it("has no Today is planned card; one Edit button beside the title opens the plan (ADR-009)", async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.queryByText(/Today is planned/)).toBeNull();
    expect(screen.queryByRole('button', { name: "See today's plan" })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan today' })).toBeNull();
    expect(screen.queryByText('Nothing planned for today')).toBeNull();
    expect(screen.getAllByRole('button', { name: "Edit today's plan" })).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('today-edit'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TODAY } });
  });

  it('shows no Edit when today is not planned, and still shows Plan today', async () => {
    await renderThemed(<TodayScreen />);
    expect(screen.queryByTestId('today-edit')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan today' })).toBeTruthy();
  });

  it('tomorrow confirmed: shows the card with See and Edit, and no Plan tomorrow button', async () => {
    plan(TOMORROW);
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Tomorrow is planned · 4 tasks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/planned/[dayKey]', params: { dayKey: TOMORROW } });
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: TOMORROW } });
    expect(screen.queryByRole('button', { name: 'Plan tomorrow' })).toBeNull();
    expect(screen.queryByTestId('today-plan-tomorrow')).toBeNull();
  });

  it('tomorrow not planned: shows the Plan tomorrow button and no card', async () => {
    await renderThemed(<TodayScreen />);
    expect(screen.getByTestId('today-plan-tomorrow')).toBeTruthy();
    expect(screen.queryByText(/Tomorrow is planned/)).toBeNull();
  });

  it('only a draft for tomorrow (drafted two days ahead, then the day rolls over): shows Plan tomorrow, no card', async () => {
    const study = createTopic({ name: 'Study', colorKey: 'study' });
    const dayAfter = '2026-10-31';
    saveDayDraft(dayAfter, { dayKey: dayAfter, groups: [{ topicId: study.id, rows: [row(study.id, 'Read')] }], notOn: [] });
    t = dayStartOf(TOMORROW, 4) + 6 * 3_600_000; // now tomorrow is the drafted day
    reconcile();
    await renderThemed(<TodayScreen />);
    expect(getDay(getDb(), dayAfter)?.planConfirmedAt ?? null).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan tomorrow' })).toBeTruthy();
    expect(screen.queryByText(/Tomorrow is planned/)).toBeNull();
  });

  it('confirming tomorrow while Today is mounted swaps the button for the card', async () => {
    await renderThemed(<TodayScreen />);
    expect(screen.getByTestId('today-plan-tomorrow')).toBeTruthy();
    await act(async () => {
      plan(TOMORROW);
    });
    expect(screen.queryByTestId('today-plan-tomorrow')).toBeNull();
    expect(screen.getByText('Tomorrow is planned · 4 tasks')).toBeTruthy();
  });

  it('updates a mounted Today when today gets planned', async () => {
    await renderThemed(<TodayScreen />);
    await act(async () => {
      plan(TODAY);
    });
    expect(screen.getByTestId('today-edit')).toBeTruthy();
    expect(screen.getByText('0 of 4 done')).toBeTruthy();
  });
});

describe('Today: closed day', () => {
  it('with tomorrow confirmed: card lists the tasks of tomorrow, no Plan tomorrow button', async () => {
    plan(TODAY);
    plan(TOMORROW);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Tomorrow is planned · 4 tasks')).toBeTruthy();
    expect(screen.getByLabelText('Tomorrow: Read')).toBeTruthy();
    expect(screen.queryByTestId('today-plan-tomorrow')).toBeNull();
  });

  it('is read-only: banner, no Edit, no Plan today, rows still open the (read-only) task page', async () => {
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(screen.getByText('Today is closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Edit today's plan" })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan today' })).toBeNull();
    expect(screen.queryByRole('button', { name: "See today's plan" })).toBeNull();
    expect(screen.queryByTestId('today-edit')).toBeNull();
    const timed = screen.getByRole('button', { name: 'Read, 5 minutes, start' });
    const check = screen.getByRole('button', { name: 'Sums, checklist, open' });
    expect(timed).not.toBeDisabled();
    await fireEvent.press(timed);
    await fireEvent.press(check);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(screen.getByText('0 of 4 done')).toBeTruthy();
  });
});

describe('Today: chain and Close button', () => {
  it('shows the soft chain with 8 links', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.getByLabelText(/^Last 8 days: \d+ active, \d+ rest$/)).toBeTruthy();
  });

  it('shows Close today when open and planned, and pushes /close', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close today' }));
    expect(mockPush).toHaveBeenCalledWith('/close');
  });

  it('hides Close today when nothing is planned or the day is closed', async () => {
    const view = await renderThemed(<TodayScreen />);
    expect(screen.queryByRole('button', { name: 'Close today' })).toBeNull();
    await view.unmount();
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(screen.queryByRole('button', { name: 'Close today' })).toBeNull();
  });

  it('does not announce closed-day rows as disabled', async () => {
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    const disabled = (label: string) =>
      screen.getAllByLabelText(label).some((n) => (n.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState?.disabled === true);
    expect(disabled('Read, 5 minutes, start')).toBe(false);
    expect(disabled('Sums, checklist, open')).toBe(false);
  });
});

describe('Today: layouts and nouns', () => {
  afterEach(() => act(async () => saveLook(DEFAULT_LOOK)));
  const at = (name: string | RegExp) => {
    // Document order of the labels and texts on screen.
    const out: string[] = [];
    const walk = (n: unknown) => {
      if (typeof n === 'string') out.push(n);
      else if (n && typeof n === 'object') {
        const node = n as { props?: { accessibilityLabel?: string }; children?: unknown[] | null };
        if (node.props?.accessibilityLabel) out.push(node.props.accessibilityLabel);
        node.children?.forEach(walk);
      }
    };
    walk(screen.toJSON());
    const text = out.join('|');
    const m = typeof name === 'string' ? text.indexOf(name) : text.search(name);
    expect(m).toBeGreaterThan(-1);
    return m;
  };
  const closeBtn = (name: string) => screen.queryByRole('button', { name });

  it('dock: collection in the footer with its label, count and a small Close', async () => {
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.getByText("Today's jar")).toBeTruthy();
    expect(screen.getByText(/^\d+ marbles?$/)).toBeTruthy();
    expect(at('Jar with ')).toBeGreaterThan(at('Read, 5 minutes, start'));
    expect(screen.getByText('Close')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close today' }));
    expect(mockPush).toHaveBeenCalledWith('/close');
  });

  it('dock: no Close when closed or empty', async () => {
    const view = await renderThemed(<TodayScreen />);
    expect(closeBtn('Close today')).toBeNull();
    expect(screen.getByText("Today's jar")).toBeTruthy();
    await view.unmount();
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(closeBtn('Close today')).toBeNull();
  });

  it('corner: no dock; label and small collection after the list, ghost Close on the left', async () => {
    await act(async () => saveLook({ layout: 'corner', art: 'garden' }));
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.queryByText('Close')).toBeNull();
    expect(screen.getByText(/Today's garden · \d+/)).toBeTruthy();
    const list = at('Read, 5 minutes, start');
    expect(at(/Today's garden · \d+/)).toBeGreaterThan(list);
    expect(at('Garden with ')).toBeGreaterThan(list);
    expect(at('Close today')).toBeLessThan(at(/Today's garden · \d+/));
    await fireEvent.press(screen.getByRole('button', { name: 'Close today' }));
    expect(mockPush).toHaveBeenCalledWith('/close');
  });

  it('corner: no Close when closed or empty', async () => {
    await act(async () => saveLook({ layout: 'corner' }));
    const view = await renderThemed(<TodayScreen />);
    expect(closeBtn('Close today')).toBeNull();
    await view.unmount();
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(closeBtn('Close today')).toBeNull();
  });

  it('hero: big collection under the header, then the list, then Close today', async () => {
    await act(async () => saveLook({ layout: 'hero', art: 'card' }));
    plan(TODAY);
    await renderThemed(<TodayScreen />);
    expect(screen.getByText(/^\d+ in today's stamp card$/)).toBeTruthy();
    const list = at('Read, 5 minutes, start');
    expect(at('Stamp card with ')).toBeLessThan(list);
    expect(at('Close today')).toBeGreaterThan(list);
    await fireEvent.press(screen.getByRole('button', { name: 'Close today' }));
    expect(mockPush).toHaveBeenCalledWith('/close');
  });

  it('hero: no Close when closed', async () => {
    await act(async () => saveLook({ layout: 'hero' }));
    plan(TODAY);
    closeToday();
    await renderThemed(<TodayScreen />);
    expect(closeBtn('Close today')).toBeNull();
    expect(screen.getByLabelText(/^Jar with \d+ marbles?, closed$/)).toBeTruthy();
  });

  it('dock copy follows the look: sky and stamp card', async () => {
    await act(async () => saveLook({ art: 'sky' }));
    plan(TODAY);
    const view = await renderThemed(<TodayScreen />);
    expect(screen.getByText("Today's sky")).toBeTruthy();
    expect(screen.getByText(/^\d+ stars?$/)).toBeTruthy();
    await view.unmount();
    await act(async () => saveLook({ art: 'card' }));
    await renderThemed(<TodayScreen />);
    expect(screen.getByText("Today's stamp card")).toBeTruthy();
    expect(screen.getByText(/^\d+ stamps?$/)).toBeTruthy();
  });
});
