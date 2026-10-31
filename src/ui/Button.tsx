import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, kind = 'primary', style, disabled, onPress, ...rest }: Props) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'danger' ? t.c.dangerFill : 'transparent';
  const fg = kind === 'primary' ? t.c.on : kind === 'danger' ? '#ffffff' : t.c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={e => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          minHeight: 48, borderRadius: t.radius.rb, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: bg, borderWidth: kind === 'ghost' ? 1.5 : 0, borderColor: t.c.line,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      {...rest}>
      <T weight="bold" style={{ color: fg }}>{label}</T>
    </Pressable>
  );
}
