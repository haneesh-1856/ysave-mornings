import { screen } from '@testing-library/react-native';

import { SunMark } from '../SunMark';
import { renderThemed } from '../testing';

describe('SunMark', () => {
  it('draws the ring and six rays', async () => {
    await renderThemed(<SunMark size={120} />);
    expect(screen.getAllByTestId('sun-ring', { hidden: true })).toHaveLength(1);
    expect(screen.getAllByTestId('sun-ray', { hidden: true })).toHaveLength(6);
  });

  it('ring runs from 40 to 315 degrees in the brand colour by default', async () => {
    await renderThemed(<SunMark size={60} />);
    const ring = screen.getByTestId('sun-ring', { hidden: true });
    expect(ring.props.d).toBe('M61.83 35.90 A18.4 18.4 0 1 1 36.99 36.99');
    expect(ring.props.stroke.payload).toBe(0xfff7d45e); // processed ARGB
    expect(ring.props.strokeWidth).toBe(8.5);
  });

  it('takes a colour and is hidden from screen readers', async () => {
    await renderThemed(<SunMark size={60} color="#123456" />);
    expect(screen.getAllByTestId('sun-ray', { hidden: true })[0].props.stroke.payload).toBe(0xff123456);
    expect(screen.getByTestId('sun-mark', { hidden: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
