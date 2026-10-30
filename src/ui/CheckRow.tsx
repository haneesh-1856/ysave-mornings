import { View } from 'react-native';

import type { TopicColorKey } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { Checkbox } from './Checkbox';
import { T } from './T';

type Props = {
  name: string;
  topicColor: TopicColorKey;
  done: boolean;
  /** Weekday the task was carried over from, already formatted (e.g. "Thursday"). */
  forwardedFrom?: string;
  onToggle: () => void;
};

/** A checklist task: Checkbox, a small marble in the topic color, and the name. */
export function CheckRow({ name, topicColor, done, forwardedFrom, onToggle }: Props) {
  const t = useTheme();
  const color = t.topic(topicColor).color;
  return (
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Checkbox checked={done} onChange={onToggle} label={name} />
      <View
        importantForAccessibility="no"
        style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, opacity: done ? 1 : 0.45 }}
      />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} color={done ? 'muted' : 'ink'} style={done ? { textDecorationLine: 'line-through' } : undefined}>{name}</T>
        {forwardedFrom ? <T variant="sub">{`from ${forwardedFrom}`}</T> : null}
      </View>
    </View>
  );
}
