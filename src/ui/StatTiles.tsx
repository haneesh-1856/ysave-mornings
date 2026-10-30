import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Card } from './Card';
import { T } from './T';

type Props = { tiles: { value: string; label: string }[] };

/** A row of equal number tiles (Profile: days you showed up, focused, marbles). */
export function StatTiles({ tiles }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {tiles.map(tile => (
        <View key={tile.label} accessible accessibilityLabel={`${tile.value} ${tile.label}`} style={{ flex: 1 }}>
          <Card radius={Math.max(t.radius.r - 4, 6)} style={{ paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center' }}>
            <T importantForAccessibility="no" weight="extrabold" style={{ fontSize: 22, lineHeight: 28, textAlign: 'center' }}>{tile.value}</T>
            <T importantForAccessibility="no" variant="sub" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{tile.label}</T>
          </Card>
        </View>
      ))}
    </View>
  );
}
