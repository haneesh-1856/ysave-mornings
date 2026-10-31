import { fireEvent, screen } from '@testing-library/react-native';

import type { PlanReason, PlanRow as PlanRowData } from '@/domain/plan';

import { Checkbox } from '../Checkbox';
import { shortWeekday, weekdayName, weekdayPlural } from '../dayNames';
import { OneOffForm } from '../OneOffForm';
import { PlanFooter } from '../PlanFooter';
import { PlanRow } from '../PlanRow';
import { Stepper } from '../Stepper';
import { renderThemed } from '../testing';

const row = (over: Partial<PlanRowData> = {}): PlanRowData => ({
  key: 'k1', taskId: 't1', topicId: 'tp1', name: 'DSA practice', colorKey: 'study', kind: 'timed', minutes: 45,
  cue: null, treat: null, note: null, ticked: true, reason: 'default', forwardedFromDayKey: null, dayTaskId: null, ...over,
});

describe('Checkbox', () => {
  it('is a checkbox with state and toggles', async () => {
    const onChange = jest.fn();
    await renderThemed(<Checkbox checked={false} onChange={onChange} label="Include X" />);
    const cb = screen.getByRole('checkbox', { name: 'Include X' });
    expect(cb.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(cb);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Stepper', () => {
  it('steps by 5 and clamps at min and max', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderThemed(<Stepper value={30} onChange={onChange} label="Minutes" />);
    await fireEvent.press(screen.getByLabelText('Increase Minutes'));
    expect(onChange).toHaveBeenLastCalledWith(35);
    await fireEvent.press(screen.getByLabelText('Decrease Minutes'));
    expect(onChange).toHaveBeenLastCalledWith(25);
    onChange.mockClear();
    await rerender(<Stepper value={5} onChange={onChange} label="Minutes" />);
    await fireEvent.press(screen.getByLabelText('Decrease Minutes'));
    expect(onChange).not.toHaveBeenCalled();
    await rerender(<Stepper value={180} onChange={onChange} label="Minutes" />);
    await fireEvent.press(screen.getByLabelText('Increase Minutes'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is adjustable and handles accessibility actions', async () => {
    const onChange = jest.fn();
    await renderThemed(<Stepper value={30} onChange={onChange} label="Minutes" />);
    const adj = screen.getByRole('adjustable');
    expect(adj.props.accessibilityValue).toMatchObject({ min: 5, max: 180, now: 30 });
    await fireEvent(adj, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(35);
  });
});

describe('PlanRow', () => {
  const props = () => ({
    topicName: 'Study', dayKey: '2026-10-30', locale: 'en-US', expanded: false, onToggleTick: jest.fn(), onToggleExpand: jest.fn(),
    onStep: jest.fn(), onCue: jest.fn(), onTreat: jest.fn(), note: '', onNote: jest.fn(),
  });

  it('ticking and expanding are separate targets', async () => {
    const p = props();
    await renderThemed(<PlanRow row={row()} {...p} />);
    await fireEvent.press(screen.getByLabelText('Include DSA practice'));
    expect(p.onToggleTick).toHaveBeenCalledTimes(1);
    expect(p.onToggleExpand).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit DSA practice for Friday'));
    expect(p.onToggleExpand).toHaveBeenCalledTimes(1);
    expect(p.onToggleTick).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Note')).toBeNull();
  });

  const cases: [PlanReason, Partial<PlanRowData>, string][] = [
    ['default', {}, 'default'],
    ['repeats', {}, 'repeats Fri · not a default'],
    ['not_on_day', {}, 'not on Fridays · add once'],
    ['forwarded', { forwardedFromDayKey: '2026-10-29' }, 'from Thursday'],
    ['one_off', {}, 'just for Friday'],
    ['saved', {}, '45m'],
  ];
  it.each(cases)('subtitle for %s', async (reason, over, text) => {
    await renderThemed(<PlanRow row={row({ reason, ...over })} {...props()} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('formats every day word from Intl with the given locale (de-DE)', async () => {
    const de = (over: Partial<PlanRowData>) => ({ ...props(), locale: 'de-DE', row: row(over) });
    const fri = '2026-10-30';
    // Sanity: the locale really changes the words, so this test cannot pass on English fallbacks.
    expect(weekdayName(fri, 'de-DE')).not.toBe('Friday');
    const { rerender } = await renderThemed(<PlanRow {...de({ reason: 'repeats' })} />);
    expect(screen.getByText(`repeats ${shortWeekday(fri, 'de-DE')} · not a default`)).toBeTruthy();
    expect(screen.getByLabelText(`Edit DSA practice for ${weekdayName(fri, 'de-DE')}`)).toBeTruthy();
    await rerender(<PlanRow {...de({ reason: 'not_on_day' })} />);
    expect(screen.getByText(`not on ${weekdayPlural(fri, 'de-DE')} · add once`)).toBeTruthy();
    await rerender(<PlanRow {...de({ reason: 'one_off' })} />);
    expect(screen.getByText(`just for ${weekdayName(fri, 'de-DE')}`)).toBeTruthy();
    await rerender(<PlanRow {...de({ reason: 'forwarded', forwardedFromDayKey: '2026-10-29' })} />);
    expect(screen.getByText(`from ${weekdayName('2026-10-29', 'de-DE')}`)).toBeTruthy();
  });

  it('saved checklist rows say checklist', async () => {
    await renderThemed(<PlanRow row={row({ reason: 'saved', kind: 'check' })} {...props()} />);
    expect(screen.getByText('checklist')).toBeTruthy();
  });

  it('expanded timed row has stepper, chips and note; edits are reported', async () => {
    const p = { ...props(), expanded: true };
    await renderThemed(<PlanRow row={row()} {...p} />);
    await fireEvent.press(screen.getByLabelText('Increase DSA practice minutes'));
    expect(p.onStep).toHaveBeenCalledWith(5);
    await fireEvent.press(screen.getByLabelText('Decrease DSA practice minutes'));
    expect(p.onStep).toHaveBeenLastCalledWith(-5);
    await fireEvent.press(screen.getByLabelText('After class'));
    expect(p.onCue).toHaveBeenCalledWith('After class');
    await fireEvent.press(screen.getByLabelText('Tea'));
    expect(p.onTreat).toHaveBeenCalledWith('Tea');
    await fireEvent.changeText(screen.getByLabelText('Note for Friday'), 'hello');
    expect(p.onNote).toHaveBeenCalledWith('hello');
  });

  it('expanded checklist row has no stepper', async () => {
    await renderThemed(<PlanRow row={row({ kind: 'check' })} {...props()} expanded />);
    expect(screen.queryByRole('adjustable')).toBeNull();
    expect(screen.getByLabelText('Note for Friday')).toBeTruthy();
  });

  it('a one-off row has the day note field too, and the library note shows read-only above it', async () => {
    const p = props();
    await renderThemed(<PlanRow row={row({ reason: 'one_off', taskId: null })} {...p} expanded />);
    expect(screen.getByLabelText('Note for Friday')).toBeTruthy();
    expect(screen.queryByText(/^Library note:/)).toBeNull();
    expect(screen.getByLabelText('After class')).toBeTruthy();
  });

  it('shows a non-empty library note read-only', async () => {
    await renderThemed(<PlanRow row={row()} {...props()} expanded libraryNote="bring the book" />);
    expect(screen.getByText('Library note: bring the book')).toBeTruthy();
    expect(screen.getByLabelText('Note for Friday')).toBeTruthy();
  });
});

describe('OneOffForm', () => {
  const topics = [
    { id: 'a', name: 'Study', colorKey: 'study' as const },
    { id: 'b', name: 'Health', colorKey: 'health' as const },
    { id: 'no-topic', name: 'No topic', colorKey: 'none' as const },
  ];

  it('disables Add until a name is set, then returns the row (No topic, 30 min, no note)', async () => {
    const onAdd = jest.fn();
    await renderThemed(<OneOffForm dayName="Friday" topics={topics} onAdd={onAdd} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('Add').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Task name'), '  Read paper ');
    expect(screen.getByLabelText('Add').props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(onAdd).toHaveBeenCalledWith({ topicId: 'no-topic', name: 'Read paper', kind: 'timed', minutes: 30, note: null });
  });

  it('lists No topic first and selected; a chosen topic and a note are returned', async () => {
    const onAdd = jest.fn();
    await renderThemed(<OneOffForm dayName="Friday" topics={topics} onAdd={onAdd} onCancel={jest.fn()} />);
    const radios = screen.getAllByRole('radio').slice(0, 3).map(r => r.props.accessibilityLabel);
    expect(radios).toEqual(['No topic', 'Study', 'Health']);
    expect(screen.getByLabelText('No topic').props.accessibilityState.checked).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read paper');
    await fireEvent.press(screen.getByLabelText('Health'));
    await fireEvent.changeText(screen.getByLabelText('Note for Friday'), 'section 2');
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(onAdd).toHaveBeenCalledWith({ topicId: 'b', name: 'Read paper', kind: 'timed', minutes: 30, note: 'section 2' });
  });

  it('whitespace-only names stay invalid; length chips change minutes; checklist is kind check', async () => {
    const onAdd = jest.fn();
    await renderThemed(<OneOffForm dayName="Friday" topics={topics} onAdd={onAdd} onCancel={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Study'));
    await fireEvent.changeText(screen.getByLabelText('Task name'), '   ');
    expect(screen.getByLabelText('Add').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Sketch');
    await fireEvent.press(screen.getByLabelText('90'));
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(onAdd).toHaveBeenLastCalledWith({ topicId: 'a', name: 'Sketch', kind: 'timed', minutes: 90, note: null });
    await fireEvent.press(screen.getByLabelText('Checklist'));
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(onAdd).toHaveBeenLastCalledWith({ topicId: 'a', name: 'Sketch', kind: 'check', minutes: 15, note: null });
  });

  it('caps the name at 40 characters and cancels', async () => {
    const onCancel = jest.fn();
    await renderThemed(<OneOffForm dayName="Friday" topics={topics} onAdd={jest.fn()} onCancel={onCancel} />);
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'x'.repeat(60));
    expect(screen.getByLabelText('Task name').props.value).toHaveLength(40);
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('PlanFooter', () => {
  const base = { count: 3, minutes: 150, dayName: 'Friday', canConfirm: true, busy: false, onConfirm: jest.fn() };

  it('shows the summary and confirms', async () => {
    await renderThemed(<PlanFooter {...base} />);
    expect(screen.getByText('3 tasks · 2h 30m planned')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Friday looks like this ✓'));
    expect(base.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one task', async () => {
    await renderThemed(<PlanFooter {...base} count={1} minutes={45} />);
    expect(screen.getByText('1 task · 45m planned')).toBeTruthy();
  });

  it.each([{ canConfirm: false, busy: false }, { canConfirm: true, busy: true }])('disables confirm for %o', async o => {
    await renderThemed(<PlanFooter {...base} {...o} />);
    expect(screen.getByLabelText('Friday looks like this ✓').props.accessibilityState?.disabled).toBe(true);
  });
});
