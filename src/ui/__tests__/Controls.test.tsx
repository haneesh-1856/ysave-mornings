import { fireEvent, screen } from '@testing-library/react-native';

import { ChipSet } from '../ChipSet';
import { ColorSwatches } from '../ColorSwatches';
import { ConfirmBox } from '../ConfirmBox';
import { CUES } from '../presets';
import { Segmented } from '../Segmented';
import { Switch } from '../Switch';
import { renderThemed } from '../testing';

describe('Switch', () => {
  it('is a switch with checked state and toggles', async () => {
    const onChange = jest.fn();
    await renderThemed(<Switch value={false} onChange={onChange} label="Default task" />);
    const sw = screen.getByRole('switch', { name: 'Default task' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Segmented', () => {
  const options = [{ value: 'timed', label: 'Timed' }, { value: 'check', label: 'Checklist' }];
  it('marks the selected option and reports a change', async () => {
    const onChange = jest.fn();
    await renderThemed(<Segmented options={options} value="timed" onChange={onChange} />);
    expect(screen.getByLabelText('Timed').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Checklist').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByLabelText('Checklist'));
    expect(onChange).toHaveBeenCalledWith('check');
  });
});

describe('ChipSet', () => {
  it('selects a chip, and tapping the selected chip clears it', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderThemed(<ChipSet label="When" options={CUES} value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('After class'));
    expect(onChange).toHaveBeenLastCalledWith('After class');
    await rerender(<ChipSet label="When" options={CUES} value="After class" onChange={onChange} />);
    expect(screen.getByLabelText('After class').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByLabelText('After class'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('ConfirmBox', () => {
  it('calls confirm and cancel', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn();
    await renderThemed(<ConfirmBox text="Past days keep their marbles." confirmLabel="Delete task" danger onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Past days keep their marbles.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Delete task'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ColorSwatches', () => {
  it('shows six swatches, marks the selected one, and reports a pick', async () => {
    const onChange = jest.fn();
    await renderThemed(<ColorSwatches value="health" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByLabelText('Color 2').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByLabelText('Color 4'));
    expect(onChange).toHaveBeenCalledWith('sun');
  });
});
