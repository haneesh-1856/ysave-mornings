import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { RAY_OUTER, RAY_WIDTH, RAYS, RING_OPENING, RING_RADIUS, RING_START, RING_WIDTH } from '../SunMark';
import { markAt, rayAt } from './timeline';
import { MOMENT_COLORS } from './colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Radius in screen units of the hole of the ring (inside the stroke) for a mark `size` wide. */
export const holeRadius = (size: number): number => {
  'worklet';
  return ((RING_RADIUS - RING_WIDTH / 2) / 100) * size;
};

/** How far the mark must scale so its hole covers the whole screen (the fly through). */
export const zoomToCover = (w: number, h: number): number => (Math.hypot(w, h) * 0.56) / holeRadius(w * 0.5);

const rad = (deg: number) => {
  'worklet';
  return ((deg - 90) * Math.PI) / 180;
};

type MarkState = ReturnType<typeof markAt>;

function Ray({ deg, inner, i, t, m, cx, cy, base }: {
  deg: number; inner: number; i: number; t: SharedValue<number>; m: SharedValue<MarkState>; cx: number; cy: number; base: number;
}) {
  const props = useAnimatedProps(() => {
    const s = (base * m.value.zoom) / 100;
    const a = rad(deg);
    const r2 = (inner + (RAY_OUTER - inner) * rayAt(t.value, i)) * s;
    return {
      x1: cx + Math.cos(a) * inner * s,
      y1: cy + Math.sin(a) * inner * s,
      x2: cx + Math.cos(a) * r2,
      y2: cy + Math.sin(a) * r2,
      strokeWidth: RAY_WIDTH * s,
    };
  });
  return <AnimatedLine x1={cx} y1={cy} x2={cx} y2={cy} stroke={MOMENT_COLORS.yellow} strokeLinecap="butt" animatedProps={props} />;
}

type Props = {
  /** Seconds on the player timeline. */
  t: SharedValue<number>;
  count: number;
  quiet: boolean;
  w: number;
  h: number;
};

/**
 * The app's sun mark (geometry from SunMark.tsx) drawn at full screen size so it can scale through the camera. One
 * shared timeline value drives every element through animated props, so nothing re-renders per frame.
 */
export function SunMarkAnimated({ t, count, quiet, w, h }: Props) {
  const cx = w / 2;
  const cy = h / 2;
  const base = w * 0.5;
  const zoomMax = zoomToCover(w, h);
  const m = useDerivedValue(() => markAt(t.value, count, quiet, zoomMax));

  const fade = useAnimatedStyle(() => ({ opacity: m.value.alpha }));

  const ringProps = useAnimatedProps(() => {
    const s = (base * m.value.zoom) / 100;
    const r = RING_RADIUS * s;
    const circumference = 2 * Math.PI * r;
    const span = (360 - RING_OPENING + RING_OPENING * m.value.close) * m.value.ring;
    return { r, strokeWidth: RING_WIDTH * s, strokeDasharray: [(span / 360) * circumference, circumference] };
  });

  const pulseProps = useAnimatedProps(() => {
    const k = m.value.pulse;
    const hole = holeRadius(base) + (RING_WIDTH / 100) * base * 0.5;
    const on = !quiet && m.value.close > 0;
    return { r: hole * (1 + k * 1.6), strokeOpacity: on ? (1 - k) * 0.8 : 0, strokeWidth: Math.max(1, 3 * (1 - k)) };
  });

  const dotProps = useAnimatedProps(() => {
    const on = !quiet && m.value.close > 0;
    return { r: on ? Math.min(w, h) * 0.012 * m.value.close : 0, opacity: on ? m.value.close * (1 - m.value.pulse * 0.5) : 0 };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, fade]} testID="moments-mark">
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} accessible={false} importantForAccessibility="no-hide-descendants">
        <AnimatedCircle
          cx={cx} cy={cy} r={RING_RADIUS * base / 100} fill="none" stroke={MOMENT_COLORS.yellow}
          strokeWidth={RING_WIDTH * base / 100} strokeLinecap="butt"
          rotation={RING_START - 90} origin={`${cx}, ${cy}`}
          animatedProps={ringProps}
        />
        {RAYS.map(([deg, inner], i) => (
          <Ray key={deg} deg={deg} inner={inner} i={i} t={t} m={m} cx={cx} cy={cy} base={base} />
        ))}
        <AnimatedCircle cx={cx} cy={cy} r={0} fill="none" stroke={MOMENT_COLORS.yellow} strokeOpacity={0} animatedProps={pulseProps} />
        <AnimatedCircle cx={cx} cy={cy} r={0} fill={MOMENT_COLORS.yellow} animatedProps={dotProps} />
      </Svg>
    </Animated.View>
  );
}
