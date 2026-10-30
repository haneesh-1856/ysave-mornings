import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

/** Pick one of a few options (e.g. Timed / Checklist). The selected one is filled; selection is also exposed to screen readers. */
export function Segmented({ options, value, onChange }: Props) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', borderRadius: t.radius.rb, borderWidth: 1, borderColor: t.c.line, backgroundColor: t.c.bg, padding: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.rb, backgroundColor: on ? t.c.accent : 'transparent', paddingHorizontal: 8 }}>
            <T weight="bold" style={{ color: on ? t.c.on : t.c.ink, textAlign: 'center' }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
