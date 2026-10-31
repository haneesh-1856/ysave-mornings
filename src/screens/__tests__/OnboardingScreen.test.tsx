import { fireEvent, screen } from '@testing-library/react-native';

import { launchHref } from '@/app/index';
import { getDayStartHour } from '@/data/repos/settings';
import { listTasks } from '@/data/repos/tasks';
import { listTopics } from '@/data/repos/topics';
import { dayStartOf } from '@/domain/dayKey';
import { createTopic } from '@/state/actions/library';
import { getDb } from '@/state/dbRef';
import { needsOnboarding } from '@/state/hooks/useOnboarding';
import { setupState, teardownState } from '@/state/testSupport';
import { renderThemed } from '@/ui/testing';

import { OnboardingScreen } from '../OnboardingScreen';

let mockN = 0;
jest.mock('@/state/ids', () => ({ newId: () => `id-${++mockN}` }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { preview?: string } = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: () => mockBack() },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => ({ reduce: true, animate: (to: number) => to }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NOW = dayStartOf('2026-10-29', 4) + 6 * 3_600_000;
beforeEach(() => { setupState(NOW); mockReplace.mockClear(); mockBack.mockClear(); mockParams = {}; });
afterEach(teardownState);

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const nextDisabled = () => screen.getByRole('button', { name: 'Next' }).props.accessibilityState?.disabled === true;

async function toTopicStep() {
  await renderThemed(<OnboardingScreen />);
  await press('Start');
  await press('Next'); // hour step
}

describe('OnboardingScreen', () => {
  it('step 1 shows welcome copy, no Back, and "1 of 5"', async () => {
    await renderThemed(<OnboardingScreen />);
    expect(screen.getByText('YSave Mornings')).toBeTruthy();
    expect(screen.getByText('Everything stays on this phone. Uninstalling the app deletes it.')).toBeTruthy();
    expect(screen.getByText('1 of 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('Back returns to the previous step', async () => {
    await renderThemed(<OnboardingScreen />);
    await press('Start');
    expect(screen.getByText('2 of 5')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '4:00 AM' }).props.accessibilityState.selected).toBe(true);
    await press('Back');
    expect(screen.getByText('1 of 5')).toBeTruthy();
  });

  it('Next is disabled until the topic and task are named', async () => {
    await toTopicStep();
    expect(nextDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Topic name'), '   ');
    expect(nextDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Topic name'), 'Study');
    expect(nextDisabled()).toBe(false);
    await press('Next');
    expect(nextDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read');
    expect(nextDisabled()).toBe(false);
  });

  it('happy path writes the hour, topic and a timed task, then opens Plan for today', async () => {
    await renderThemed(<OnboardingScreen />);
    await press('Start');
    await fireEvent.press(screen.getByRole('radio', { name: '6:00 AM' }));
    await press('Next');
    await fireEvent.changeText(screen.getByLabelText('Topic name'), 'Study');
    await fireEvent.press(screen.getByRole('radio', { name: 'Color 2' }));
    await press('Next');
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read');
    expect(screen.getByRole('radio', { name: '30' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: '45' }));
    await press('Next');
    expect(screen.getByText('Topic: Study')).toBeTruthy();
    expect(screen.getByText('Task: Read (45 min)')).toBeTruthy();
    await press('Plan today');

    const db = getDb();
    expect(getDayStartHour(db)).toBe(6);
    const topics = listTopics(db);
    expect(topics.map(x => [x.name, x.colorKey])).toEqual([['Study', 'health']]);
    const tasks = listTasks(db, topics[0].id);
    expect(tasks.map(x => [x.name, x.kind, x.minutes])).toEqual([['Read', 'timed', 45]]);
    expect(needsOnboarding()).toBe(false);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/plan/[dayKey]', params: { dayKey: '2026-10-29' } });
  });

  it('choosing Checklist creates a check task', async () => {
    await toTopicStep();
    await fireEvent.changeText(screen.getByLabelText('Topic name'), 'Home');
    await press('Next');
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Tidy');
    await fireEvent.press(screen.getByRole('radio', { name: 'Checklist' }));
    await press('Next');
    expect(screen.getByText('Task: Tidy (Checklist)')).toBeTruthy();
    await press('Plan today');
    const db = getDb();
    expect(listTasks(db, listTopics(db)[0].id).map(x => x.kind)).toEqual(['check']);
  });

  it('"I\'ll set it up myself" skips and opens Today without creating data', async () => {
    await renderThemed(<OnboardingScreen />);
    await press("I'll set it up myself");
    expect(mockReplace).toHaveBeenCalledWith('/today');
    expect(needsOnboarding()).toBe(false);
    expect(listTopics(getDb())).toEqual([]);
  });

  it('preview mode walks every step but saves nothing and goes back', async () => {
    mockParams = { preview: '1' };
    await renderThemed(<OnboardingScreen />);
    await press('Start');
    await press('Next');
    await fireEvent.changeText(screen.getByLabelText('Topic name'), 'Study');
    await press('Next');
    await fireEvent.changeText(screen.getByLabelText('Task name'), 'Read');
    await press('Next');
    await press('Plan today');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(listTopics(getDb())).toEqual([]);
    expect(needsOnboarding()).toBe(true);
  });

  it('preview mode skip goes back without recording onboarding', async () => {
    mockParams = { preview: '1' };
    await renderThemed(<OnboardingScreen />);
    await press("I'll set it up myself");
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(needsOnboarding()).toBe(true);
  });
});

describe('launch decision', () => {
  it('fresh install goes to onboarding, otherwise Morning or Today', () => {
    expect(needsOnboarding()).toBe(true);
    expect(launchHref(needsOnboarding(), false)).toBe('/onboarding');
    expect(launchHref(false, true)).toBe('/morning');
    expect(launchHref(false, false)).toBe('/today');
  });

  it('an install with data does not need onboarding', () => {
    createTopic({ name: 'Study', colorKey: 'study' });
    expect(needsOnboarding()).toBe(false);
  });
});
