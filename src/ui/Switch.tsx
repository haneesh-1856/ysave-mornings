import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';
import { useMotion } from './useMotion';

type Props = { value: boolean; onChange: (v: boolean) => void; label: string };

const W = 46, H = 28, KNOB = 22;

/** Label + toggle; the whole row is the 44 pt target. */
export function Switch({ value, onChange, label }: Props) {
  const t = useTheme();
  const { animate } = useMotion();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = animate(value ? 1 : 0);
  }, [value, animate, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (W - KNOB - 6) }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <T style={{ flex: 1 }}>{label}</T>
      <View style={{ width: W, height: H, borderRadius: H / 2, backgroundColor: value ? t.c.accent : t.c.line, justifyContent: 'center', paddingHorizontal: 3 }}>
        <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: value ? t.c.on : t.c.surface }, knob]} />
      </View>
    </Pressable>
  );
}
