import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import type { CollectionItem } from '@/domain/collection';
import type { LookMix } from '@/theme/look';
import { useTheme } from '@/theme/ThemeProvider';

import { collectionNoun, unitNoun } from '../collectionNoun';
import { useMotion } from '../useMotion';
import { lastItemKey } from './jarLayout';

// Shared by every collection renderer: the arrival animation, the closed decoration, the item cap, the label,
// and `Frame` (the SVG + overlay layout the non-jar looks use).

export type Arrival = 'drop' | 'grow' | 'pop' | 'stamp' | 'flicker';

const DROP_FROM = 70; // viewBox units above rest
const VB_H = 98; // every viewBox is `0 -12 <w> 98`
const VB_W = 110; // the non-jar looks

/** Where the viewBox sits inside a `vw * scale` x `96 * scale` view (xMidYMid meet), and a mapper from viewBox points to pt offsets from the view centre. */
export function viewMetrics(vw: number, scale: number) {
  const W = vw * scale, H = 96 * scale;
  const s = Math.min(W / vw, H / VB_H);
  return {
    W, H, s,
    toPt: (x: number, y: number) => ({ x: (W - vw * s) / 2 + x * s - W / 2, y: (H - VB_H * s) / 2 + (y + 12) * s - H / 2 }),
  };
}

type Pt = { x: number; y: number };

/**
 * Style for the newest item's overlay. Plays once per new `lastKey` (and once on mount), never on a plain re-render;
 * instant under Reduce Motion. `origin` (pt from the view centre) is the point grow/pop/stamp scale about.
 */
export function useArrival(kind: Arrival, lastKey: string | null, enabled: boolean, scale: number, origin: Pt = { x: 0, y: 0 }) {
  const { animate, reduce } = useMotion();
  const p = useSharedValue(1); // 0 = just arrived, 1 = at rest
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || lastKey === null || played.current === lastKey) return;
    played.current = lastKey;
    if (reduce) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = animate(1);
    // `animate` is not a trigger; lastKey is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, enabled]);
  const { x: ox, y: oy } = origin;
  return useAnimatedStyle(() => {
    const v = p.value;
    if (kind === 'drop') return { transform: [{ translateY: -DROP_FROM * scale * (1 - v) }] };
    if (kind === 'flicker') return { opacity: interpolate(v, [0, 0.3, 0.55, 1], [0, 1, 0.3, 1], Extrapolation.CLAMP) };
    const k = kind === 'grow' ? v
      : kind === 'pop' ? interpolate(v, [0, 0.6, 1], [0, 1.35, 1], Extrapolation.CLAMP)
        : interpolate(v, [0, 0.6, 1], [2.2, 0.92, 1], Extrapolation.CLAMP);
    return {
      opacity: kind === 'stamp' ? interpolate(v, [0, 0.3], [0, 1], Extrapolation.CLAMP) : 1,
      transform: [{ translateX: ox }, { translateY: oy }, { scale: k }, { translateX: -ox }, { translateY: -oy }],
    };
  });
}

/**
 * Closed decoration progress 0 (open) .. 1 (closed). Starts from the first `closed` value, so mounting closed never plays;
 * only a later false -> true flip animates it in (reopening is instant).
 */
export function useClosedDecoration(closed: boolean, enabled: boolean): SharedValue<number> {
  const { animate, reduce } = useMotion();
  const p = useSharedValue(closed ? 1 : 0);
  const was = useRef(closed);
  useEffect(() => {
    if (was.current === closed) return;
    was.current = closed;
    if (!enabled) {
      p.value = closed ? 1 : 0; // keep in step so enabling the prop later can't show the wrong decoration
      return;
    }
    p.value = closed && !reduce ? animate(1) : closed ? 1 : 0;
    // `animate`/`reduce` are not triggers; `closed` is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed, enabled]);
  return p;
}

/** The first `cap` items are drawn (oldest first); the rest become a "+N". */
export function capOf(items: readonly CollectionItem[], cap: number): { shown: CollectionItem[]; overflow: number } {
  return { shown: items.slice(0, cap), overflow: Math.max(0, items.length - cap) };
}

/** "Garden with 3 flowers, closed". */
export function collectionLabel(art: LookMix['art'], n: number, closed: boolean): string {
  const noun = collectionNoun(art);
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} with ${n} ${unitNoun(art, n)}${closed ? ', closed' : ''}`;
}

type FrameProps = {
  art: LookMix['art'];
  items: CollectionItem[];
  cap: number;
  closed: boolean;
  scale: number;
  arrival: Arrival;
  animateLast: boolean;
  animateLid: boolean;
  /** Drawn first (ground, string, pot ...). */
  back?: ReactNode;
  /** Drawn once the day is closed (moon, clasp, bloom); fades and scales in when `animateLid`. */
  decoration: ReactNode;
  decorationId: string;
  /** ViewBox point the decoration scales about. */
  decorationAt: Pt;
  renderItem: (item: CollectionItem, i: number) => ReactNode;
  /** ViewBox point the newest item scales about (grow: its base). */
  originOf: (i: number) => Pt;
  overflowAt: Pt;
};

/** A 110 x 96 pt drawing: back layer, items (the newest in its own overlay), closed decoration, "+N". */
export function Frame(p: FrameProps) {
  const t = useTheme();
  const { shown, overflow } = capOf(p.items, p.cap);
  const m = viewMetrics(VB_W, p.scale);
  const viewBox = `0 -12 ${VB_W} ${VB_H}`;
  const lastIndex = p.animateLast && overflow === 0 && shown.length > 0 ? shown.length - 1 : -1;
  const o = p.originOf(Math.max(0, shown.length - 1));
  const arrival = useArrival(p.arrival, lastItemKey(p.items), p.animateLast, p.scale, m.toPt(o.x, o.y));
  const deco = useClosedDecoration(p.closed, p.animateLid);
  const at = m.toPt(p.decorationAt.x, p.decorationAt.y);
  const decoStyle = useAnimatedStyle(() => ({
    opacity: deco.value,
    transform: [{ translateX: at.x }, { translateY: at.y }, { scale: 0.5 + 0.5 * deco.value }, { translateX: -at.x }, { translateY: -at.y }],
  }));
  const fill = { position: 'absolute', left: 0, top: 0, width: m.W, height: m.H } as const;
  const decoration = p.closed ? <G testID={p.decorationId}>{p.decoration}</G> : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={collectionLabel(p.art, p.items.length, p.closed)} style={{ width: m.W, height: m.H }}>
      <Svg width={m.W} height={m.H} viewBox={viewBox}>
        {p.back}
        {p.animateLid ? null : decoration}
        {shown.map((it, i) => (i === lastIndex ? null : <G key={i} testID={`item-${i}`}>{p.renderItem(it, i)}</G>))}
        {overflow > 0 ? (
          <SvgText testID={`${p.art}-overflow`} x={p.overflowAt.x} y={p.overflowAt.y} fontSize={9} fontWeight="bold" fill={t.c.ink} textAnchor="middle">
            {`+${overflow}`}
          </SvgText>
        ) : null}
      </Svg>
      {p.animateLid ? (
        // Its own overlay so a plain Animated.View transform fades it in (no animated SVG props).
        <Animated.View pointerEvents="none" style={[fill, decoStyle]}>
          <Svg width={m.W} height={m.H} viewBox={viewBox}>{decoration}</Svg>
        </Animated.View>
      ) : null}
      {lastIndex >= 0 ? (
        <Animated.View pointerEvents="none" style={[fill, arrival]}>
          <Svg width={m.W} height={m.H} viewBox={viewBox}>
            <G testID={`item-${lastIndex}`}>{p.renderItem(shown[lastIndex], lastIndex)}</G>
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The dashed sun ring that marks a gold (overtime) item. */
export function GoldRing({ x, y, r, sun }: { x: number; y: number; r: number; sun: string }) {
  return <Circle testID="gold-ring" cx={x} cy={y} r={r} fill="none" stroke={sun} strokeWidth={1.6} strokeDasharray="3 2" />;
}
