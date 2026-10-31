import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import type { ColorKey } from '@/domain/types';
import { finishOnboarding, skipOnboarding } from '@/state/actions/onboarding';
import { ValidationError } from '@/state/errors';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { ChipSet } from '@/ui/ChipSet';
import { Card } from '@/ui/Card';
import { ColorSwatches } from '@/ui/ColorSwatches';
import { hourText } from '@/ui/dayNames';
import { HourPicker } from '@/ui/HourPicker';
import { Screen } from '@/ui/Screen';
import { SunMark } from '@/ui/SunMark';
import { T } from '@/ui/T';
import { TextField } from '@/ui/TextField';

const STEPS = 5;
const DEFAULT_HOUR = 4;
const TOPIC_NAME_MAX = 24; // repo rule: topic name 1..24
const TASK_NAME_MAX = 40; // repo rule: task name 1..40
const LENGTHS = ['Checklist', '15', '30', '45', '60', '90'] as const;
const DEFAULT_LENGTH = '30';

/**
 * Runs the welcome flow: five steps on one screen, nothing is saved until the last button.
 * `?preview=1` (dev builds, from Profile) walks the same steps but saves nothing and returns where it came from.
 */
export function OnboardingScreen() {
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [topicName, setTopicName] = useState('');
  const [color, setColor] = useState<ColorKey>('study');
  const [taskName, setTaskName] = useState('');
  const [length, setLength] = useState<string>(DEFAULT_LENGTH);
  const [error, setError] = useState<string | null>(null);
  const guard = useSubmitGuard();

  const back = () => {
    setError(null);
    setStep(s => Math.max(0, s - 1));
  };
  const next = () => {
    setError(null);
    setStep(s => Math.min(STEPS - 1, s + 1));
  };

  // Android back goes to the previous step; on step 1 it does the system default.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const skip = () => {
    if (preview) return router.back();
    skipOnboarding();
    router.replace('/today');
  };

  const topic = topicName.trim();
  const task = taskName.trim();
  const lengthText = length === 'Checklist' ? 'Checklist' : `${length} min`;

  const finish = () => {
    if (preview) return router.back();
    try {
      const done = guard.run(() =>
        finishOnboarding({
          dayStartHour: hour,
          topic: { name: topic, colorKey: color },
          task: { name: task, minutes: length === 'Checklist' ? null : Number(length) },
        }),
      );
      if (done) router.replace({ pathname: '/plan/[dayKey]', params: { dayKey: done.todayKey } });
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    }
  };

  const valid = [true, true, topic !== '', task !== '', true][step];

  return (
    <Screen>
      {step > 0 ? (
        <Pressable
          testID="onboarding-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <T color="accent" weight="bold">‹ Back</T>
        </Pressable>
      ) : null}
      <T variant="sub" testID="onboarding-step" accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>{`${step + 1} of ${STEPS}`}</T>

      {step === 0 ? (
        <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}>
          <SunMark size={120} />
          <T variant="title" accessibilityRole="header">YSave Mornings</T>
          <T style={{ textAlign: 'center' }}>Plan tomorrow the evening before. Give each task the time it deserves.</T>
          <T variant="sub" style={{ textAlign: 'center' }}>Everything stays on this phone. Uninstalling the app deletes it.</T>
        </View>
      ) : null}

      {step === 1 ? (
        <>
          <T variant="title" accessibilityRole="header">When does your day start?</T>
          <T variant="sub">Your day ends at this hour, not at midnight.</T>
          <Card>
            <HourPicker value={hour} onChange={setHour} />
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <T variant="title" accessibilityRole="header">Your first topic</T>
          <T variant="sub">A topic groups tasks, like Study or Health. You can add more later.</T>
          <TextField testID="onboarding-topic" label="Topic name" value={topicName} onChangeText={setTopicName} maxLength={TOPIC_NAME_MAX} placeholder="e.g. Study" />
          <View style={{ gap: 4 }}>
            <T variant="label">Color</T>
            <ColorSwatches value={color} onChange={setColor} />
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <T variant="title" accessibilityRole="header">Your first task</T>
          <T variant="sub">One small thing is enough to begin. It repeats every day.</T>
          <TextField testID="onboarding-task" label="Task name" value={taskName} onChangeText={setTaskName} maxLength={TASK_NAME_MAX} placeholder="e.g. Read a chapter" />
          <View style={{ gap: 6 }}>
            <T variant="label">Length (minutes)</T>
            <ChipSet label="Length" options={LENGTHS} value={length} onChange={v => setLength(v ?? length)} clearable={false} />
          </View>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <T variant="title" accessibilityRole="header">Ready</T>
          <Card>
            <View style={{ gap: 10 }}>
              <T accessibilityLabel={`Day starts at ${hourText(hour)}`}>{`Day starts: ${hourText(hour)}`}</T>
              <T accessibilityLabel={`Topic ${topic}`}>{`Topic: ${topic}`}</T>
              <T accessibilityLabel={`Task ${task}, ${lengthText}`}>{`Task: ${task} (${lengthText})`}</T>
            </View>
          </Card>
          <T variant="sub">Let&apos;s plan today. You can change all of this later.</T>
        </>
      ) : null}

      {error ? <T weight="bold" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: t.c.ink }}>{error}</T> : null}

      {step === 0 ? (
        <>
          <Button testID="onboarding-start" label="Start" onPress={next} />
          <Button testID="onboarding-skip" label="I'll set it up myself" kind="ghost" onPress={skip} />
        </>
      ) : step === STEPS - 1 ? (
        <Button testID="onboarding-finish" label="Plan today" disabled={guard.busy} onPress={finish} />
      ) : (
        <Button testID="onboarding-next" label="Next" disabled={!valid} onPress={next} />
      )}
    </Screen>
  );
}
