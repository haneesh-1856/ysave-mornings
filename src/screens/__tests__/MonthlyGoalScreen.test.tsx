import { act, fireEvent, screen } from '@testing-library/react-native';

import { getMonthlyGoalHours } from '@/data/repos/settings';
import { dayStartOf } from '@/domain/dayKey';
import * as settingsActions from '@/state/actions/settings';
import { setMonthlyGoal } from '@/state/actions/settings';
import { ValidationError } from '@/state/errors';
import { getDb } from '@/state/dbRef';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { MonthlyGoalScreen, parseHours } from '../MonthlyGoalScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  router: { back: (...a: unknown[]) => mockBack(...a), replace: (...a: unknown[]) => mockReplace(...a), canGoBack: () => mockCanGoBack() },
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { setupState(NOW); mockBack.mockClear(); mockReplace.mockClear(); mockCanGoBack.mockReturnValue(true); });
afterEach(teardownState);

const FIELD = 'Custom goal in whole hours, 1 to 744';
const ALL = ['10 hours', '20 hours', '40 hours', '60 hours', '80 hours', '100 hours', 'No goal'];
const sel = (name: string) => screen.getByRole('radio', { name }).props.accessibilityState.selected;
const goal = () => getMonthlyGoalHours(getDb());
const saveBtn = (name: string | RegExp) => screen.getByRole('button', { name });

describe('parseHours', () => {
  it('accepts only whole 1-744', () => {
    expect(parseHours('1')).toBe(1);
    expect(parseHours('744')).toBe(744);
    for (const s of ['0', '745', '', '2.5', '-3', 'abc', '1000', '007x']) expect(parseHours(s)).toBeNull();
  });
});

describe('MonthlyGoalScreen', () => {
  it('with no goal, No goal is selected and save is disabled', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    expect(screen.getByText('Monthly goal')).toBeTruthy();
    expect(sel('No goal')).toBe(true);
    expect(sel('40 hours')).toBe(false);
    expect(saveBtn('Remove goal').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('selects the current preset', async () => {
    await act(async () => setMonthlyGoal(60));
    await renderThemed(<MonthlyGoalScreen />);
    expect(sel('60 hours')).toBe(true);
    expect(sel('No goal')).toBe(false);
  });

  it('a current non-preset goal shows in the field and no option is selected', async () => {
    await act(async () => setMonthlyGoal(25));
    await renderThemed(<MonthlyGoalScreen />);
    expect(screen.getByLabelText(FIELD).props.value).toBe('25');
    for (const n of ALL) expect(sel(n)).toBe(false);
  });

  it('choosing a preset drafts it, then saving persists', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '40 hours' }));
    expect(goal()).toBeNull();
    expect(sel('40 hours')).toBe(true);
    await fireEvent.press(saveBtn('Set goal to 40 hours'));
    expect(goal()).toBe(40);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(saveBtn('Set goal to 40 hours').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a custom value saves', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.changeText(screen.getByLabelText(FIELD), '25');
    expect(sel('No goal')).toBe(false);
    await fireEvent.press(saveBtn('Set goal to 25 hours'));
    expect(goal()).toBe(25);
  });

  it('a preset tap clears the typed value', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.changeText(screen.getByLabelText(FIELD), '25');
    await fireEvent.press(screen.getByRole('radio', { name: '80 hours' }));
    expect(screen.getByLabelText(FIELD).props.value).toBe('');
    await fireEvent.press(saveBtn('Set goal to 80 hours'));
    expect(goal()).toBe(80);
  });

  it('No goal clears an existing goal', async () => {
    await act(async () => setMonthlyGoal(40));
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'No goal' }));
    await fireEvent.press(saveBtn('Remove goal'));
    expect(goal()).toBeNull();
  });

  it.each(['0', '745', '999'])('invalid custom input %s shows a message and cannot be saved', async text => {
    await act(async () => setMonthlyGoal(40));
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.changeText(screen.getByLabelText(FIELD), text);
    expect(screen.getByText('Enter a whole number of hours from 1 to 744')).toBeTruthy();
    for (const n of ALL) expect(sel(n)).toBe(false);
    const btn = saveBtn('Save goal');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(goal()).toBe(40);
  });

  it('a cleared field highlights nothing and disables Save', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    const field = screen.getByLabelText(FIELD);
    await fireEvent.changeText(field, '25');
    await fireEvent.changeText(field, '');
    for (const n of ALL) expect(sel(n)).toBe(false);
    const btn = saveBtn('Choose a goal');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(goal()).toBeNull();
  });

  it('Saved disappears after an edit', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '20 hours' }));
    await fireEvent.press(saveBtn('Set goal to 20 hours'));
    expect(screen.getByText('Saved')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(FIELD), '3');
    expect(screen.queryByText('Saved')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: '40 hours' }));
    await fireEvent.press(saveBtn('Set goal to 40 hours'));
    expect(screen.getByText('Saved')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'No goal' }));
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it("'007' saves 7", async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.changeText(screen.getByLabelText(FIELD), '007');
    await fireEvent.press(saveBtn('Set goal to 7 hours'));
    expect(goal()).toBe(7);
  });

  it('shows a ValidationError from the action and does not say Saved', async () => {
    const spy = jest.spyOn(settingsActions, 'setMonthlyGoal').mockImplementation(() => {
      throw new ValidationError('monthlyGoalHours', 'Nope');
    });
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '20 hours' }));
    await fireEvent.press(saveBtn('Set goal to 20 hours'));
    expect(screen.getByText('Nope')).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(saveBtn('Set goal to 20 hours').props.accessibilityState?.disabled).toBeFalsy();
    spy.mockRestore();
  });

  it('Done on the keyboard saves; the field is numeric', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    const field = screen.getByLabelText(FIELD);
    expect(field.props.keyboardType).toBe('number-pad');
    expect(field.props.returnKeyType).toBe('done');
    await fireEvent.changeText(field, '30');
    await fireEvent(field, 'submitEditing');
    expect(goal()).toBe(30);
  });

  it('non-digits are stripped from the field', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.changeText(screen.getByLabelText(FIELD), '2.5-');
    expect(screen.getByLabelText(FIELD).props.value).toBe('25');
  });

  it('back leaves without saving; no history goes to Today', async () => {
    await renderThemed(<MonthlyGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: '20 hours' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Profile' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(goal()).toBeNull();
    mockCanGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Profile' }));
    expect(mockReplace).toHaveBeenCalledWith('/today');
  });
});
