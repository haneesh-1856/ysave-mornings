import { memo, useEffect, useId } from 'react';
import Animated, { useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { MOMENT_FONTS } from '@/theme/fonts';

import { flagsText, getLabFlags, hasLabSink, labStep, type LabFlags } from './lab';
import { margin, type Size } from './parts';
import { MOMENT_COLORS as C } from './colors';
import { nearest, pathOf, type Glow, type Prim } from './three';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Width of the box a Label3D lays its text out in; the text is aligned inside it around the point. */
const LABEL_WIDTH = 600;
const DASH = [6, 5];
/**
 * A solid line as a dash pattern: one dash longer than any line on screen, no gap. NOT []: react-native-svg on Android
 * turns an empty array into `new DashPathEffect(new float[0], ...)`, which Android rejects (fewer than 2 intervals)
 * with a native exception, closing the app with no red box (Pixel 9a, 5 Nov 2026, right after the colour fix).
 */
export const SOLID = [100000, 0];

/** Lab colour mode 'fixed': every shape this grey with a light outline (no animated colour at all). */
const FIXED_FILL = '#5b616c';
const FIXED_STROKE = '#c9ccd2';
/**
 * What an animated colour sends for "no fill" / "no outline". The prims say 'none' (a valid SVG paint), but an
 * ANIMATED colour goes through Reanimated's processColor on Android, which throws "Invalid color value: 'none'" on
 * the first 3D frame: the close crash on the Pixel 9a (2 and 4 Nov 2026, red box in the Moments lab on 5 Nov). The
 * web build accepts 'none', so the sandbox never showed it. 'transparent' at opacity 0 draws the same nothing.
 */
const NO_PAINT = 'transparent';

/**
 * The animated props of slot `p` (undefined = an unused slot, which draws nothing). Never emits the string 'none' as a
 * colour (see NO_PAINT). `colors: 'fixed'` (Moments lab) emits no colours at all; `dashes: false` no dash array.
 */
export const slotProps = (p: Prim | undefined, colors: LabFlags['colors'], dashes: boolean): Record<string, unknown> => {
  'worklet';
  const out: Record<string, unknown> = p
    ? { d: pathOf(p.pts, p.segs), fillOpacity: p.fillOpacity, strokeOpacity: p.strokeOpacity, strokeWidth: p.strokeWidth }
    : { d: 'M0 0', fillOpacity: 0, strokeOpacity: 0, strokeWidth: 0 };
  if (colors !== 'fixed') {
    const fill = p ? p.fill : 'none';
    const stroke = p ? p.stroke : 'none';
    out.fill = fill === 'none' ? NO_PAINT : fill;
    out.stroke = stroke === 'none' ? NO_PAINT : stroke;
    if (fill === 'none') out.fillOpacity = 0;
    if (stroke === 'none') out.strokeOpacity = 0;
  }
  if (dashes) out.strokeDasharray = p && p.dashed ? DASH : SOLID;
  return out;
};

const Slot = memo(function Slot({ i, prims, colors, dashes }: { i: number; prims: SharedValue<Prim[]>; colors: LabFlags['colors']; dashes: boolean }) {
  const props = useAnimatedProps(() => slotProps(prims.value[i], colors, dashes));
  return colors === 'fixed' ? (
    <AnimatedPath testID="scene3d-path" d="M0 0" fill={FIXED_FILL} stroke={FIXED_STROKE} fillOpacity={0} strokeOpacity={0} animatedProps={props} />
  ) : (
    <AnimatedPath testID="scene3d-path" d="M0 0" fill="none" stroke="none" fillOpacity={0} strokeOpacity={0} animatedProps={props} />
  );
});

/**
 * Draws the prims a worklet returns for the current local time: a fixed pool of `slots` animated SVG paths. Each frame
 * the sorted prims fill slots 0..n-1 and the rest draw nothing, so nothing re-renders per frame. When a frame has more
 * prims than slots the farthest are dropped. `draw` runs on the UI thread, so it and everything it calls must be
 * worklets (three.ts is; a scene's own helpers need the 'worklet' directive too). Pass a module-level worklet const
 * (stable identity; the worklet guard test only sees module-level functions), not an inline function. `draw` must
 * return a fresh array each call: the sort works in place.
 * `data` is the scene's own input (the week's daily minutes, say): a plain serializable value (numbers, strings, arrays,
 * plain objects) handed to `draw(lt, data, size)`, so `draw` stays a module-level worklet instead of a closure.
 * `freezeAt` (optional): the local time from which the scene no longer changes. From then on `draw` is called once (with
 * lt = freezeAt) and that frame is kept, so a still dial costs nothing per frame (and Reduce Motion, which sits at the end, draws once).
 */
export function Scene3D<D = undefined>({ lt, size, slots, draw, data, freezeAt }: {
  lt: SharedValue<number>; size: Size; slots: number; draw: (lt: number, data: D, size: Size) => Prim[]; data?: D; freezeAt?: number;
}) {
  // Once the scene stops moving (lt >= freezeAt) the frame is built once and then kept: no rebuild, no slot updates.
  const still = useSharedValue<Prim[] | null>(null);
  const prims = useDerivedValue(() => {
    const frozen = freezeAt !== undefined && lt.value >= freezeAt;
    if (frozen && still.value) return still.value;
    const frame = nearest(draw(frozen ? (freezeAt as number) : lt.value, data as D, size), slots);
    if (frozen) still.value = frame;
    return frame;
  });
  // Moments lab (dev): the switches, read once per mount, and the crash trail (mount, then every half second drawn).
  const lab = getLabFlags();
  const trace = hasLabSink();
  useEffect(() => {
    labStep(`3D scene mounted: ${slots} shapes (${flagsText(lab)})`);
    return () => labStep('3D scene unmounted');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);
  useAnimatedReaction(
    () => (trace ? Math.floor(lt.value * 2) : -1),
    (cur, prev) => {
      if (trace && cur !== prev && cur >= 0) scheduleOnRN(labStep, `3D frame at ${(cur / 2).toFixed(1)} s: ${prims.value.length} shapes`);
    },
  );
  if (!lab.scene3d) return null;
  const ids = Array.from({ length: slots }, (_, i) => i);
  return (
    <Svg testID="scene3d" width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {ids.map((i) => (
        <Slot key={i} i={i} prims={prims} colors={lab.colors} dashes={lab.dashes} />
      ))}
    </Svg>
  );
}

/**
 * Mono text at a projected point. `at` runs on the UI thread, so it must be a worklet returning [x, y, opacity] (and
 * optionally a colour that replaces `color`) for the local time (a module-level worklet const, like `draw`); `data`
 * is handed to it as `at(lt, data, screen)`, like Scene3D's. The text is centred vertically on y and aligned around x,
 * kept inside the screen margins.
 */
export function Label3D<D = undefined>({ lt, at, text, size, color, align = 'center', screen, data }: {
  lt: SharedValue<number>; at: (lt: number, data: D, screen: Size) => [number, number, number] | [number, number, number, string];
  text: string; size: number; color: string; align?: 'left' | 'center' | 'right'; screen: Size; data?: D;
}) {
  const box = size * 1.4;
  const m = margin(screen);
  const right = screen.w - m;
  const showLabel = getLabFlags().labels;
  const style = useAnimatedStyle(() => {
    const r = at(lt.value, data as D, screen);
    const x = r[0];
    const y = r[1];
    const opacity = r[2];
    const px = align === 'left' ? Math.max(m, x) : align === 'right' ? Math.min(right, x) : x;
    const left = align === 'left' ? px : align === 'right' ? px - LABEL_WIDTH : px - LABEL_WIDTH / 2;
    return r.length > 3 ? { opacity, left, top: y - box / 2, color: r[3] } : { opacity, left, top: y - box / 2 };
  });
  if (!showLabel) return null;
  return (
    <Animated.Text
      numberOfLines={1}
      style={[{ position: 'absolute', width: LABEL_WIDTH, height: box, lineHeight: box, textAlign: align, color, fontFamily: MOMENT_FONTS.mono, fontSize: size, includeFontPadding: false }, style]}>
      {text}
    </Animated.Text>
  );
}

/**
 * A soft yellow glow around a gold piece of a 3D scene (user request 2026-11-05: "its bright resonance on its
 * surrounding"). `at` is the scene's module-level worklet returning [x, y, rx, ry, opacity] for the local time; drawn
 * over the scene as a radial gradient that breathes gently once lit. Only numbers are animated (position, radii,
 * opacity): the colour is a fixed gradient, so no animated colour or dash pattern reaches Android's SVG drawing.
 */
export function Glow3D<D = undefined>({ lt, at, data, size }: {
  lt: SharedValue<number>; at: (lt: number, data: D, size: Size) => Glow; data?: D; size: Size;
}) {
  const id = `glow${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const on = getLabFlags().glow;
  const props = useAnimatedProps(() => {
    const g = at(lt.value, data as D, size);
    const breathe = 0.86 + 0.14 * Math.sin(lt.value * 2.4);
    return { cx: g[0], cy: g[1], rx: g[2], ry: g[3], opacity: g[4] * breathe };
  });
  if (!on) return null;
  return (
    <Svg testID="glow3d" width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={C.yellow} stopOpacity={0.5} />
          <Stop offset="0.4" stopColor={C.yellow} stopOpacity={0.2} />
          <Stop offset="1" stopColor={C.yellow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <AnimatedEllipse cx={0} cy={0} rx={0} ry={0} opacity={0} fill={`url(#${id})`} animatedProps={props} />
    </Svg>
  );
}
