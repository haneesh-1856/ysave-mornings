import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

// The three soft color blobs that glow behind the page (the tint, on every surface) (positions from the prototype's .s-glass .screen).
const BLOBS = [
  { cx: '15%', cy: '10%', r: '45%' },
  { cx: '90%', cy: '60%', r: '45%' },
  { cx: '30%', cy: '95%', r: '40%' },
];

export function Background() {
  const t = useTheme();
  const blobs = t.backdrop.blobs;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        {BLOBS.map((b, i) => (
          <RadialGradient key={i} id={`blob${i}`} cx={b.cx} cy={b.cy} r={b.r} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={blobs[i]} stopOpacity={1} />
            <Stop offset="1" stopColor={blobs[i]} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {BLOBS.map((_, i) => (
        <Rect key={i} width="100%" height="100%" fill={`url(#blob${i})`} />
      ))}
    </Svg>
  );
}
