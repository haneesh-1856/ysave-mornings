import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { formatMinutes } from './formatMinutes';
import { T } from './T';

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label: string;
};

/** - value + . The value is clamped to [min, max]; the value text is the adjustable element for screen readers. */
export function Stepper({ value, onChange, min = 5, max = 180, step = 5, unit = 'min', label }: Props) {
  const t = useTheme();
  const go = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };
  const btn = (sign: string, delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? 'Decrease' : 'Increase'} ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => go(delta)}
      style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: t.c.line, opacity: disabled ? 0.4 : 1,
      }}>
      <T weight="bold">{sign}</T>
    </Pressable>
  );
  const text = unit === 'min' ? formatMinutes(value) : `${value} ${unit}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {btn('−', -step, value <= min)}
      <T
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => go(e.nativeEvent.actionName === 'increment' ? step : -step)}
        weight="bold"
        style={{ minWidth: 64, textAlign: 'center' }}>
        {text}
      </T>
      {btn('+', step, value >= max)}
    </View>
  );
}
