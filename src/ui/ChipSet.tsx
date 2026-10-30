import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
  /** Names the group for screen readers (e.g. "When"). */
  label: string;
  /** Tapping the selected chip clears it (default). `false`: it stays selected and no "double tap to clear" hint is spoken. */
  clearable?: boolean;
};

/** Single-choice chips. By default tapping the selected chip again clears the choice. */
export function ChipSet({ options, value, onChange, label, clearable = true }: Props) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityLabel={o}
            accessibilityState={{ selected: on, checked: on }}
            accessibilityHint={on && clearable ? 'Double tap to clear' : undefined}
            onPress={() => onChange(on && clearable ? null : o)}
            style={{
              minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: t.radius.rb,
              borderWidth: 1, borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : 'transparent',
            }}>
            <T variant="sub" weight="bold" style={{ color: on ? t.c.on : t.c.ink }}>{on ? `✓ ${o}` : o}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
