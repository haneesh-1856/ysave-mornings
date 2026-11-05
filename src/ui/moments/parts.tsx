import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { G, Line } from 'react-native-svg';

import { MOMENT_FONTS } from '@/theme/fonts';

import { MOMENT_COLORS as C } from './colors';
import { outExpo, seg } from './timeline';

/** Screen size and the layout unit the prototype uses (the shorter side). */
export type Size = { w: number; h: number };
export const unit = ({ w, h }: Size) => Math.min(w, h);
/** Left and right margin. */
export const margin = ({ w }: Size) => w * 0.07;
/** Advance of IBM Plex Mono as a fraction of its size. */
const MONO_ADVANCE = 0.6;

type Local = { lt: SharedValue<number> };

/** Mono text centred vertically on `y` that fades in between two local times. */
export function Mono({ lt, text, y, size, color = C.steel, align = 'left', x, from = 0, to = 0.3 }: Local & {
  text: string; y: number; size: number; color?: string; align?: 'left' | 'center' | 'right'; x: number | [number, number]; from?: number; to?: number;
}) {
  const style = useAnimatedStyle(() => ({ opacity: seg(lt.value, from, to) }));
  const box = size * 1.4;
  const pos = Array.isArray(x) ? { left: x[0], width: x[1] - x[0] } : { left: x, width: 600 };
  return (
    <Animated.Text
      numberOfLines={1}
      style={[{ position: 'absolute', top: y - box / 2, height: box, lineHeight: box, textAlign: align, color, fontFamily: MOMENT_FONTS.mono, fontSize: size, includeFontPadding: false }, pos, style]}>
      {text}
    </Animated.Text>
  );
}

/** The faint grid behind every moment (drawn once, static). */
const Grid = memo(function Grid({ w, h }: Size) {
  const g = Math.min(w, h) * 0.1;
  const lines: ReactNode[] = [];
  for (let x = (w % g) / 2; x < w; x += g) lines.push(<Line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = (h % g) / 2; y < h; y += g) lines.push(<Line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} />);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <G stroke="rgba(242,243,245,0.035)" strokeWidth={1}>{lines}</G>
    </Svg>
  );
});

/** Background, grid and the telemetry row: "n / N", the yellow label, the stamp. */
export function Chrome({ lt, size, n, of, label, stamp }: Local & { size: Size; n: number; of: number; label: string; stamp: string }) {
  const { w, h } = size;
  const s = Math.max(10, unit(size) * 0.03);
  const ty = h * 0.085;
  const x = margin(size);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]}>
      <Grid w={w} h={h} />
      <Mono lt={lt} text={`${n} / ${of}`} x={x} y={ty} size={s} />
      <Mono lt={lt} text={label} x={x + s * 4.2} y={ty} size={s} color={C.yellow} />
      <Mono lt={lt} text={stamp} x={[w * 0.4, w - x]} y={ty} size={s} align="right" />
      <View style={{ position: 'absolute', left: x, width: w - x * 2, top: ty + s * 1.2, height: 1, backgroundColor: C.edge }} />
    </View>
  );
}

/** The big headline: rises from a baseline mask, the full stop yellow, a short yellow underline. */
export function Headline({ lt, size, text, from }: Local & { size: Size; text: string; from: number }) {
  const { w, h } = size;
  const fs = w * 0.17;
  const base = h * 0.77;
  const x = margin(size);
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - outExpo(seg(lt.value, from, from + 0.7))) * fs }] }));
  const line = useAnimatedStyle(() => ({ width: fs * 0.6 * outExpo(seg(lt.value, from + 0.2, from + 0.9)) }));
  const body = text.endsWith('.') ? text.slice(0, -1) : text;
  return (
    <>
      <View style={{ position: 'absolute', left: x, width: w * 0.86, top: base - fs * 1.05, height: fs * 1.1, overflow: 'hidden' }}>
        <Animated.View style={rise}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{ fontFamily: MOMENT_FONTS.display, fontSize: fs, lineHeight: fs * 1.05, color: C.white, includeFontPadding: false }}>
            {body}
            {body !== text ? <Text style={{ color: C.yellow }}>.</Text> : null}
          </Text>
        </Animated.View>
      </View>
      <Animated.View style={[{ position: 'absolute', left: x, top: base + fs * 0.12, height: Math.max(2, unit(size) * 0.006), backgroundColor: C.yellow }, line]} />
    </>
  );
}

/** The detail line typed out in mono, with a yellow block cursor while it types. */
export function Typed({ lt, size, text, from }: Local & { size: Size; text: string; from: number }) {
  const { w, h } = size;
  const x = margin(size);
  let fs = Math.max(10, unit(size) * 0.03);
  const avail = w - x * 2;
  if (text.length * fs * MONO_ADVANCE > avail) fs = avail / (text.length * MONO_ADVANCE);
  const charW = fs * MONO_ADVANCE;
  const span = text.length * 0.018 + 0.1;
  const reveal = useAnimatedStyle(() => ({ width: Math.ceil(text.length * seg(lt.value, from, from + span)) * charW }));
  const cursor = useAnimatedStyle(() => {
    const k = seg(lt.value, from, from + span);
    return { opacity: k > 0 && k < 1 ? 1 : 0, left: x + Math.ceil(text.length * k) * charW + 2 };
  });
  const box = fs * 1.5;
  const y = h * 0.825;
  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: x, top: y - box / 2, height: box, overflow: 'hidden' }, reveal]}>
        <Text numberOfLines={1} style={{ width: avail + charW * 2, color: C.steel, fontFamily: MOMENT_FONTS.mono, fontSize: fs, lineHeight: box, includeFontPadding: false }}>
          {text}
        </Text>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: y - fs * 0.5, width: fs * 0.55, height: fs, backgroundColor: C.yellow }, cursor]} />
    </>
  );
}

const DIGIT_W = 0.5; // cell widths as a fraction of the font size
const MARK_W = 0.32;
/** Digits 0-9 twice: the column rolls through ten places and lands on the second copy of the digit. */
const COLUMN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * One rolling digit. The column is 20 one-line texts, each in its own fs-high box, inside a column of explicit height.
 * (It was one 20-line text; on Android that tall text inside the clipped cell was not drawn at all, so only "/" and
 * ":" showed on the Pixel 9a, 2026-11-05. One-line texts are what the marks use, and they draw.)
 */
function DigitCell({ digit, fs, delay, lt, from, color }: { digit: number; fs: number; delay: number; lt: SharedValue<number>; from: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const k = outExpo(seg(lt.value, from + delay, from + 0.8 + delay));
    return { transform: [{ translateY: -(10 + digit) * k * fs }] };
  });
  return (
    <View style={{ width: fs * DIGIT_W, height: fs, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: fs * DIGIT_W, height: fs * COLUMN.length }, style]}>
        {COLUMN.map((d, i) => (
          <View key={i} style={{ width: fs * DIGIT_W, height: fs, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: MOMENT_FONTS.display, fontSize: fs, lineHeight: fs, color, textAlign: 'center', includeFontPadding: false }}>{d}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function MarkCell({ ch, fs, delay, lt, from }: { ch: string; fs: number; delay: number; lt: SharedValue<number>; from: number }) {
  const style = useAnimatedStyle(() => ({ opacity: outExpo(seg(lt.value, from + delay, from + 0.8 + delay)) }));
  return (
    <Animated.View style={[{ width: fs * MARK_W, height: fs }, style]}>
      <Text style={{ fontFamily: MOMENT_FONTS.display, fontSize: fs, lineHeight: fs, color: C.steel, textAlign: 'center', includeFontPadding: false }}>{ch}</Text>
    </Animated.View>
  );
}

/**
 * A row of rolling digits ("5/5", "2:10"). Each digit is a clipped column that slides to its number, one after the
 * other. Settled (reduced motion) it is the plain text in the same cells, so the final frame matches.
 */
export function Roll({ text, x, y, fs, from, label, lt, settled, size, color = C.white }: {
  color?: string; text: string; x: number; y: number; fs: number; from: number; label: string; lt: SharedValue<number>; settled: boolean; size: Size;
}) {
  const chars = [...text];
  const width = chars.reduce((sum, ch) => sum + fs * (/\d/.test(ch) ? DIGIT_W : MARK_W), 0);
  return (
    <>
      <View accessible accessibilityLabel={`${label} ${text}`} style={{ position: 'absolute', left: x - width / 2, top: y - fs / 2, width, height: fs, flexDirection: 'row' }}>
        {settled ? (
          <Text style={{ fontFamily: MOMENT_FONTS.display, fontSize: fs, lineHeight: fs, color, includeFontPadding: false }}>{text}</Text>
        ) : (
          chars.map((ch, i) =>
            /\d/.test(ch) ? (
              <DigitCell key={i} digit={Number(ch)} fs={fs} delay={i * 0.12} lt={lt} from={from} color={color} />
            ) : (
              <MarkCell key={i} ch={ch} fs={fs} delay={i * 0.12} lt={lt} from={from} />
            ),
          )
        )}
      </View>
      <Mono lt={lt} text={label} x={[x - size.w * 0.25, x + size.w * 0.25]} y={y + fs * 0.62} size={Math.max(10, unit(size) * 0.028)} align="center" from={from} to={from + 0.4} />
    </>
  );
}
