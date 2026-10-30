import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { CollectionItem } from '@/domain/collection';
import type { Theme } from '@/theme/buildTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { collectionLabel, useArrival, useClosedDecoration } from './kit';
import { JAR_H, JAR_PATH, JAR_VIEWBOX, JAR_W, lastItemKey, layoutJar, type Marble } from './jarLayout';

type Variant = 'glass' | 'line' | 'paper';

export type CollectionProps = {
  items: CollectionItem[];
  closed: boolean;
  /** Scales the whole drawing: 1 = 70 x 96 pt. Today dock ~0.65, Planned ~2.3. */
  scale?: number;
  /** Only the newest item arrives with a drop-and-bounce (instant under Reduce Motion). */
  animateLast?: boolean;
  /** The lid swings shut when `closed` flips false -> true while mounted (instant under Reduce Motion). Mounting closed shows it closed. */
  animateLid?: boolean;
  /** Glass (default), outlined `line`, or flat `paper`; same geometry. */
  variant?: Variant;
};

function MarbleShape({ m, t, variant }: { m: Marble; t: Theme; variant: Variant }) {
  const color = t.topic(m.colorKey).color;
  return (
    <G testID={`marble-${m.index}`}>
      {variant === 'glass' ? (
        <>
          <Circle cx={m.x} cy={m.y} r={m.r} fill={color} />
          <Circle cx={m.x - m.r * 0.34} cy={m.y - m.r * 0.37} r={m.r * 0.28} fill="#fff" opacity={0.7} />
        </>
      ) : variant === 'line' ? (
        <Circle cx={m.x} cy={m.y} r={m.r - 0.5} fill={color} stroke={t.c.ink} strokeWidth={1.5} />
      ) : (
        <>
          <Circle cx={m.x + 1.2} cy={m.y + 1.6} r={m.r} fill={t.c.ink} opacity={0.15} />
          <Circle cx={m.x} cy={m.y} r={m.r} fill={color} />
        </>
      )}
      {m.gold ? (
        <Circle
          testID={`gold-${m.index}`} cx={m.x} cy={m.y} r={m.ringR} fill="none" stroke={t.c.sun} strokeWidth={2}
          strokeDasharray={variant === 'line' ? undefined : '3 2'}
        />
      ) : null}
    </G>
  );
}

const LID_OPEN_ROT = 16; // degrees
const LID_OPEN_LIFT = 14; // viewBox units (open lid y = -10, closed y = 4)

/** Jar: marbles stacked from the bottom, gold ring for overtime, a lid (flat and accent-colored when closed). Glass, line and paper variants. */
export function Jar({ items, closed, scale = 1, animateLast = false, animateLid = false, variant = 'glass' }: CollectionProps) {
  const t = useTheme();
  const { marbles, overflow } = useMemo(() => layoutJar(items), [items]);
  const W = JAR_W * scale, H = JAR_H * scale;
  const lid = useClosedDecoration(closed, animateLid);
  const s = Math.min(W / 70, H / 98); // viewBox is 70 x 98 inside W x H
  const hingeX = (W - 70 * s) / 2 + 17 * s - W / 2; // lid hinge, relative to the view centre
  const hingeY = (4 + 12) * s - H / 2;
  const lidStyle = useAnimatedStyle(() => {
    const open = 1 - lid.value;
    return {
      transform: [
        { translateY: -LID_OPEN_LIFT * s * open },
        { translateX: hingeX }, { translateY: hingeY },
        { rotate: `${-LID_OPEN_ROT * open}deg` },
        { translateX: -hingeX }, { translateY: -hingeY },
      ],
    };
  });
  const dropStyle = useArrival('drop', lastItemKey(items), animateLast, scale);

  // The dropping marble is its own overlay so a plain Animated.View transform moves it (no animated SVG props).
  const dropIndex = animateLast && overflow === 0 && marbles.length > 0 ? marbles.length - 1 : -1;
  const lidY = closed ? 4 : -10;
  const lidRot = closed ? 0 : -16;
  const n = items.length;
  // The line variant's lid is outlined and keeps its look when closed; the others turn accent.
  const lidLook = variant === 'line'
    ? { rx: 2, fill: t.c.bg, stroke: t.c.ink, strokeWidth: 2 }
    : { rx: 3, fill: closed ? t.c.accent : t.c.line };
  const label = collectionLabel(variant, n, closed);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={JAR_VIEWBOX}>
        {animateLid ? null : (
          <Rect
            testID={closed ? 'jar-lid-closed' : 'jar-lid-open'}
            x={17} y={lidY} width={36} height={8} {...lidLook}
            rotation={lidRot} origin={`17, ${lidY}`}
          />
        )}
        {variant === 'glass' ? (
          <>
            <Path d={JAR_PATH} fill={t.c.surface} fillOpacity={0.75} stroke={t.c.muted} strokeWidth={1.4} />
            <Path d="M14 30 c0 -6 2 -9 5 -11" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
            <Path d="M13 40 v24" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
          </>
        ) : variant === 'line' ? (
          <>
            <Path d={JAR_PATH} fill="none" stroke={t.c.ink} strokeWidth={2.2} strokeLinejoin="round" />
            <Path d="M15 26 h40" stroke={t.c.ink} strokeWidth={1} strokeDasharray="2 3" />
          </>
        ) : (
          <>
            <Path d={JAR_PATH} fill={t.c.ink} opacity={0.14} transform="translate(3 3)" />
            <Path d={JAR_PATH} fill={t.c.surface} />
            <Path d="M15 14 h40 v4 h-40z" fill={t.c.tint1} />
          </>
        )}
        {marbles.filter(m => m.index !== dropIndex).map(m => <MarbleShape key={m.index} m={m} t={t} variant={variant} />)}
        {overflow > 0 ? (
          <SvgText testID="jar-overflow" x={35} y={30} fontSize={9} fontWeight="bold" fill={t.c.ink} textAnchor="middle">
            {`+${overflow}`}
          </SvgText>
        ) : null}
      </Svg>
      {animateLid ? (
        // The lid is its own overlay so a plain Animated.View transform swings it (no animated SVG props); drawn flat-closed, posed open by the transform.
        <Animated.View testID="jar-lid-overlay" pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, lidStyle]}>
          <Svg width={W} height={H} viewBox={JAR_VIEWBOX}>
            <Rect testID={closed ? 'jar-lid-closed' : 'jar-lid-open'} x={17} y={4} width={36} height={8} {...lidLook} />
          </Svg>
        </Animated.View>
      ) : null}
      {dropIndex >= 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, dropStyle]}>
          <Svg width={W} height={H} viewBox={JAR_VIEWBOX}>
            <MarbleShape m={marbles[dropIndex]} t={t} variant={variant} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
