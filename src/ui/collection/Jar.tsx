import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { CollectionItem } from '@/domain/collection';
import type { Theme } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { useMotion } from '../useMotion';
import { JAR_H, JAR_PATH, JAR_VIEWBOX, JAR_W, lastItemKey, layoutJar, type Marble } from './jarLayout';

export type CollectionProps = {
  items: CollectionItem[];
  closed: boolean;
  /** Scales the whole drawing: 1 = 70 x 96 pt. Today dock ~0.65, Planned ~2.3. */
  scale?: number;
  /** Only the newest item arrives with a drop-and-bounce (instant under Reduce Motion). */
  animateLast?: boolean;
};

const DROP_FROM = 70; // viewBox units above rest

function MarbleShape({ m, t }: { m: Marble; t: Theme }) {
  const color = t.topic(m.colorKey).color;
  return (
    <G testID={`marble-${m.index}`}>
      <Circle cx={m.x} cy={m.y} r={m.r} fill={color} />
      <Circle cx={m.x - m.r * 0.34} cy={m.y - m.r * 0.37} r={m.r * 0.28} fill="#fff" opacity={0.7} />
      {m.gold ? (
        <Circle testID={`gold-${m.index}`} cx={m.x} cy={m.y} r={m.ringR} fill="none" stroke={t.c.sun} strokeWidth={2} strokeDasharray="3 2" />
      ) : null}
    </G>
  );
}

/** Plays the drop when the newest item's identity changes (and once on mount); never on a plain re-render. */
function useDrop(lastKey: string | null, enabled: boolean, distance: number) {
  const { animate, reduce } = useMotion();
  const y = useSharedValue(0);
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || lastKey === null || played.current === lastKey) return;
    played.current = lastKey;
    if (reduce) {
      y.value = 0;
      return;
    }
    y.value = -distance;
    y.value = animate(0);
    // `animate`/`distance` are not triggers; lastKey is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, enabled]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/** Glass jar: marbles stacked from the bottom, gold ring for overtime, a lid (flat and accent-colored when closed). */
export function Jar({ items, closed, scale = 1, animateLast = false }: CollectionProps) {
  const t = useTheme();
  const { marbles, overflow } = useMemo(() => layoutJar(items), [items]);
  const W = JAR_W * scale, H = JAR_H * scale;
  const dropStyle = useDrop(lastItemKey(items), animateLast, DROP_FROM * scale);

  // The dropping marble is its own overlay so a plain Animated.View transform moves it (no animated SVG props).
  const dropIndex = animateLast && overflow === 0 && marbles.length > 0 ? marbles.length - 1 : -1;
  const lidY = closed ? 4 : -10;
  const lidRot = closed ? 0 : -16;
  const n = items.length;
  const label = `Jar with ${n} ${n === 1 ? 'marble' : 'marbles'}${closed ? ', closed' : ''}`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={JAR_VIEWBOX}>
        <Rect
          testID={closed ? 'jar-lid-closed' : 'jar-lid-open'}
          x={17} y={lidY} width={36} height={8} rx={3}
          fill={closed ? t.c.accent : t.c.line}
          rotation={lidRot} origin={`17, ${lidY}`}
        />
        <Path d={JAR_PATH} fill={t.c.surface} fillOpacity={0.75} stroke={t.c.muted} strokeWidth={1.4} />
        <Path d="M14 30 c0 -6 2 -9 5 -11" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        <Path d="M13 40 v24" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        {marbles.filter(m => m.index !== dropIndex).map(m => <MarbleShape key={m.index} m={m} t={t} />)}
        {overflow > 0 ? (
          <SvgText testID="jar-overflow" x={35} y={30} fontSize={9} fontWeight="bold" fill={t.c.ink} textAnchor="middle">
            {`+${overflow}`}
          </SvgText>
        ) : null}
      </Svg>
      {dropIndex >= 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, dropStyle]}>
          <Svg width={W} height={H} viewBox={JAR_VIEWBOX}>
            <MarbleShape m={marbles[dropIndex]} t={t} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
