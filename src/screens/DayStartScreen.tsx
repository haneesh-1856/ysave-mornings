import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable } from 'react-native';

import { setDayStart } from '@/state/actions/settings';
import { ValidationError } from '@/state/errors';
import { useDayStart } from '@/state/hooks/useDayStart';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { hourText } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { HourPicker } from '@/ui/HourPicker';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

/** Falls back to Today when there is no history (e.g. opened by a deep link). */
const goBack = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/today');
};

/**
 * The explanation, true for any chosen hour: a clock time just before the day starts belongs to the day before.
 * Hour 0: the day is the calendar day, so nothing late-night carries over. Hour 1: 12:30 AM is the only early example.
 */
export function explanation(hour: number): string {
  if (hour === 0) return 'Your day starts at midnight, so each day is one calendar day.';
  if (hour === 1) return 'A session at 12:30 AM still counts as yesterday.';
  return 'A session at 1 AM still counts as yesterday.';
}

export function DayStartScreen() {
  const { hour, todayEndsAt } = useDayStart();
  const [draft, setDraft] = useState(hour); // tapping an hour only changes this; nothing is saved until confirmed
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useSubmitGuard();

  // Android back = the "‹ Profile" button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const choose = (h: number) => {
    setDraft(h);
    setSaved(false);
    setError(null);
  };

  const confirm = () => {
    try {
      guard.run(() => setDayStart(draft));
      setSaved(true);
      setError(null);
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    } finally {
      guard.reset();
    }
  };

  const endHour = new Date(todayEndsAt).getHours();
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="My day starts" />
      <T variant="sub">{explanation(draft)}</T>
      <Card>
        <HourPicker value={draft} onChange={choose} />
      </Card>
      {error ? <T accessibilityLiveRegion="polite" color="danger">{error}</T> : null}
      {endHour !== draft ? (
        <T variant="sub" accessibilityLiveRegion="polite">{`Today still ends at ${hourText(endHour)}. From tomorrow, each day ends at ${hourText(draft)}.`}</T>
      ) : null}
      <Button label={`Start my days at ${hourText(draft)}`} disabled={draft === hour || guard.busy} onPress={confirm} />
      {saved ? <T weight="bold" accessibilityLiveRegion="polite">Saved</T> : null}
    </Screen>
  );
}
