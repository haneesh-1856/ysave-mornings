import { Pressable, View } from 'react-native';

import { NO_TOPIC_ID, type ColorKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

export type TopicOption = { id: string; name: string; colorKey: ColorKey };

type Props = {
  topics: TopicOption[];
  value: string;
  onChange: (topicId: string) => void;
  /** Why the last choice was refused (e.g. the topic was removed meanwhile). */
  error?: string;
};

/** "Topic" radio group: No topic first (the default, needs no choosing), then the user's topics in the given order. */
export function TopicPicker({ topics, value, onChange, error }: Props) {
  const t = useTheme();
  const options = [...topics.filter(x => x.id === NO_TOPIC_ID), ...topics.filter(x => x.id !== NO_TOPIC_ID)];
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">Topic</T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Topic" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map(tp => {
          const on = tp.id === value;
          return (
            <Pressable
              key={tp.id}
              accessibilityRole="radio"
              accessibilityLabel={tp.name}
              accessibilityState={{ selected: on, checked: on }}
              onPress={() => onChange(tp.id)}
              style={{
                minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: t.radius.rb,
                borderWidth: on ? 2 : 1, borderColor: on ? t.c.accent : t.c.line,
              }}>
              <View importantForAccessibility="no-hide-descendants" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.topic(tp.colorKey).color }} />
              <T variant="sub" weight="bold" style={{ color: t.c.ink }}>{tp.name}</T>
            </Pressable>
          );
        })}
      </View>
      {error ? <T variant="sub" color="danger" accessibilityRole="alert">{error}</T> : null}
    </View>
  );
}
