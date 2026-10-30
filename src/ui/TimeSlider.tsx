import { useState } from 'react';
import { Pressable, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number };

const THUMB = 22;
const HIT_H = 44;

/** Position (0..width) on the track -> value snapped to `step` from `min`, clamped to [min, max]. */
export function valueFromX(x: number, width: number, min: number, max: number, step: number): number {
  if (width <= 0) return min;
  const frac = Math.min(1, Math.max(0, x / width));
  const snapped = min + Math.round(((max - min) * frac) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * Minutes slider. Drag = pan gesture (horizontal only, so vertical scrolling of the page still works);
 * tap = jump to that spot. Screen readers get `adjustable` with increment/decrement in `step`s.
 * Needs the app-root GestureHandlerRootView (src/app/_layout.tsx); tests get one from renderThemed.
 */
export function TimeSlider({ value, onChange, min = 5, max = 180, step = 5 }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const clamped = Math.min(max, Math.max(min, value));
  const frac = max > min ? (clamped - min) / (max - min) : 0;

  const emit = (v: number) => {
    if (v !== value) onChange(v);
  };
  const adjust = (dir: 1 | -1) => emit(Math.min(max, Math.max(min, clamped + dir * step)));

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onUpdate: e => emit(valueFromX(e.x, width, min, max, step)),
  });

  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T variant="label">Time</T>
        <T weight="bold">{`${clamped} min`}</T>
      </View>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Minutes"
          accessibilityValue={{ min, max, now: clamped, text: `${clamped} min` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e: AccessibilityActionEvent) => {
            if (e.nativeEvent.actionName === 'increment') adjust(1);
            else if (e.nativeEvent.actionName === 'decrement') adjust(-1);
          }}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={{ height: HIT_H, justifyContent: 'center' }}>
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={e => emit(valueFromX(e.nativeEvent.locationX, width, min, max, step))}
            style={{ height: HIT_H, justifyContent: 'center' }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.c.line }}>
              <View style={{ width: `${frac * 100}%`, height: 6, borderRadius: 3, backgroundColor: t.c.accent }} />
            </View>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: (HIT_H - THUMB) / 2, left: frac * width - THUMB / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
                backgroundColor: t.c.surface, borderWidth: 3, borderColor: t.c.accent,
              }}
            />
          </Pressable>
        </View>
      </GestureDetector>
    </View>
  );
}
