import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { setMonthlyGoal } from '@/state/actions/settings';
import { ValidationError } from '@/state/errors';
import { useMonthlyGoal } from '@/state/hooks/useMonthlyGoal';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';
import { TextField } from '@/ui/TextField';

/** Falls back to Today when there is no history (e.g. opened by a deep link). */
const goBack = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/today');
};

export const GOAL_PRESETS = [10, 20, 40, 60, 80, 100] as const;
const MAX_HOURS = 744;

/** A whole number of hours 1-744 from typed digits, or null when the text is not one. */
export function parseHours(text: string): number | null {
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= MAX_HOURS ? n : null;
}

export function MonthlyGoalScreen() {
  const t = useTheme();
  const goal = useMonthlyGoal();
  // Nothing is saved until confirmed. A typed value wins over a tapped option while the field is not empty.
  const [pick, setPick] = useState<number | null | undefined>(goal); // undefined: the field was cleared, nothing chosen
  const [text, setText] = useState(goal !== null && !(GOAL_PRESETS as readonly number[]).includes(goal) ? String(goal) : '');
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

  const typed = text !== '';
  const typedHours = parseHours(text);
  const invalid = typed && typedHours === null;
  const draft = typed ? (typedHours ?? undefined) : pick; // undefined: nothing valid chosen

  const choose = (h: number | null) => {
    setPick(h);
    setText('');
    setSaved(false);
    setError(null);
  };
  const type = (s: string) => {
    setText(s.replace(/\D/g, ''));
    setPick(undefined);
    setSaved(false);
    setError(null);
  };

  const confirm = () => {
    if (draft === undefined || draft === goal) return;
    try {
      guard.run(() => setMonthlyGoal(draft));
      setSaved(true);
      setError(null);
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    } finally {
      guard.reset();
    }
  };

  const option = (key: string, label: string, hours: number | null) => {
    const on = draft !== undefined && draft === hours;
    return (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityLabel={hours === null ? label : `${hours} hours`}
        accessibilityState={{ selected: on, checked: on }}
        onPress={() => choose(hours)}
        style={{
          width: '30%', flexGrow: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
          borderRadius: t.radius.rb, borderWidth: 1, borderColor: on ? t.c.accent : t.c.line,
          backgroundColor: on ? t.c.accent : t.c.surface,
        }}>
        <T importantForAccessibility="no" weight="bold" style={{ color: on ? t.c.on : t.c.ink }}>{label}</T>
      </Pressable>
    );
  };

  const confirmLabel = draft === undefined ? (typed ? 'Save goal' : 'Choose a goal') : draft === null ? 'Remove goal' : `Set goal to ${draft} hours`;
  const footer = (
    <>
      {saved ? <T weight="bold" accessibilityLiveRegion="polite">Saved</T> : null}
      <Button label={confirmLabel} disabled={draft === undefined || draft === goal || guard.busy} onPress={confirm} />
    </>
  );
  return (
    <Screen footer={footer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="Monthly goal" />
      <T variant="sub">A moment plays when the month&apos;s focus reaches your goal. With no goal, you get a month in review on the last day.</T>
      <T variant="sub">If the month&apos;s focus is already past the goal, the moment plays at the next close.</T>
      <Card>
        <View accessibilityRole="radiogroup" accessibilityLabel="Monthly goal in hours" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_PRESETS.map(h => option(String(h), `${h} h`, h))}
          {option('none', 'No goal', null)}
        </View>
      </Card>
      <TextField
        label="Custom goal in whole hours, 1 to 744"
        value={text}
        onChangeText={type}
        maxLength={3}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        onSubmitEditing={confirm}
        hideCounter
        placeholder="e.g. 25"
        error={invalid ? 'Enter a whole number of hours from 1 to 744' : undefined}
      />
      {error ? <T accessibilityLiveRegion="polite" color="danger">{error}</T> : null}
    </Screen>
  );
}
