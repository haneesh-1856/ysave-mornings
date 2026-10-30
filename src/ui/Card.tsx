import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { useBlurTarget } from './Screen';

type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number };

/** A surface in the current look: flat lines, soft shadow, bold outline, or frosted glass. */
export function Card({ children, style, radius }: Props) {
  const t = useTheme();
  const target = useBlurTarget();
  const r = radius ?? t.radius.r;

  return (
    <View style={style ? [styles.wrap, flattenOuter(style)] : styles.wrap}>
      {t.hardShadow ? (
        <View style={[StyleSheet.absoluteFill, { top: 3, left: 3, right: -3, bottom: -3, borderRadius: r, backgroundColor: t.hardShadow }]} />
      ) : null}
      <View style={[{ borderRadius: r, overflow: t.glass ? 'hidden' : 'visible' }, t.card, styles.pad, flattenInner(style)]}>
        {t.glass?.blur ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={t.glass.intensity}
            blurTarget={target ?? undefined}
            blurMethod="dimezisBlurViewSdk31Plus"
          />
        ) : null}
        {t.glass ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glass.frost }]} /> : null}
        {children}
      </View>
    </View>
  );
}

// Margins and flex sizing belong to the outer wrapper (which also holds the hard shadow); everything else to the surface.
const OUTER_KEYS = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'flex', 'alignSelf', 'width'] as const;
function split(style: StyleProp<ViewStyle>) {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: ViewStyle = {}, inner: ViewStyle = {};
  for (const [k, v] of Object.entries(flat)) ((OUTER_KEYS as readonly string[]).includes(k) ? outer : inner)[k as never] = v as never;
  return { outer, inner };
}
const flattenOuter = (s: StyleProp<ViewStyle>) => split(s).outer;
const flattenInner = (s: StyleProp<ViewStyle>) => split(s).inner;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  pad: { paddingVertical: 12, paddingHorizontal: 15 },
});
