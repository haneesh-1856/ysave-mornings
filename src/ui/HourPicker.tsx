import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { hourText } from './dayNames';
import { T } from './T';

type Props = { value: number; onChange: (hour: number) => void; locale?: string };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** 24 choices ("12:00 AM" ... "11:00 PM") for when the day starts; one is selected. A grid of 44 pt radios. */
export function HourPicker({ value, onChange, locale }: Props) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Hour the day starts" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {HOURS.map(h => {
        const on = h === value;
        const text = hourText(h, locale);
        return (
          <Pressable
            key={h}
            accessibilityRole="radio"
            accessibilityLabel={text}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(h)}
            style={{
              width: '23%', flexGrow: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
              borderRadius: t.radius.rb, borderWidth: 1, borderColor: on ? t.c.accent : t.c.line,
              backgroundColor: on ? t.c.accent : t.c.surface,
            }}>
            <T importantForAccessibility="no" weight="bold" style={{ color: on ? t.c.on : t.c.ink }}>{text}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
