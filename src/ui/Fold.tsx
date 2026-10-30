import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { ColorKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';
import { useMotion } from './useMotion';

type Props = {
  title: string;
  colorKey: ColorKey;
  subtitle?: string;
  /** Sits beside the header button (e.g. dots and "⋯"); it is not part of the toggle. */
  right?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
};

/** Topic accordion: a tinted fold whose body (a surface-colored inset) animates its height. */
export function Fold({ title, colorKey, subtitle, right, open, onToggle, children }: Props) {
  const t = useTheme();
  const { animate } = useMotion();
  const tone = t.topic(colorKey);
  const progress = useSharedValue(open ? 1 : 0);
  const natural = useSharedValue(0);

  useEffect(() => {
    progress.value = animate(open ? 1 : 0);
  }, [open, animate, progress]);

  // Natural height follows the content (cards flip, rows are added); only open/close is animated.
  const bodyStyle = useAnimatedStyle(() => ({ height: natural.value * progress.value, opacity: progress.value }));

  return (
    <View style={{ borderRadius: t.radius.r, backgroundColor: tone.fold, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          style={({ pressed }) => ({ flex: 1, minHeight: 48, justifyContent: 'center', paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T weight="bold" numberOfLines={1}>{title}</T>
              {subtitle ? <T variant="sub">{subtitle}</T> : null}
            </View>
            <T variant="sub" accessible={false}>{open ? '▴' : '▾'}</T>
          </View>
        </Pressable>
        {right}
      </View>
      <Animated.View
        style={[{ overflow: 'hidden' }, bodyStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
        <View
          style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
          onLayout={e => {
            natural.value = e.nativeEvent.layout.height;
          }}>
          <View style={{ backgroundColor: t.c.surface, marginHorizontal: 5, marginBottom: 5, borderRadius: Math.max(t.radius.r - 5, 2), paddingHorizontal: 10 }}>
            {children}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
