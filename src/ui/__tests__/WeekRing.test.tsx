import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed } from '../testing';
import { WeekRing } from '../WeekRing';

describe('WeekRing', () => {
  it('labels each day by state, bit 0 = Monday', async () => {
    await renderThemed(<WeekRing mask={0b0000101} onChange={() => {}} />);
    expect(screen.getByLabelText('Monday, repeats')).toBeTruthy();
    expect(screen.getByLabelText('Tuesday, off')).toBeTruthy();
    expect(screen.getByLabelText('Wednesday, repeats')).toBeTruthy();
    expect(screen.getByLabelText('Sunday, off')).toBeTruthy();
  });

  it('toggles the tapped bit on and off', async () => {
    const onChange = jest.fn();
    await renderThemed(<WeekRing mask={0b0000001} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Sunday, off'));
    expect(onChange).toHaveBeenLastCalledWith(0b1000001);
    await fireEvent.press(screen.getByLabelText('Monday, repeats'));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('is not editable in readOnly mode and describes itself in one label', async () => {
    await renderThemed(<WeekRing mask={0b0010101} onChange={() => {}} readOnly />);
    expect(screen.queryByLabelText('Monday, repeats')).toBeNull();
    expect(screen.getByLabelText('Repeats Monday, Wednesday, Friday')).toBeTruthy();
  });

  it('says so when no day repeats', async () => {
    await renderThemed(<WeekRing mask={0} onChange={() => {}} readOnly />);
    expect(screen.getByLabelText('No repeat days')).toBeTruthy();
  });
});
