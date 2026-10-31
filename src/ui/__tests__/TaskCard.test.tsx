import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { TaskCard, type TaskCardValue } from '../TaskCard';
import { renderThemed } from '../testing';

let mockReduce = true;
jest.mock('../useMotion', () => ({
  useMotion: () => ({ reduce: mockReduce, animate: (to: number) => to }),
}));

const base: TaskCardValue = {
  name: 'Read', topicId: 'study', kind: 'timed', minutes: 45, repeatMask: 0b0010101, isDefault: true, cue: null, treat: null, note: '',
};

function setup(over: Partial<TaskCardValue> = {}, flipped = false) {
  const topics = [{ id: 'no-topic', name: 'No topic', colorKey: 'none' as const }, { id: 'study', name: 'Study', colorKey: 'study' as const }];
  const cb = { topics, onFlip: jest.fn(), onDone: jest.fn(), onName: jest.fn(), onNote: jest.fn(), onChange: jest.fn(), onDelete: jest.fn() };
  const ui = (f: boolean, v: TaskCardValue) => <TaskCard value={v} flipped={f} {...cb} />;
  return { cb, ui, ...{ value: { ...base, ...over }, flipped } };
}

beforeEach(() => {
  mockReduce = true;
});

describe('TaskCard', () => {
  it('front shows name, repeat text, length and default; tapping asks to flip', async () => {
    const { cb, ui, value } = setup();
    await renderThemed(ui(false, value));
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('Mon Wed Fri · 45 min · default')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Read, Mon Wed Fri/ }));
    expect(cb.onFlip).toHaveBeenCalledTimes(1);
  });

  it('shows "checklist" for a checklist task and omits "default" when off', async () => {
    const { ui, value } = setup({ kind: 'check', isDefault: false, repeatMask: 0 });
    await renderThemed(ui(false, value));
    expect(screen.getByText('No repeat days · checklist')).toBeTruthy();
  });

  it('flips instantly under Reduce Motion when the flipped prop changes', async () => {
    const { ui, value } = setup();
    const { rerender } = await renderThemed(ui(false, value));
    expect(screen.queryByLabelText('Task name')).toBeNull();
    await rerender(ui(true, value));
    expect(screen.getByLabelText('Task name')).toBeTruthy();
    await rerender(ui(false, value));
    expect(screen.queryByLabelText('Task name')).toBeNull();
  });

  it('animates the flip (swaps faces at half-way) when motion is allowed', async () => {
    mockReduce = false;
    const { ui, value } = setup();
    const { rerender } = await renderThemed(ui(false, value));
    await rerender(ui(true, value));
    await waitFor(() => expect(screen.getByLabelText('Task name')).toBeTruthy());
  });

  it('back: text fields and controls call their callbacks', async () => {
    const { cb, ui, value } = setup({ cue: 'Before bed' }, true);
    await renderThemed(ui(true, value));
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read more');
    expect(cb.onName).toHaveBeenLastCalledWith('Read more');
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'chapter 3');
    expect(cb.onNote).toHaveBeenLastCalledWith('chapter 3');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tuesday, off' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ repeatMask: 0b0010111 });
    await fireEvent.press(screen.getByRole('switch', { name: 'Default task' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ isDefault: false });
    await fireEvent.press(screen.getByRole('radio', { name: 'After class' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ cue: 'After class' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Before bed' })); // selected -> clears
    expect(cb.onChange).toHaveBeenLastCalledWith({ cue: null });
    await fireEvent.press(screen.getByRole('radio', { name: 'Tea' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ treat: 'Tea' });
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(cb.onDone).toHaveBeenCalledTimes(1);
  });

  it('back: the Topic radiogroup shows the value, reports a choice, and shows the refusal text', async () => {
    const { cb, value } = setup({ topicId: 'study' }, true);
    await renderThemed(<TaskCard value={value} flipped {...cb} topicError="That topic no longer exists. Pick another." />);
    expect(screen.getByRole('radio', { name: 'Study' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'No topic' }).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByRole('radio', { name: 'No topic' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ topicId: 'no-topic' });
    expect(screen.getByText('That topic no longer exists. Pick another.')).toBeTruthy();
  });

  it('shows "A task needs a name" when the name is blanked, not for an untouched blank draft', async () => {
    const { cb, ui, value } = setup({ name: '' }, true);
    await renderThemed(ui(true, value));
    expect(screen.queryByText('A task needs a name')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'x');
    await fireEvent.changeText(screen.getByLabelText('Task name'), '  ');
    expect(screen.getByText('A task needs a name')).toBeTruthy();
    expect(cb.onName).toHaveBeenLastCalledWith('  ');
  });

  it('Done on a blank name stays open and shows why instead of closing', async () => {
    const { cb, ui, value } = setup({ name: '' }, true);
    await renderThemed(ui(true, value));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(cb.onDone).not.toHaveBeenCalled();
    expect(screen.getByText('A task needs a name')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(cb.onDone).toHaveBeenCalledTimes(1);
  });

  it('delete asks first; cancel keeps, confirm deletes', async () => {
    const { cb, ui, value } = setup({}, true);
    await renderThemed(ui(true, value));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
    expect(screen.getByText('Delete Read? Past days keep their marbles.')).toBeTruthy();
    expect(cb.onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Past days keep their marbles/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(cb.onDelete).toHaveBeenCalledTimes(1);
  });

  it('timed <-> checklist hides the slider and the minutes come back unchanged', async () => {
    const { cb, ui, value } = setup({}, true);
    const { rerender } = await renderThemed(ui(true, value));
    expect(screen.getByText('45 min')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Checklist' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ kind: 'check' });
    await rerender(ui(true, { ...value, kind: 'check' }));
    expect(screen.queryByText('45 min')).toBeNull();
    await rerender(ui(true, { ...value, kind: 'timed' })); // minutes were never touched
    expect(screen.getByText('45 min')).toBeTruthy();
  });
});
