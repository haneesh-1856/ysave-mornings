import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Fold } from '../Fold';
import { renderThemed } from '../testing';

describe('Fold', () => {
  it('exposes expanded state and toggles from the header', async () => {
    const onToggle = jest.fn();
    const { rerender } = await renderThemed(
      <Fold title="Study" colorKey="study" subtitle="2 tasks" open={false} onToggle={onToggle}><Text>Body</Text></Fold>,
    );
    const header = screen.getByRole('button', { name: 'Study, 2 tasks' });
    expect(header.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByText('Body')).toBeNull(); // hidden from the accessibility tree while closed
    await fireEvent.press(header);
    expect(onToggle).toHaveBeenCalledTimes(1);

    await rerender(<Fold title="Study" colorKey="study" subtitle="2 tasks" open onToggle={onToggle}><Text>Body</Text></Fold>);
    expect(screen.getByRole('button', { name: 'Study, 2 tasks' }).props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('renders the right slot outside the toggle', async () => {
    const onToggle = jest.fn();
    await renderThemed(<Fold title="Home" colorKey="home" open onToggle={onToggle} right={<Text>more</Text>}><Text>Body</Text></Fold>);
    await fireEvent.press(screen.getByText('more'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
