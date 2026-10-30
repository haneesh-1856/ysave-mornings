import type { CollectionItem } from '@/domain/collection';
import type { ColorKey } from '@/domain/types';

// Pure geometry for the glass jar, in the prototype's SVG units (viewBox "0 -12 70 98").
// Ported from `jarSVG` in drafts/ysave-style-lab.html.

export const JAR_VIEWBOX = '0 -12 70 98';
export const JAR_W = 70;
export const JAR_H = 96;
export const JAR_PATH =
  'M15 14 h40 v4 c7 4 9 10 9 18 v36 a12 12 0 0 1 -12 12 h-34 a12 12 0 0 1 -12 -12 v-36 c0 -8 2 -14 9 -18z';

export const FULL_R = 7;
export const SMALL_R = 4.6;
/** Gold ring radius for a full-size marble. */
export const GOLD_R = 9.6;

/** The prototype's eight resting spots (x, y) for full-size marbles. */
const SPOTS: readonly (readonly [number, number])[] = [
  [20, 72], [35, 73], [50, 72], [27, 59], [42, 59], [34, 46], [20, 46], [49, 46],
];

// Usable interior for the packed (overflow) layout.
const X_MIN = 13, X_MAX = 57, Y_BOTTOM = 79, Y_TOP = 26;
const MIN_R = 2.5;

export interface Marble {
  index: number;
  x: number;
  y: number;
  r: number;
  /** Radius of the gold ring (only meaningful when `gold`). */
  ringR: number;
  colorKey: ColorKey;
  gold: boolean;
  small: boolean;
}

export interface JarLayout {
  marbles: Marble[];
  /** Items that did not fit even at the smallest size; the renderer shows "+N". */
  overflow: number;
}

/** Packed rows from the bottom for a full-size radius `r`; returns the slot centres for a full-size marble. */
function packedSlots(r: number): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = [];
  const d = 2 * r + 0.4;
  for (let row = 0; ; row++) {
    const y = Y_BOTTOM - r - row * r * 1.75;
    if (y - r < Y_TOP) break;
    const offset = row % 2 === 1 ? r : 0;
    for (let x = X_MIN + r + offset; x <= X_MAX - r + 1e-6; x += d) slots.push({ x, y });
  }
  return slots;
}

/**
 * Where each marble goes.
 *
 * - Up to 8 items: the prototype's exact spots, full size (small items have radius 4.6 and rest on the same baseline).
 * - 9 or more: the largest uniform scale (7 down to 2.5, step 0.5) whose packed rows hold every item.
 * - Beyond what fits at the smallest scale: only the first `capacity` items (oldest first) are drawn and
 *   `overflow` counts the rest, shown as "+N". The jar never grows past its glass.
 *
 * Marble i is always the i-th item, so stacking order = item order (earlier = lower in the jar).
 */
export function layoutJar(items: readonly CollectionItem[]): JarLayout {
  const n = items.length;
  const make = (it: CollectionItem, index: number, x: number, yRest: number, s: number): Marble => {
    const r = (it.small ? SMALL_R : FULL_R) * s;
    // yRest is the centre of a full-size marble; smaller marbles keep resting on the same baseline.
    return { index, x, y: yRest + (FULL_R * s - r), r, ringR: GOLD_R * s, colorKey: it.colorKey, gold: it.gold, small: it.small };
  };

  if (n <= SPOTS.length) {
    return { marbles: items.map((it, i) => make(it, i, SPOTS[i][0], SPOTS[i][1], 1)), overflow: 0 };
  }

  let rFull = FULL_R;
  let slots = packedSlots(rFull);
  while (slots.length < n && rFull > MIN_R) {
    rFull -= 0.5;
    slots = packedSlots(rFull);
  }
  const s = rFull / FULL_R;
  const shown = Math.min(n, slots.length);
  return {
    marbles: items.slice(0, shown).map((it, i) => make(it, i, slots[i].x, slots[i].y, s)),
    overflow: n - shown,
  };
}

/** Stable identity for the newest item, used to decide whether the drop animation should play. */
export function lastItemKey(items: readonly CollectionItem[]): string | null {
  const last = items[items.length - 1];
  return last ? `${items.length}:${last.dayTaskId ?? last.kind}:${last.at}` : null;
}
