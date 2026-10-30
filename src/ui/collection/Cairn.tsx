import { Ellipse, Line } from 'react-native-svg';

import type { CollectionItem } from '@/domain/collection';
import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { capOf, Frame } from './kit';

const BASE = 84; // ground line
const ROOM = BASE + 5; // stack height that keeps the top stone inside the viewBox (which starts at y = -12)

/** Stones from the ground up. Heights are the prototype's, squeezed by one factor only if the stack would leave the viewBox. */
function stack(items: readonly CollectionItem[]) {
  const raw = items.map(it => ({ it, h: it.small ? 4.5 : 6.5 }));
  const f = Math.min(1, ROOM / Math.max(1, raw.reduce((s, r) => s + 2 * r.h, 0)));
  let y = BASE;
  const stones = raw.map(({ it, h }, i) => {
    const hh = h * f, w = Math.max(12, (it.small ? 26 : 46) - i * 3.5);
    y -= hh;
    const cy = y;
    y -= hh;
    return { w, h: hh, cx: 55 + ((i * 37) % 7) - 3, cy };
  });
  return { stones, top: y };
}

/** Cairn: a stone per item, stacked and narrowing; closing sets the accent top stone. Drops in. */
export function Cairn({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  const { stones, top } = stack(capOf(items, 9).shown);
  return (
    <Frame
      art="cairn" items={items} cap={9} closed={closed} scale={scale} arrival="drop" animateLast={animateLast} animateLid={animateLid}
      back={<Line x1={14} y1={BASE} x2={96} y2={BASE} stroke={t.c.line} strokeWidth={3} strokeLinecap="round" />}
      decoration={<Ellipse cx={55} cy={top - 3} rx={6} ry={4} fill={t.c.accent} />}
      decorationId="cairn-top" decorationAt={{ x: 55, y: top - 3 }}
      originOf={i => ({ x: stones[i]?.cx ?? 55, y: stones[i]?.cy ?? BASE })}
      overflowAt={{ x: 96, y: 60 }}
      renderItem={(it, i) => {
        const { w, h, cx, cy } = stones[i];
        return (
          <>
            <Ellipse cx={cx} cy={cy} rx={w / 2} ry={h} fill={t.topic(it.colorKey).color} />
            <Ellipse cx={cx - w * 0.15} cy={cy - h * 0.35} rx={w * 0.2} ry={h * 0.25} fill="#fff" opacity={0.35} />
            {it.gold ? (
              <Ellipse testID={`gold-${i}`} cx={cx} cy={cy} rx={w / 2 + 2.5} ry={h + 2.5} fill="none" stroke={t.c.sun} strokeWidth={1.4} strokeDasharray="3 2" />
            ) : null}
          </>
        );
      }}
    />
  );
}
