import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed } from '@/ui/testing';

import { Chain } from '../Chain';
import { CloseSummary } from '../CloseSummary';
import { OutcomePicker } from '../OutcomePicker';
import { SunriseCard } from '../SunriseCard';

describe('OutcomePicker', () => {
  it('shows both choices unselected when value is null', async () => {
    await renderThemed(
      <OutcomePicker name="Read" topicColor="study" value={null} nextDayName="Friday" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Read').props.accessibilityRole).toBe('radiogroup');
    screen.getByText('Move to Friday');
    screen.getByText('Let it go');
    for (const r of screen.getAllByRole('radio')) expect(r.props.accessibilityState.checked).toBe(false);
  });

  it('reports the choice and exposes checked state', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderThemed(
      <OutcomePicker name="Read" topicColor="study" value={null} nextDayName="Friday" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByLabelText('Read: Move to Friday'));
    expect(onChange).toHaveBeenCalledWith('moved');
    await fireEvent.press(screen.getByLabelText('Read: Let it go'));
    expect(onChange).toHaveBeenCalledWith('let_go');
    await rerender(<OutcomePicker name="Read" topicColor="study" value="let_go" nextDayName="Friday" onChange={onChange} />);
    expect(screen.getByLabelText('Read: Let it go').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Read: Move to Friday').props.accessibilityState.checked).toBe(false);
  });

  it('a timed row shows the minutes left and "Move N min to <day>"', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <OutcomePicker name="Deep work" topicColor="study" value={null} nextDayName="Friday" leftoverMin={12} onChange={onChange} />,
    );
    screen.getByText('12 min left');
    screen.getByText('Move 12 min to Friday');
    await fireEvent.press(screen.getByLabelText('Deep work: Move 12 min to Friday'));
    expect(onChange).toHaveBeenCalledWith('moved');
    screen.getByText('Let it go');
    expect(screen.queryByText('Move to Friday')).toBeNull();
  });

  it('a check row has no minutes line', async () => {
    await renderThemed(
      <OutcomePicker name="Read" topicColor="study" value={null} nextDayName="Friday" onChange={() => {}} />,
    );
    expect(screen.queryByText(/min left/)).toBeNull();
  });

  it('keeps targets at least 44 pt tall and shows the topic dot', async () => {
    await renderThemed(
      <OutcomePicker name="Read" topicColor="study" value={null} nextDayName="Friday" onChange={() => {}} />,
    );
    const style = screen.getByLabelText('Read: Let it go').props.style;
    expect(JSON.stringify(style)).toContain('"minHeight":44');
    screen.getByTestId('outcome-dot');
  });
});

describe('CloseSummary', () => {
  it('shows done, focused and extra', async () => {
    await renderThemed(<CloseSummary done={3} total={4} focusedMs={130 * 60_000} extraMs={12 * 60_000} />);
    screen.getByText('3 of 4 done · 2h 10m focused · +12m extra');
    screen.getByLabelText('3 of 4 done, 2h 10m focused, 12m extra');
  });

  it('omits the extra part when it is zero', async () => {
    await renderThemed(<CloseSummary done={0} total={2} focusedMs={0} extraMs={0} />);
    screen.getByText('0 of 2 done · 0m focused');
    screen.getByLabelText('0 of 2 done, 0m focused');
  });
});

describe('SunriseCard', () => {
  it('shows the fresh page, weekday and day number', async () => {
    await renderThemed(<SunriseCard dayName="Thursday" dayNumber={8} />);
    screen.getByText('A fresh page');
    screen.getByText('Thursday · Day 8');
    screen.getByLabelText('A fresh page. Thursday, day 8');
  });
});

describe('Chain', () => {
  it('summarises active and rest days for screen readers', async () => {
    const links = ['solid', 'rest', 'solid', 'solid', 'rest', 'solid', 'solid', 'today'] as const;
    await renderThemed(<Chain links={[...links]} />);
    screen.getByLabelText('Last 8 days: 6 active, 2 rest');
  });
});
