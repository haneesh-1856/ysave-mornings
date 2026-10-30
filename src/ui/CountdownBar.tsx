import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { colorMix } from '@/theme/colorMix';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  budgetMs: number;
  remainingMs: number;
  overtimeMs: number;
  variant: 'thin' | 'smooth' | 'seg';
};

const SECTION_MS = 15 * 60_000;
const STRIPE_W = 8;
const MAX_STRIPES = 80;
const TICK_MS = 1000;

/** Fraction of the budget, 0..1. */
function fraction(budgetMs: number, ms: number): number {
  return budgetMs <= 0 ? 0 : Math.min(1, Math.max(0, ms / budgetMs));
}

/** Draining bar. Widths are shared values animated on the UI thread; each 1 Hz prop change glides linearly. */
export function CountdownBar({ budgetMs, remainingMs, overtimeMs, variant }: Props) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const left = fraction(budgetMs, remainingMs);
  const over = fraction(budgetMs, overtimeMs);
  const inOvertime = overtimeMs > 0;
  const leftSv = useSharedValue(left);
  const overSv = useSharedValue(over);

  useEffect(() => {
    if (reduce) {
      leftSv.value = left;
      overSv.value = over;
    } else {
      const cfg = { duration: TICK_MS, easing: Easing.linear };
      leftSv.value = withTiming(left, cfg);
      overSv.value = withTiming(over, cfg);
    }
  }, [left, over, reduce, leftSv, overSv]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${leftSv.value * 100}%` }));
  const overStyle = useAnimatedStyle(() => ({ width: `${overSv.value * 100}%` }));

  const height = variant === 'thin' ? 8 : 46;
  const radius = variant === 'thin' ? 4 : Math.max(8, t.radius.r - 2);
  const sections = Math.max(1, Math.ceil(budgetMs / SECTION_MS));
  const stripeCount = Math.min(MAX_STRIPES, Math.ceil(w / STRIPE_W) + 1);
  const stripeAlt = colorMix(t.c.sun, 55, t.c.surface);

  const minutesLeft = Math.ceil(Math.max(0, remainingMs) / 60_000);
  const valueText = inOvertime ? `${Math.floor(overtimeMs / 60_000)} minutes extra` : `${minutesLeft} minutes left`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Time left"
      accessibilityValue={{ min: 0, max: Math.ceil(budgetMs / 60_000), now: inOvertime ? 0 : minutesLeft, text: valueText }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: inOvertime ? t.c.tint3 : t.c.line }}>
      <Animated.View testID="bar-fill" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: t.c.accent }, fillStyle]} />
      {inOvertime ? (
        <Animated.View testID="bar-overtime" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', flexDirection: 'row' }, overStyle]}>
          {Array.from({ length: stripeCount }, (_, i) => (
            <View
              key={i}
              style={{ width: STRIPE_W, height: '100%', backgroundColor: i % 2 ? stripeAlt : t.c.sun, transform: [{ skewX: '-30deg' }] }}
            />
          ))}
        </Animated.View>
      ) : null}
      {variant === 'seg'
        ? Array.from({ length: sections - 1 }, (_, i) => (
            <View
              key={i}
              testID="bar-gap"
              style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) * SECTION_MS * 100) / budgetMs}%`, width: 3, marginLeft: -1.5, backgroundColor: t.c.bg }}
            />
          ))
        : null}
    </View>
  );
}
