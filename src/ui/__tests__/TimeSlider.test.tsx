import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed } from '../testing';
import { TimeSlider, valueFromX } from '../TimeSlider';

const act = (name: string) => ({ nativeEvent: { actionName: name } });

describe('TimeSlider', () => {
  it('shows the value and exposes adjustable semantics', async () => {
    await renderThemed(<TimeSlider value={45} onChange={() => {}} />);
    expect(screen.getByText('45 min')).toBeTruthy();
    const el = screen.getByRole('adjustable');
    expect(el.props.accessibilityValue).toEqual({ min: 5, max: 180, now: 45, text: '45 min' });
  });

  it('increments and decrements in steps of 5', async () => {
    const onChange = jest.fn();
    await renderThemed(<TimeSlider value={45} onChange={onChange} />);
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', act('increment'));
    expect(onChange).toHaveBeenLastCalledWith(50);
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', act('decrement'));
    expect(onChange).toHaveBeenLastCalledWith(40);
  });

  it('clamps at min and max (no change emitted)', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderThemed(<TimeSlider value={5} onChange={onChange} />);
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', act('decrement'));
    expect(onChange).not.toHaveBeenCalled();
    await rerender(<TimeSlider value={180} onChange={onChange} />);
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', act('increment'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('honours custom min/max/step', async () => {
    const onChange = jest.fn();
    await renderThemed(<TimeSlider value={10} min={10} max={20} step={2} onChange={onChange} />);
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', act('increment'));
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it('maps a position to a snapped, clamped value', async () => {
    expect(valueFromX(0, 200, 5, 180, 5)).toBe(5);
    expect(valueFromX(200, 200, 5, 180, 5)).toBe(180);
    expect(valueFromX(-50, 200, 5, 180, 5)).toBe(5);
    expect(valueFromX(999, 200, 5, 180, 5)).toBe(180);
    expect(valueFromX(100, 200, 5, 180, 5)).toBe(95);
    expect(valueFromX(10, 0, 5, 180, 5)).toBe(5);
  });
});
