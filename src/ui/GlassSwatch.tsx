import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colorMix, withAlpha } from '@/theme/colorMix';
import { useTheme } from '@/theme/ThemeProvider';
import type { glassTints } from '@/theme/tokens';

type Tint = (typeof glassTints)[keyof typeof glassTints];

const SIZE = 52;
const POS = [{ cx: 0.15, cy: 0.15 }, { cx: 0.95, cy: 0.55 }, { cx: 0.35, cy: 1.05 }];

/** A glass tint as a 52 pt tile: three glow blobs over the page color with a frosted square on top (prototype `glassSwatch`). */
export function GlassSwatch({ tint }: { tint: Tint }) {
  const t = useTheme();
  const p = t.c as Record<string, string>;
  const resolve = (v: string) => { const m = v.match(/^var\(--p-(\w+)\)$/); return m ? p[m[1]] : v; };
  const pct = (s: string) => parseFloat(s);
  const blobs = tint.b.map(b => colorMix(resolve(b), pct(tint.bs), t.c.bg));
  const frost = withAlpha(colorMix(resolve(tint.tone), pct(tint.tm), t.c.surface), pct(tint.a) / 100);
  const r = Math.max(2, t.radius.r - 2);
  return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: r, overflow: 'hidden', backgroundColor: t.c.bg, borderWidth: 1, borderColor: t.c.line }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          {POS.map((q, i) => (
            <RadialGradient key={i} id={`gs${i}`} cx={q.cx * SIZE} cy={q.cy * SIZE} r={SIZE * 0.65} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={blobs[i]} stopOpacity={1} />
              <Stop offset="1" stopColor={blobs[i]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {POS.map((_, i) => <Rect key={i} width={SIZE} height={SIZE} fill={`url(#gs${i})`} />)}
      </Svg>
      <View style={{ position: 'absolute', top: 13, left: 13, right: 13, bottom: 13, borderRadius: Math.max(2, r - 6), backgroundColor: frost, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' }} />
    </View>
  );
}
