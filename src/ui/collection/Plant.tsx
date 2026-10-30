import { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame } from './kit';

const PETALS = [0, 72, 144, 216, 288];
const sideOf = (i: number) => (i % 2 ? 1 : -1);
const leafAt = (i: number, small: boolean) => ({ x: 55 + sideOf(i) * (small ? 6 : 9), y: 62 - i * 8 });

/** Plant: a pot and a stem that grows taller with each item, a leaf per item, a sun-colored bloom once closed. Grows from the base. */
export function Plant({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  const n = Math.max(1, Math.min(items.length, 8));
  const top = 66 - n * 8;
  const k = 68 - top;
  return (
    <Frame
      art="plant" items={items} cap={8} closed={closed} scale={scale} arrival="grow" animateLast={animateLast} animateLid={animateLid}
      back={
        <>
          <Path d="M41 70 h28 l-4 16 h-20z" fill={t.c.tint2} stroke={t.c.muted} />
          <Rect x={39} y={66} width={32} height={6} rx={2} fill={t.c.tint2} stroke={t.c.muted} />
          <Path d={`M55 68 C52 ${68 - k * 0.4} 58 ${68 - k * 0.7} 55 ${top}`} fill="none" stroke={t.c.accent} strokeWidth={2.2} strokeLinecap="round" />
        </>
      }
      decoration={
        <>
          {PETALS.map(a => (
            <Circle key={a} cx={55 + 4.5 * Math.sin((a * Math.PI) / 180)} cy={top - 5 - 4.5 * Math.cos((a * Math.PI) / 180)} r={3.6} fill={t.c.sun} />
          ))}
          <Circle cx={55} cy={top - 5} r={2.4} fill={t.c.surface} />
        </>
      }
      decorationId="plant-bloom" decorationAt={{ x: 55, y: top - 5 }}
      originOf={() => ({ x: 55, y: 68 })}
      overflowAt={{ x: 92, y: 40 }}
      renderItem={(it, i) => {
        const side = sideOf(i), { x, y } = leafAt(i, it.small), rx = it.small ? 5 : 8.5, ry = it.small ? 2.8 : 4;
        return (
          <>
            <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill={t.topic(it.colorKey).color} rotation={side * -28} origin={`${x}, ${y}`} />
            {it.gold ? <Circle testID={`gold-${i}`} cx={x + side * rx * 0.8} cy={y - 3} r={2.2} fill={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
