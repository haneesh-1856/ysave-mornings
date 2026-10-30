import { Ellipse, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame } from './kit';

const R = 11;
const ORDER: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1], [2, -1], [1, 1], [-1, 2], [-2, 1], [2, 0],
];
const centre = (i: number) => {
  const [q, r] = ORDER[i % ORDER.length];
  return { x: 55 + R * 1.732 * (q + r / 2), y: 38 + R * 1.5 * r };
};
const hex = (x: number, y: number, r: number) =>
  `M${[0, 1, 2, 3, 4, 5].map(k => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${x + r * Math.cos(a)} ${y + r * Math.sin(a)}`;
  }).join(' L')}Z`;

/** Honeycomb: a hexagon per item growing out from the middle, a bee once closed. Pops in. */
export function Honey({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  return (
    <Frame
      art="honey" items={items} cap={12} closed={closed} scale={scale} arrival="pop" animateLast={animateLast} animateLid={animateLid}
      decoration={
        <>
          <Ellipse cx={96} cy={0} rx={6} ry={4.5} fill={t.c.sun} />
          <Path d="M94 -4 v8 M98 -4 v8" stroke={t.c.ink} strokeWidth={1.4} />
          <Ellipse cx={94} cy={-6} rx={3.2} ry={2} fill={t.c.surface} opacity={0.9} />
        </>
      }
      decorationId="honey-bee" decorationAt={{ x: 96, y: 0 }}
      originOf={centre}
      overflowAt={{ x: 100, y: 84 }}
      renderItem={(it, i) => {
        const { x, y } = centre(i);
        return (
          <>
            <Path d={hex(x, y, R)} fill={t.topic(it.colorKey).color} fillOpacity={it.small ? 0.5 : 1} stroke={t.c.surface} strokeWidth={2} />
            {it.gold ? <Path testID={`gold-${i}`} d={hex(x, y, R - 3.5)} fill="none" stroke={t.c.sun} strokeWidth={1.5} strokeDasharray="3 2" /> : null}
          </>
        );
      }}
    />
  );
}
