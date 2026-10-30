import { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { Frame } from './kit';

const PETALS = [0, 72, 144, 216, 288];
const flowerX = (i: number) => 14 + i * 14 + (i % 2) * 2;
const stemH = (i: number, small: boolean) => (28 + ((i * 7) % 16)) * (small ? 0.6 : 1);

/** Garden: a flower per item along the soil (stem, five petals, centre; gold adds a dashed ring), a moon once closed. Grows from the base. */
export function Garden({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  return (
    <Frame
      art="garden" items={items} cap={7} closed={closed} scale={scale} arrival="grow" animateLast={animateLast} animateLid={animateLid}
      back={<Rect x={2} y={80} width={106} height={6} rx={3} fill={t.c.tint3} />}
      decoration={<><Circle cx={96} cy={10} r={7} fill={t.c.sun} /><Circle cx={99} cy={8} r={6} fill={t.c.bg} /></>}
      decorationId="garden-moon" decorationAt={{ x: 96, y: 10 }}
      originOf={i => ({ x: flowerX(i), y: 80 })}
      overflowAt={{ x: 20, y: 6 }}
      renderItem={(it, i) => {
        const c = t.topic(it.colorKey).color;
        const x = flowerX(i), h = stemH(i, it.small), po = it.small ? 4 : 5.5, pr = it.small ? 3 : 4.2;
        return (
          <>
            <Path d={`M${x} 80 q${i % 2 ? 3 : -3} ${-h / 2} 0 ${-h}`} fill="none" stroke={t.c.accent} strokeWidth={2} />
            {PETALS.map(a => (
              <Circle key={a} cx={x + po * Math.sin((a * Math.PI) / 180)} cy={80 - h - po * Math.cos((a * Math.PI) / 180)} r={pr} fill={c} />
            ))}
            <Circle cx={x} cy={80 - h} r={2.6} fill={it.gold ? t.c.sun : t.c.surface} />
            {it.gold ? <Circle testID={`gold-${i}`} cx={x} cy={80 - h} r={10} fill="none" stroke={t.c.sun} strokeWidth={1.5} strokeDasharray="2 2" /> : null}
          </>
        );
      }}
    />
  );
}
