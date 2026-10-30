import { fireEvent, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { renderThemed } from '../testing';
import { TopicForm } from '../TopicForm';

async function setup(props: Partial<ComponentProps<typeof TopicForm>> = {}) {
  const onSave = jest.fn();
  await renderThemed(<TopicForm initialName="" initialColor="study" onSave={onSave} {...props} />);
  return { onSave };
}

describe('TopicForm', () => {
  it('blank name disables Save and says why; preview shows "New topic"', async () => {
    const { onSave } = await setup();
    expect(screen.getByText('A topic needs a name')).toBeTruthy();
    expect(screen.getByLabelText('Save').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New topic, Preview')).toBeTruthy();
  });

  it('typing a name enables Save, updates the preview and saves name + color', async () => {
    const { onSave } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Piano ');
    expect(screen.queryByText('A topic needs a name')).toBeNull();
    expect(screen.getByLabelText('Piano, Preview')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Color 3'));
    expect(screen.getByLabelText('Color 3').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(onSave).toHaveBeenCalledWith('  Piano ', 'home');
  });

  it('shows an error from the save under the name', async () => {
    await setup({ initialName: 'x', error: 'Topic name must be 1-24 characters' });
    expect(screen.getByText('Topic name must be 1-24 characters')).toBeTruthy();
  });

  it('has no Remove section without onRemove', async () => {
    await setup({ initialName: 'Study' });
    expect(screen.queryByLabelText('Remove topic')).toBeNull();
  });

  it('Remove asks first; Cancel keeps it, Remove confirms', async () => {
    const onRemove = jest.fn();
    await setup({ initialName: 'Study', onRemove });
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    expect(screen.getByText('Remove Study? Removes its tasks from your library. Past days keep their marbles.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onRemove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    await fireEvent.press(screen.getByLabelText('Remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('busy disables Save, Remove topic and the Remove confirm', async () => {
    const onRemove = jest.fn();
    const { onSave } = await setup({ initialName: 'Study', onRemove });
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    await screen.rerender(<TopicForm initialName="Study" initialColor="study" onSave={onSave} onRemove={onRemove} busy />);
    expect(screen.getByLabelText('Save').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Remove').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Save'));
    await fireEvent.press(screen.getByLabelText('Remove'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('busy disables the Remove topic button before confirming', async () => {
    await setup({ initialName: 'Study', onRemove: jest.fn(), busy: true });
    expect(screen.getByLabelText('Remove topic').props.accessibilityState?.disabled).toBe(true);
  });
});
