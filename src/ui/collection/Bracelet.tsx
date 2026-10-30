import { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame, GoldRing } from './kit';

const CX = 55, CY = 40, R = 34;
const pt = (deg: number) => ({ x: CX + R * Math.cos((deg * Math.PI) / 180), y: CY + R * Math.sin((deg * Math.PI) / 180) });
const beadAt = (i: number) => pt(-66 + (i % 12) * 28);

/** Bracelet: beads around an open string; closing joins the ring and adds a clasp. Drops in. */
export function Bracelet({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  const a = pt(-80), b = pt(-100);
  return (
    <Frame
      art="bracelet" items={items} cap={12} closed={closed} scale={scale} arrival="drop" animateLast={animateLast} animateLid={animateLid}
      back={<Path d={`M${a.x} ${a.y} A${R} ${R} 0 1 1 ${b.x} ${b.y}`} fill="none" stroke={t.c.muted} strokeWidth={1.4} />}
      decoration={
        <>
          <Circle cx={CX} cy={CY} r={R} fill="none" stroke={t.c.muted} strokeWidth={1.4} />
          <Rect x={CX - 5} y={CY - R - 4} width={10} height={8} rx={2} fill={t.c.accent} />
        </>
      }
      decorationId="bracelet-clasp" decorationAt={{ x: CX, y: CY - R }}
      originOf={beadAt}
      overflowAt={{ x: CX, y: CY + 3 }}
      renderItem={(it, i) => {
        const { x, y } = beadAt(i), r = it.small ? 4.6 : 7;
        return (
          <>
            <Circle cx={x} cy={y} r={r} fill={t.topic(it.colorKey).color} />
            <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill="#fff" opacity={0.65} />
            {it.gold ? <GoldRing x={x} y={y} r={r + 2.5} sun={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
