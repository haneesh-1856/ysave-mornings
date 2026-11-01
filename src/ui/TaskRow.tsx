import { Pressable, View } from 'react-native';

import type { TimerState } from '@/domain/timer';
import type { TopicColorKey } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';
import { extraText, minutesLeftText } from './timeText';

type Props = {
  name: string;
  topicColor: TopicColorKey;
  minutes: number;
  state: TimerState;
  remainingMs: number;
  overtimeMs: number;
  gold: boolean;
  onPress: () => void;
  a11yLabel: string;
  disabled?: boolean;
  /** Weekday the task (or its leftover time) was carried over from, already formatted (e.g. "Thursday"). */
  forwardedFrom?: string;
  /** Weekday a closed day's leftover time was moved to at close, already formatted (e.g. "Saturday"). */
  movedTo?: string;
};

/** The right-hand text for each state (contract). */
export function taskRowText(p: Pick<Props, 'minutes' | 'state' | 'remainingMs' | 'overtimeMs'>): string {
  switch (p.state) {
    case 'idle': return `${p.minutes} min`;
    case 'running': return minutesLeftText(p.remainingMs);
    case 'paused': return `paused · ${minutesLeftText(p.remainingMs)}`;
    case 'overtime': return extraText(p.overtimeMs);
    case 'stopped': return 'done';
  }
}

/** A timed task on Today. Tapping opens Run. A live dot marks the running task. */
export function TaskRow({ name, topicColor, minutes, state, remainingMs, overtimeMs, gold, onPress, a11yLabel, disabled = false, forwardedFrom, movedTo }: Props) {
  const t = useTheme();
  const text = taskRowText({ minutes, state, remainingMs, overtimeMs });
  const notes = [forwardedFrom ? `from ${forwardedFrom}` : null, movedTo ? `moved to ${movedTo}` : null].filter((x): x is string => x !== null);
  return (
    <Pressable
      testID="task-row"
      accessibilityRole="button"
      accessibilityLabel={notes.length ? `${a11yLabel}, ${notes.join(', ')}` : a11yLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View importantForAccessibility="no" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.topic(topicColor).color }} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} color={state === 'stopped' ? 'muted' : 'ink'}>{name}</T>
        {notes.map((n) => <T key={n} variant="sub">{n}</T>)}
      </View>
      {state === 'running' ? (
        <View testID="live-dot" importantForAccessibility="no" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.c.accent }} />
      ) : null}
      {gold ? <T testID="gold-mark" importantForAccessibility="no" color="sun" weight="extrabold">★</T> : null}
      {state === 'stopped' ? <T testID="done-check" importantForAccessibility="no" color="accent" weight="extrabold">✓</T> : null}
      <T variant="sub" color={state === 'overtime' ? 'sun' : state === 'running' ? 'accent' : 'muted'}>{text}</T>
    </Pressable>
  );
}
