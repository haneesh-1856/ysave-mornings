import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import { Card } from './Card';
import { T } from './T';

type Props = { dayName: string; dayNumber: number };

/** Morning's "A fresh page": a soft sunrise over a pale sky, the weekday and the day count. */
export function SunriseCard({ dayName, dayNumber }: Props) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }} accessible accessibilityLabel={`A fresh page. ${dayName}, day ${dayNumber}`}>
        <Svg width={160} height={80} viewBox="0 0 160 80" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.c.sun} stopOpacity={0.05} />
              <Stop offset="1" stopColor={t.c.sun} stopOpacity={0.3} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={160} height={80} rx={12} fill="url(#sky)" />
          <G>
            <Circle cx={80} cy={62} r={44} fill={t.glow.fill} />
            <Path d="M52 62 a28 28 0 0 1 56 0 Z" fill={t.c.sun} />
          </G>
          <Rect x={0} y={62} width={160} height={18} fill={t.c.surface} fillOpacity={0.85} />
          <Path d="M0 62 H160" stroke={t.c.line} strokeWidth={1.5} />
        </Svg>
        <T variant="title">A fresh page</T>
        <T variant="sub">{`${dayName} · Day ${dayNumber}`}</T>
      </View>
    </Card>
  );
}
