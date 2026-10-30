import { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame, GoldRing } from './kit';

const BASES = [6, 38, 70];
const P = BASES.flatMap(b => [[15, b + 7.5], [42, b + 7.5], [68, b - 7.5], [95, b - 7.5]] as const);

/** Lights: bulbs on three sagging wires, a moon once closed. Flickers on. */
export function Lights({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  return (
    <Frame
      art="lights" items={items} cap={12} closed={closed} scale={scale} arrival="flicker" animateLast={animateLast} animateLid={animateLid}
      back={BASES.map(b => (
        <Path key={b} d={`M2 ${b} Q28 ${b + 20} 55 ${b} T108 ${b}`} fill="none" stroke={t.c.muted} strokeWidth={1.1} />
      ))}
      decoration={<><Circle cx={100} cy={-4} r={7} fill={t.c.sun} /><Circle cx={103} cy={-6} r={6} fill={t.c.bg} /></>}
      decorationId="lights-moon" decorationAt={{ x: 100, y: -4 }}
      originOf={i => ({ x: P[i % P.length][0], y: P[i % P.length][1] + 9 })}
      overflowAt={{ x: 100, y: 84 }}
      renderItem={(it, i) => {
        const [x, y] = P[i % P.length], r = it.small ? 3.6 : 5, c = t.topic(it.colorKey).color;
        return (
          <>
            <Rect x={x - 2} y={y} width={4} height={4} rx={1} fill={t.c.muted} />
            <Circle cx={x} cy={y + 9} r={r * 2.1} fill={c} opacity={0.22} />
            <Ellipse cx={x} cy={y + 9} rx={r * 0.78} ry={r} fill={c} />
            {it.gold ? <GoldRing x={x} y={y + 9} r={r + 3.5} sun={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
