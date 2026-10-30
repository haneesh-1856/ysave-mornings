import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

/** Explains the glow under the month grid. */
export function CalendarLegend() {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel="Glowing days: everything you planned got done" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
      <View
        importantForAccessibility="no"
        style={{ width: 14, height: 14, borderRadius: 5, backgroundColor: t.glow.fill, borderWidth: 1, borderColor: t.glow.ring, shadowColor: t.c.sun, shadowOpacity: 0.6, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }}
      />
      <T variant="sub" importantForAccessibility="no">Glowing days: everything you planned got done</T>
    </View>
  );
}
