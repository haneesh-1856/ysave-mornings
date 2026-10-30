import { Path, Rect } from 'react-native-svg';

import type { CollectionItem } from '@/domain/collection';
import { useTheme } from '@/theme/ThemeProvider';

import type { CollectionProps } from './Jar';
import { capOf, Frame } from './kit';

const START = 12, BASE = 82;
const ROOM = 79; // widths + gaps that leave the bookend (13 wide) on the shelf, which ends at x = 104

/** Book spines left to right. Widths are the prototype's, squeezed by one factor only if the row would run off the shelf. */
function row(items: readonly CollectionItem[]) {
  const f = Math.min(1, ROOM / Math.max(1, items.reduce((s, it) => s + (it.small ? 6 : 10) + 1.5, 0)));
  let x = START;
  const books = items.map((it, i) => {
    const w = (it.small ? 6 : 10) * f, h = it.small ? 30 : 42 + ((i * 13) % 14);
    const book = { x, w, h };
    x += w + 1.5 * f;
    return book;
  });
  return { books, end: x };
}

/** Shelf: a book per item standing on a shelf, a bookend once closed. Drops in. */
export function Shelf({ items, closed, scale = 1, animateLast = false, animateLid = false }: CollectionProps) {
  const t = useTheme();
  const { books, end } = row(capOf(items, 8).shown);
  return (
    <Frame
      art="shelf" items={items} cap={8} closed={closed} scale={scale} arrival="drop" animateLast={animateLast} animateLid={animateLid}
      back={<Rect x={6} y={BASE} width={98} height={4} rx={1.5} fill={t.c.muted} />}
      decoration={<Path d={`M${end + 1} ${BASE} v-26 h3 v23 h9 v3z`} fill={t.c.accent} />}
      decorationId="shelf-bookend" decorationAt={{ x: end + 7, y: BASE - 13 }}
      originOf={i => ({ x: (books[i]?.x ?? START) + (books[i]?.w ?? 0) / 2, y: BASE })}
      overflowAt={{ x: 96, y: 20 }}
      renderItem={(it, i) => {
        const { x, w, h } = books[i];
        return (
          <>
            <Rect x={x} y={BASE - h} width={w} height={h} rx={1.5} fill={t.topic(it.colorKey).color} />
            <Rect x={x} y={BASE - h + 5} width={w} height={1.5} fill={t.c.surface} opacity={0.6} />
            {it.gold ? <Rect testID={`gold-${i}`} x={x} y={BASE - h + 10} width={w} height={3} fill={t.c.sun} /> : null}
          </>
        );
      }}
    />
  );
}
