import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { withAlpha } from '@/theme/colorMix';
import type { LookMix } from '@/theme/look';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

// Icon paths copied from the prototype (24×24, stroked with currentColor).
const ICON: Record<string, string> = {
  topics: '<rect x="4" y="4" width="16" height="5" rx="2"/><rect x="4" y="11" width="16" height="5" rx="2"/><path d="M6 20h12"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  profile: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4.3-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
};
const LABEL: Record<string, string> = { topics: 'Topics', today: 'Today', calendar: 'Calendar', profile: 'Profile' };
const svg = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] ?? ''}</svg>`;

/** How much room a screen leaves at the bottom for each tab style (safe-area inset is added on top). */
export const TAB_BAR_SPACE: Record<LookMix['nav'], number> = { float: 96, bar: 72, minimal: 60 };

export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  const nav = t.look.nav;
  const r = t.radius.r;

  const container =
    nav === 'float'
      ? { left: 16, right: 16, bottom: insets.bottom + 12, padding: 6, borderRadius: r + 14, backgroundColor: withAlpha(t.c.surface, 0.9), borderWidth: 1, borderColor: t.c.line, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 }
      : nav === 'bar'
        ? { left: 0, right: 0, bottom: 0, paddingTop: 6, paddingHorizontal: 8, paddingBottom: insets.bottom + 6, backgroundColor: t.c.surface, borderTopWidth: 1, borderColor: t.c.line }
        : { left: 0, right: 0, bottom: 0, paddingTop: 8, paddingHorizontal: 28, paddingBottom: insets.bottom + 8, backgroundColor: t.c.bg };

  return (
    <View style={[styles.bar, container]}>
      {state.routes.map((route, i) => {
        const on = i === state.index;
        const color = on ? t.c.accent : t.c.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LABEL[route.name]}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync();
              navigateToTab(route.key);
            }}
            style={[styles.tab, { borderRadius: r + 6 }, on && nav === 'float' ? { backgroundColor: t.selected } : null]}>
            <SvgXml xml={svg(route.name)} width={26} height={26} color={color} />
            {nav === 'minimal' ? (
              <View style={[styles.dot, { backgroundColor: on ? t.c.accent : 'transparent' }]} />
            ) : (
              <T variant="sub" weight="semibold" style={{ fontSize: 11.5, lineHeight: 14, color }}>
                {LABEL[route.name]}
              </T>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-around' },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 8, paddingBottom: 7, minHeight: 48 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
