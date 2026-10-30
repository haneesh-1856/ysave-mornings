import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed } from '../testing';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('hides the counter until within 5 of the limit', async () => {
    const { rerender } = await renderThemed(<TextField label="Name" value="abcd" onChangeText={() => {}} maxLength={10} />);
    expect(screen.queryByText('4/10')).toBeNull();
    await rerender(<TextField label="Name" value="abcde" onChangeText={() => {}} maxLength={10} />);
    expect(screen.getByText('5/10')).toBeTruthy();
  });

  it('enforces maxLength and passes text up', async () => {
    const onChangeText = jest.fn();
    await renderThemed(<TextField label="Name" value="" onChangeText={onChangeText} maxLength={5} />);
    const input = screen.getByLabelText('Name');
    expect(input.props.maxLength).toBe(5);
    await fireEvent.changeText(input, 'abc');
    expect(onChangeText).toHaveBeenLastCalledWith('abc');
    await fireEvent.changeText(input, 'abcdefgh');
    expect(onChangeText).toHaveBeenLastCalledWith('abcde');
  });

  it('shows an error message when given', async () => {
    await renderThemed(<TextField label="Name" value="" onChangeText={() => {}} maxLength={5} error="A task needs a name" />);
    expect(screen.getByText('A task needs a name')).toBeTruthy();
  });
});
