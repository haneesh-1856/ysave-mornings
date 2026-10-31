import { Pressable, View } from 'react-native';

import type { TopicColorKey } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  name: string;
  topicColor: TopicColorKey;
  done: boolean;
  /** Weekday the task was carried over from, already formatted (e.g. "Thursday"). */
  forwardedFrom?: string;
  /** Weekday a closed day's task was moved to at close, already formatted (e.g. "Saturday"). */
  movedTo?: string;
  onPress: () => void;
};

/** A checklist task on Today: laid out like a TaskRow (dot, name, right-hand text). Tapping opens its task page. */
export function CheckRow({ name, topicColor, done, forwardedFrom, movedTo, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      testID="check-row"
      accessibilityRole="button"
      accessibilityLabel={done ? `${name}, done` : `${name}, checklist, open`}
      onPress={onPress}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View importantForAccessibility="no" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.topic(topicColor).color }} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} color={done ? 'muted' : 'ink'}>{name}</T>
        {forwardedFrom ? <T variant="sub">{`from ${forwardedFrom}`}</T> : null}
        {movedTo ? <T variant="sub">{`moved to ${movedTo}`}</T> : null}
      </View>
      {done ? <T testID="done-check" importantForAccessibility="no" color="accent" weight="extrabold">✓</T> : null}
      <T variant="sub" color="muted">{done ? 'done' : 'checklist'}</T>
    </Pressable>
  );
}
