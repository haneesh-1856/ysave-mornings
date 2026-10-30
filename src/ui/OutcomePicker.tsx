import { Pressable, View } from 'react-native';

import type { CloseOutcome } from '@/domain/types';
import type { TopicColorKey } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  name: string;
  topicColor: TopicColorKey;
  /** null = not chosen yet; there is deliberately no default. */
  value: CloseOutcome | null;
  /** Already-localised weekday of the next day, e.g. "Friday". */
  nextDayName: string;
  onChange: (v: CloseOutcome) => void;
};

/** One unticked task at close: pick "Move to <day>" or "Let it go". Nothing is pre-selected. */
export function OutcomePicker({ name, topicColor, value, nextDayName, onChange }: Props) {
  const t = useTheme();
  const options: { value: CloseOutcome; label: string }[] = [
    { value: 'moved', label: `Move to ${nextDayName}` },
    { value: 'let_go', label: 'Let it go' },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View testID="outcome-dot" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.topic(topicColor).color }} />
        <T weight="bold" style={{ flex: 1 }}>{name}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={`${name}: ${o.label}`}
              accessibilityState={{ checked: on, selected: on }}
              onPress={() => onChange(o.value)}
              style={{
                flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
                borderRadius: t.radius.rb, borderWidth: 1.5, borderColor: on ? t.c.accent : t.c.line,
                backgroundColor: on ? t.c.accent : t.c.surface,
              }}>
              <T weight="bold" style={{ color: on ? t.c.on : t.c.ink, textAlign: 'center' }}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
