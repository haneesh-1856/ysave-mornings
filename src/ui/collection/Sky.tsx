import { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame, GoldRing } from './kit';

const P: readonly (readonly [number, number])[] = [
  [55, 42], [36, 28], [74, 24], [30, 58], [80, 60], [54, 72], [60, 6], [18, 40], [92, 40], [42, 84], [70, 84], [86, 16],
];

const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r}Z`;

/** Sky: a star per item at fixed spots joined by a dotted line, a moon once closed. Pops in. */
export function Sky({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  const pts = items.slice(0, 12).map((_, i) => P[i % P.length]);
  return (
    <Frame
      art="sky" items={items} cap={12} closed={closed} scale={scale} arrival="pop" animateLast={animateLast} animateLid={animateLid}
      back={
        <>
          <Circle cx={55} cy={42} r={48} fill={t.c.tint1} />
          {pts.length > 1 ? (
            <Path d={`M${pts.map(p => p.join(' ')).join(' L')}`} fill="none" stroke={t.c.muted} strokeWidth={0.8} strokeDasharray="2 3" opacity={0.7} />
          ) : null}
        </>
      }
      decoration={<><Circle cx={98} cy={-2} r={7} fill={t.c.sun} /><Circle cx={101} cy={-4} r={6} fill={t.c.bg} /></>}
      decorationId="sky-moon" decorationAt={{ x: 98, y: -2 }}
      originOf={i => ({ x: P[i % P.length][0], y: P[i % P.length][1] })}
      overflowAt={{ x: 100, y: 84 }}
      renderItem={(it, i) => {
        const [x, y] = P[i % P.length], r = it.small ? 5 : 8;
        return (
          <>
            <Path d={sparkle(x, y, r)} fill={t.topic(it.colorKey).color} />
            {it.gold ? <GoldRing x={x} y={y} r={r + 3} sun={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
