import { BlurTargetView } from 'expo-blur';
import { createContext, useContext, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Background } from './Background';
import { TAB_BAR_SPACE } from './TabBar';

// On Android, a BlurView blurs only what is inside a BlurTargetView it is pointed at. Each screen wraps its
// background in one and hands the ref down, so every glass Card can find it.
type BlurTarget = RefObject<ComponentRef<typeof View> | null>;
const BlurTargetContext = createContext<BlurTarget | null>(null);
export const useBlurTarget = () => useContext(BlurTargetContext);

type Props = {
  children: ReactNode;
  /** Leave room for the bottom tab bar. */
  tabs?: boolean;
  scroll?: boolean;
  /** Pinned below the scrolling content (e.g. the jar dock or a confirm button). */
  footer?: ReactNode;
  contentStyle?: ViewStyle;
};

export function Screen({ children, tabs, scroll = true, footer, contentStyle }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const target = useRef<ComponentRef<typeof View>>(null);
  const bottom = (tabs ? TAB_BAR_SPACE[t.look.nav] : 16) + insets.bottom;
  const pad: ViewStyle = { paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 12 };

  return (
    <BlurTargetContext.Provider value={target}>
      <View style={[styles.fill, { backgroundColor: t.c.bg }]}>
        <BlurTargetView ref={target} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.bg }]} />
          <Background />
        </BlurTargetView>
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[pad, { paddingBottom: footer ? 12 : bottom }, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, pad, { paddingBottom: footer ? 12 : bottom }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={{ paddingHorizontal: 20, paddingBottom: bottom, gap: 10 }}>{footer}</View> : null}
      </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
