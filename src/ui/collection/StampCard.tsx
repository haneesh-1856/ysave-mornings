import { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame, GoldRing } from './kit';

const spot = (j: number) => ({ x: 18 + (j % 5) * 18.5, y: 26 + Math.floor(j / 5) * 28 });
const SPOTS = Array.from({ length: 10 }, (_, j) => j);

/** Stamp card: ten dashed spots, a stamped check per item, "DAY CLOSED" once closed. Stamps down. */
export function StampCard({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  return (
    <Frame
      art="card" items={items} cap={10} closed={closed} scale={scale} arrival="stamp" animateLast={animateLast} animateLid={animateLid}
      back={
        <>
          <Rect x={4} y={6} width={102} height={72} rx={8} fill={t.c.surface} stroke={t.c.line} />
          {SPOTS.map(j => (
            <Circle key={j} cx={spot(j).x} cy={spot(j).y} r={7.5} fill="none" stroke={t.c.line} strokeDasharray="2 2" />
          ))}
        </>
      }
      decoration={
        <SvgText x={55} y={72} textAnchor="middle" fontSize={8} fontWeight="800" letterSpacing={2} fill={t.c.accent} rotation={-4} origin="55, 72">
          DAY CLOSED
        </SvgText>
      }
      decorationId="card-stamp" decorationAt={{ x: 55, y: 72 }}
      originOf={i => spot(i % 10)}
      overflowAt={{ x: 96, y: 72 }}
      renderItem={(it, i) => {
        const { x, y } = spot(i % 10), r = it.small ? 5.5 : 7.5;
        return (
          <>
            <Circle cx={x} cy={y} r={r} fill={t.topic(it.colorKey).color} opacity={0.92} />
            <Path d={`M${x - 2.6} ${y} l1.8 2 l3.6 -4`} fill="none" stroke={t.c.surface} strokeWidth={1.5} strokeLinecap="round" />
            {it.gold ? <GoldRing x={x} y={y} r={r + 2.5} sun={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
