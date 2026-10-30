import { Text, type TextProps } from 'react-native';

import type { ColorName } from '@/theme/buildTheme';
import type { Weight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

// Type scale: the prototype's 300px-phone sizes × 1.25 (docs/05-screens-and-navigation.md).
const VARIANTS = {
  title: { fontSize: 25, lineHeight: 30, letterSpacing: -0.5, weight: 'bold', color: 'ink' },
  body: { fontSize: 16, lineHeight: 22, letterSpacing: 0, weight: 'semibold', color: 'ink' },
  sub: { fontSize: 13, lineHeight: 18, letterSpacing: 0, weight: 'medium', color: 'muted' },
  label: { fontSize: 11.5, lineHeight: 14, letterSpacing: 1, weight: 'bold', color: 'muted' },
  big: { fontSize: 70, lineHeight: 74, letterSpacing: -2.5, weight: 'extrabold', color: 'ink' },
} as const satisfies Record<string, { fontSize: number; lineHeight: number; letterSpacing: number; weight: Weight; color: ColorName }>;

type Props = TextProps & { variant?: keyof typeof VARIANTS; weight?: Weight; color?: ColorName };

export function T({ variant = 'body', weight, color, style, children, ...rest }: Props) {
  const t = useTheme();
  const v = VARIANTS[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: t.font[weight ?? v.weight],
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing,
          color: t.c[color ?? v.color],
          fontVariant: ['tabular-nums'],
          textTransform: variant === 'label' ? 'uppercase' : undefined,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}
