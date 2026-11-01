import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';

import type { CollectionItem } from '@/domain/collection';

import { BigNumber } from '../BigNumber';
import { Celebration } from '../Celebration';
import { CheckRow } from '../CheckRow';
import { CountdownBar } from '../CountdownBar';
import { Dock } from '../Dock';
import { TaskRow } from '../TaskRow';
import { renderThemed } from '../testing';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const MIN = 60_000;
const row = (over: Partial<ComponentProps<typeof TaskRow>> = {}) => (
  <TaskRow name="Read" topicColor="study" minutes={45} state="idle" remainingMs={45 * MIN} overtimeMs={0} gold={false} onPress={() => {}} a11yLabel="Read, 45 minutes" {...over} />
);

describe('TaskRow', () => {
  it.each([
    ['idle', { state: 'idle' as const }, '45 min'],
    ['running', { state: 'running' as const, remainingMs: 12 * MIN }, '12 min left'],
    ['running boundary', { state: 'running' as const, remainingMs: 11 * MIN + 1 }, '12 min left'],
    ['running last second', { state: 'running' as const, remainingMs: 1 }, '1 min left'],
    ['paused', { state: 'paused' as const, remainingMs: 12 * MIN }, 'paused · 12 min left'],
    ['overtime', { state: 'overtime' as const, remainingMs: 0, overtimeMs: 3 * MIN }, '+3 min extra'],
    ['overtime under a minute', { state: 'overtime' as const, remainingMs: 0, overtimeMs: 59_999 }, '+0 min extra'],
    ['stopped', { state: 'stopped' as const, remainingMs: 0 }, 'done'],
  ])('%s shows text', async (_n, props, text) => {
    await renderThemed(row(props));
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('carried time shows "from <day>" and "moved to <day>", and says so to screen readers (ADR-014)', async () => {
    await renderThemed(row({ forwardedFrom: 'Friday', movedTo: 'Sunday' }));
    expect(screen.getByText('from Friday')).toBeTruthy();
    expect(screen.getByText('moved to Sunday')).toBeTruthy();
    expect(screen.getByLabelText('Read, 45 minutes, from Friday, moved to Sunday')).toBeTruthy();
  });

  it('shows the live dot only while running, the check when done, and the gold mark', async () => {
    const { rerender } = await renderThemed(row({ state: 'running' }));
    expect(screen.getByTestId('live-dot')).toBeTruthy();
    expect(screen.queryByTestId('gold-mark')).toBeNull();
    await rerender(row({ state: 'stopped', gold: true }));
    expect(screen.queryByTestId('live-dot')).toBeNull();
    expect(screen.getByTestId('done-check')).toBeTruthy();
    expect(screen.getByTestId('gold-mark')).toBeTruthy();
  });

  it('is a labelled button that fires onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(row({ onPress }));
    await fireEvent.press(screen.getByRole('button', { name: 'Read, 45 minutes' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('CheckRow', () => {
  it('opens on press, says checklist after the name and shows the forwarded text', async () => {
    const onPress = jest.fn();
    await renderThemed(<CheckRow name="Stretch" topicColor="health" done={false} forwardedFrom="Thursday" onPress={onPress} />);
    expect(screen.getByText('from Thursday')).toBeTruthy();
    expect(screen.getByText('checklist')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Stretch, checklist, open' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('omits forwarded text and shows done with a check mark', async () => {
    await renderThemed(<CheckRow name="Stretch" topicColor="health" done onPress={() => {}} />);
    expect(screen.queryByText(/from /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Stretch, done' })).toBeTruthy();
    expect(screen.getByText('done')).toBeTruthy();
    expect(screen.getByTestId('done-check')).toBeTruthy();
  });
});

describe('CountdownBar', () => {
  it.each(['thin', 'smooth', 'seg'] as const)('%s exposes progress value text', async (variant) => {
    await renderThemed(<CountdownBar budgetMs={45 * MIN} remainingMs={12 * MIN} overtimeMs={0} variant={variant} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ text: '12 minutes left', now: 12, max: 45 });
    expect(screen.queryByTestId('bar-overtime')).toBeNull();
    expect(screen.queryAllByTestId('bar-gap')).toHaveLength(variant === 'seg' ? 2 : 0);
  });
  it('shows overtime stripes and extra text', async () => {
    await renderThemed(<CountdownBar budgetMs={30 * MIN} remainingMs={0} overtimeMs={3 * MIN + 5000} variant="smooth" />);
    expect(screen.getByTestId('bar-overtime')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ text: '3 minutes extra' });
  });
});

describe('BigNumber', () => {
  it('shows value and caption', async () => {
    await renderThemed(<BigNumber value="12" caption="min left" />);
    expect(screen.getByLabelText('12 min left')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('min left')).toBeTruthy();
  });
});

describe('Celebration', () => {
  beforeEach(() => jest.clearAllMocks());
  it('fires the success haptic once per appearance, not on re-render', async () => {
    const { rerender } = await renderThemed(<Celebration visible={false} />);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await rerender(<Celebration visible />);
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    await rerender(<Celebration visible text="Nice" />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    await rerender(<Celebration visible={false} />);
    await rerender(<Celebration visible />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('mounting already visible shows the static text without the haptic', async () => {
    const { rerender } = await renderThemed(<Celebration visible />);
    expect(screen.getByText('Done for today')).toBeTruthy();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await rerender(<Celebration visible />);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('is transition-based: visible -> hidden -> visible celebrates again', async () => {
    const { rerender } = await renderThemed(<Celebration visible />);
    await rerender(<Celebration visible={false} />);
    expect(screen.queryByText('Done for today')).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await rerender(<Celebration visible />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('Dock', () => {
  const items: CollectionItem[] = [{ kind: 'task', dayTaskId: 'a', colorKey: 'study', small: false, gold: false, at: 1 }];
  it('renders the jar with its label and is pressable', async () => {
    const onPress = jest.fn();
    await renderThemed(<Dock items={items} closed={false} onPress={onPress} />);
    expect(screen.getByLabelText('Jar with 1 marble')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Today's jar, 1 marble" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('is not a button without onPress', async () => {
    await renderThemed(<Dock items={[]} closed />);
    expect(screen.getByLabelText('Jar with 0 marbles, closed')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
