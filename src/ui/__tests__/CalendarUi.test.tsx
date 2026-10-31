import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { CollectionItem } from '@/domain/collection';
import type { DayKey, Epoch } from '@/domain/types';
import { renderThemed } from '@/ui/testing';

import { CalendarLegend } from '../CalendarLegend';
import { DayCard } from '../DayCard';
import { dayCardLine, type DayCardLineInput } from '../dayCardLine';
import { hourText, monthName, weekdayInitials } from '../dayNames';
import { HourPicker } from '../HourPicker';
import { MonthGrid, cellLabel, type MonthGridCell } from '../MonthGrid';
import { SettingRow } from '../SettingRow';
import { StatTiles } from '../StatTiles';

let mockReduce = true;
const mockAnimate = jest.fn((to: number) => to);
jest.mock('../useMotion', () => ({
  useMotion: () => ({ reduce: mockReduce, animate: mockAnimate }),
}));

beforeEach(() => {
  mockReduce = true;
  mockAnimate.mockClear();
});

const item = (i: number): CollectionItem => ({
  kind: 'task', dayTaskId: `t${i}`, colorKey: 'study', small: false, gold: false, at: i as Epoch,
});

const cell = (dayKey: DayKey, over: Partial<MonthGridCell> = {}): MonthGridCell => ({
  dayKey, items: [], glows: false, closed: false, isToday: false, isTomorrow: false, isFuture: false, ...over,
});

// October 2026: the 1st is a Thursday. Two weeks are enough for the grid.
const weeks: (MonthGridCell | null)[][] = [
  [null, null, null, cell('2026-10-01', { closed: true, items: [item(1)] }), cell('2026-10-02'), cell('2026-10-03'), cell('2026-10-04')],
  [
    cell('2026-10-05'),
    cell('2026-10-06', { glows: true, closed: true, items: [item(1), item(2), item(3)] }),
    cell('2026-10-07', { isToday: true, items: [item(1)] }),
    cell('2026-10-08', { isTomorrow: true, isFuture: true }),
    cell('2026-10-09', { isFuture: true }),
    cell('2026-10-10', { isFuture: true }),
    cell('2026-10-11', { isFuture: true }),
  ],
];

describe('dayNames additions (en-US)', () => {
  it('lists Monday-first narrow initials', () => {
    expect(weekdayInitials('en-US')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
  it('names the month and formats the hour', () => {
    expect(monthName('2026-10-22', 'en-US')).toBe('October');
    expect(hourText(4, 'en-US')).toBe('4:00 AM');
    expect(hourText(0, 'en-US')).toBe('12:00 AM');
    expect(hourText(13, 'en-US')).toBe('1:00 PM');
  });
});

describe('dayCardLine', () => {
  const base: DayCardLineInput = { kind: 'past', glows: false, planned: true, done: 0, total: 0, focusedMs: 0 };
  const min = (m: number) => m * 60_000;

  it('past: glowing day says everything done with tasks and focus', () => {
    expect(dayCardLine({ ...base, glows: true, done: 3, total: 3, focusedMs: min(80) }, 'Monday'))
      .toBe('Everything you planned, done. 3 tasks · 1h 20m focused');
  });
  it('past: partly done reads calmly, never failed or missed', () => {
    const line = dayCardLine({ ...base, done: 2, total: 4, focusedMs: min(45) }, 'Monday');
    expect(line).toBe('2 of 4 tasks · 45m focused');
    expect(line).not.toMatch(/fail|miss/i);
  });
  it('past: nothing done but planned, no focus', () => {
    expect(dayCardLine({ ...base, done: 0, total: 2 }, 'Monday')).toBe('2 tasks planned.');
    expect(dayCardLine({ ...base, done: 0, total: 1 }, 'Monday')).toBe('1 task planned.');
  });
  it('past: nothing done but planned, with focused time', () => {
    expect(dayCardLine({ ...base, done: 0, total: 3, focusedMs: min(20) }, 'Monday')).toBe('3 tasks planned · 20m focused');
  });
  it('today with nothing done keeps the "0 of n" count', () => {
    expect(dayCardLine({ ...base, kind: 'today', done: 0, total: 2 }, 'Monday')).toBe('0 of 2 tasks');
  });
  it('past with nothing is a rest day', () => {
    expect(dayCardLine(base, 'Monday')).toBe('A rest day. Nothing missing.');
  });
  it('today uses the same wording; empty today is not a rest day', () => {
    expect(dayCardLine({ ...base, kind: 'today', glows: true, done: 1, total: 1, focusedMs: min(30) }, 'Friday'))
      .toBe('Everything you planned, done. 1 task · 30m focused');
    expect(dayCardLine({ ...base, kind: 'today' }, 'Friday')).toBe('Nothing planned yet.');
  });
  it('tomorrow: planned or not', () => {
    expect(dayCardLine({ ...base, kind: 'tomorrow', planned: true, total: 4 }, 'Saturday')).toBe('Planned: 4 tasks. One marble waiting.');
    expect(dayCardLine({ ...base, kind: 'tomorrow', planned: true, total: 1 }, 'Saturday')).toBe('Planned: 1 task. One marble waiting.');
    expect(dayCardLine({ ...base, kind: 'tomorrow', planned: false }, 'Saturday')).toBe('Plan it tonight. One marble waiting.');
  });
  it('later', () => {
    expect(dayCardLine({ ...base, kind: 'later' }, 'Sunday')).toBe('Not planned yet.');
  });
  it('drafts: later and tomorrow lines never say planned', () => {
    const later = dayCardLine({ ...base, kind: 'later', planned: false, drafted: true, draftCount: 3 });
    expect(later).toBe('Draft: 3 tasks. Finalize it the evening before.');
    expect(dayCardLine({ ...base, kind: 'later', planned: false, drafted: true, draftCount: 1 })).toBe('Draft: 1 task. Finalize it the evening before.');
    const tomorrow = dayCardLine({ ...base, kind: 'tomorrow', planned: false, drafted: true, draftCount: 3 });
    expect(tomorrow).toBe('Draft ready: 3 tasks. Finalize it tonight.');
    expect(`${later}${tomorrow}`).not.toMatch(/planned/i);
  });
});

describe('MonthGrid', () => {
  it('shows Monday-first initials and a labelled button for every real day, none for blanks', async () => {
    const { getAllByRole, getByLabelText } = await renderThemed(<MonthGrid weeks={weeks} selected="2026-10-07" onSelect={() => {}} locale="en-US" />);
    expect(getAllByRole('button')).toHaveLength(11);
    getByLabelText('Thursday 1 October, 1 marble, closed');
    getByLabelText('Tuesday 6 October, glowing, 3 marbles, closed');
    getByLabelText('Wednesday 7 October, today, 1 marble');
    getByLabelText('Thursday 8 October, tomorrow');
    getByLabelText('Friday 9 October');
  });

  it('gives each day button at least a 44 pt target: tall enough, and side slop for narrow phones', async () => {
    const { getByLabelText } = await renderThemed(<MonthGrid weeks={weeks} selected="2026-10-07" onSelect={() => {}} locale="en-US" />);
    const day = getByLabelText('Friday 9 October');
    expect(StyleSheet.flatten(day.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(day.props.hitSlop).toEqual({ left: 3, right: 3 });
  });

  it('builds the contract label', () => {
    expect(cellLabel(cell('2026-10-22', { glows: true, items: [item(1), item(2), item(3)] }), 'en-US')).toBe('Thursday 22 October, glowing, 3 marbles');
  });

  it('marks a drafted day with an outline dot and the label "draft plan"', async () => {
    const w = [[cell('2026-10-20', { isFuture: true, drafted: true }), cell('2026-10-21', { isFuture: true })]];
    const { getByLabelText, getAllByTestId } = await renderThemed(<MonthGrid weeks={w} selected="2026-10-21" onSelect={() => {}} locale="en-US" />);
    getByLabelText('Tuesday 20 October, draft plan');
    getByLabelText('Wednesday 21 October');
    expect(getAllByTestId('draft-dot', { hidden: true })).toHaveLength(1);
  });

  it('reports a selection and marks the selected day', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await renderThemed(<MonthGrid weeks={weeks} selected="2026-10-07" onSelect={onSelect} locale="en-US" />);
    expect(getByLabelText('Wednesday 7 October, today, 1 marble').props.accessibilityState).toMatchObject({ selected: true });
    expect(getByLabelText('Friday 9 October').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(getByLabelText('Friday 9 October'));
    expect(onSelect).toHaveBeenCalledWith('2026-10-09');
  });

  it('draws the glow only on glowing days, and a lid on closed days', async () => {
    const { getAllByTestId, queryAllByTestId, getAllByLabelText } = await renderThemed(
      <MonthGrid weeks={weeks} selected="2026-10-07" onSelect={() => {}} locale="en-US" />,
    );
    expect(getAllByTestId('glow', { includeHiddenElements: true })).toHaveLength(1);
    expect(queryAllByTestId('jar-lid-closed', { includeHiddenElements: true }).length).toBe(2); // Oct 1 and Oct 6
    expect(getAllByLabelText(/Thursday 1 October/)).toHaveLength(1);
  });

  it('glow is static under Reduce Motion and pulses otherwise', async () => {
    mockReduce = true;
    const still = await renderThemed(<MonthGrid weeks={weeks} selected="2026-10-07" onSelect={() => {}} locale="en-US" />);
    const flat = StyleSheet.flatten(still.getByTestId('glow', { includeHiddenElements: true }).props.style) as { opacity?: number };
    expect(flat.opacity ?? 1).toBe(1);
    await still.unmount();

    mockReduce = false;
    const live = await renderThemed(<MonthGrid weeks={weeks} selected="2026-10-07" onSelect={() => {}} locale="en-US" />);
    expect(live.getByTestId('glow', { includeHiddenElements: true })).toBeTruthy(); // mounts and unmounts cleanly with the loop running
    await live.unmount();
  });

  it('keeps blank cells out of the accessibility tree', async () => {
    const { getAllByRole } = await renderThemed(<MonthGrid weeks={[[null, cell('2026-10-02')]]} selected="2026-10-02" onSelect={() => {}} locale="en-US" />);
    expect(getAllByRole('button')).toHaveLength(1);
  });
});

describe('CalendarLegend', () => {
  it('explains the glow', async () => {
    const { getByLabelText, getByText } = await renderThemed(<CalendarLegend />);
    getByLabelText('Glowing days: everything you planned got done');
    expect(getByText('Glowing days: everything you planned got done', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('DayCard', () => {
  it('shows the jar, one spoken block, and no button without an action', async () => {
    const { getByLabelText, queryByRole } = await renderThemed(
      <DayCard title="Thursday, Oct 22" line="Plan it tonight. One marble waiting." items={[item(1)]} closed={false} glows={false} />,
    );
    getByLabelText('Thursday, Oct 22. Plan it tonight. One marble waiting.');
    getByLabelText('Jar with 1 marble');
    expect(queryByRole('button')).toBeNull();
  });

  it('shows a closed jar and a ghost action that fires', async () => {
    const onPress = jest.fn();
    const { getByRole, getByLabelText } = await renderThemed(
      <DayCard title="Today" line="x" items={[]} closed glows action={{ label: 'Edit', onPress }} />,
    );
    getByLabelText('Jar with 0 marbles, closed');
    await fireEvent.press(getByRole('button', { name: 'Edit' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StatTiles', () => {
  it('speaks each tile as one item', async () => {
    const { getByLabelText, getByText } = await renderThemed(
      <StatTiles tiles={[{ value: '7', label: 'days you showed up' }, { value: '14h', label: 'focused' }, { value: '23', label: 'marbles' }]} />,
    );
    getByLabelText('7 days you showed up');
    getByLabelText('14h focused');
    getByLabelText('23 marbles');
    const style = StyleSheet.flatten(getByText('14h', { includeHiddenElements: true }).props.style) as { fontVariant?: string[] };
    expect(style.fontVariant).toContain('tabular-nums');
  });
});

describe('SettingRow', () => {
  it('a pressable row is a button with a chevron and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByRole, getByText } = await renderThemed(<SettingRow label="My day starts" value="4:00 AM" onPress={onPress} />);
    const row = getByRole('button', { name: 'My day starts, 4:00 AM' });
    expect(getByText('›', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a disabled pressable row announces disabled and does nothing', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderThemed(<SettingRow label="Glass" value="Coming in M7" onPress={onPress} disabled />);
    const row = getByRole('button', { name: 'Glass, Coming in M7' });
    expect(row).toBeDisabled();
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a value-only row is plain text with a tag, no button, no chevron', async () => {
    const { queryByRole, queryByText, getByLabelText } = await renderThemed(<SettingRow label="Reminders" value="Not decided" />);
    expect(queryByRole('button')).toBeNull();
    expect(queryByText('›', { includeHiddenElements: true })).toBeNull();
    getByLabelText('Reminders, Not decided');
  });

  it('a row with a right control keeps the control reachable', async () => {
    const { getByText, getByLabelText } = await renderThemed(<SettingRow label="Sounds" right={<CalendarLegend />} />);
    expect(getByText('Sounds')).toBeTruthy();
    getByLabelText('Glowing days: everything you planned got done');
  });
});

describe('HourPicker', () => {
  it('has 24 radios, one selected, with Intl hour text', async () => {
    const { getAllByRole, getByRole } = await renderThemed(<HourPicker value={4} onChange={() => {}} locale="en-US" />);
    expect(getAllByRole('radio')).toHaveLength(24);
    expect(getByRole('radio', { name: '4:00 AM' }).props.accessibilityState).toMatchObject({ selected: true, checked: true });
    expect(getByRole('radio', { name: '5:00 AM' }).props.accessibilityState).toMatchObject({ selected: false });
    getByRole('radio', { name: '12:00 AM' });
    getByRole('radio', { name: '11:00 PM' });
  });

  it('reports the chosen hour', async () => {
    const onChange = jest.fn();
    const { getByRole, getByLabelText } = await renderThemed(<HourPicker value={4} onChange={onChange} locale="en-US" />);
    getByLabelText('Hour the day starts');
    await fireEvent.press(getByRole('radio', { name: '6:00 AM' }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('every choice is at least 44 pt tall', async () => {
    const { getAllByRole } = await renderThemed(<HourPicker value={0} onChange={() => {}} locale="en-US" />);
    for (const r of getAllByRole('radio')) {
      const s = StyleSheet.flatten(r.props.style) as { minHeight: number };
      expect(s.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
