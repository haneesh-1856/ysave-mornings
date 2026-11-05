import { useMemo } from 'react';
import { TextInput } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';
import { MOMENT_FONTS } from '@/theme/fonts';

import { momentDetail, momentHeadline } from '../momentText';
import { MOMENT_COLORS as C } from './colors';
import { MONTH_SLOTS, MONTH_STILL_AT, monthHeadAt, monthLabelSizes, monthRingAt, monthRingText, monthSceneDraw, monthTotalAt, monthTotalText, monthGlowAt } from './monthScene';
import { Headline, Typed, type Size } from './parts';
import { Scene3D, Glow3D } from './Scene3D';

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
/** Width of the box a label is laid out in. */
const BOX_WIDTH = 600;

type Props = { moment: Extract<Moment, { kind: 'month' }>; lt: SharedValue<number>; size: Size };
type Pos = { opacity: number; left: number; top: number; color?: string };

/**
 * The running total at the head of the curtain: text that changes every frame, so it is an animated (read-only) input.
 * From MONTH_STILL_AT nothing moves: the last frame's style and text are kept and nothing is recomputed.
 */
function RunningTotal({ lt, data, size, finalText }: { lt: SharedValue<number>; data: number[]; size: Size; finalText: string }) {
  const fs = monthLabelSizes(size).total;
  const box = fs * 1.4;
  const stillStyle = useSharedValue<Pos | null>(null);
  const stillText = useSharedValue<string | null>(null);
  const style = useAnimatedStyle(() => {
    const frozen = lt.value >= MONTH_STILL_AT;
    // Once frozen, the first run caches the frame; writing the cache re-runs this once, which then returns it.
    if (frozen && stillStyle.value) return stillStyle.value;
    const r = monthHeadAt(lt.value, data, size);
    const pos = { opacity: r[2], left: r[0] - BOX_WIDTH, top: r[1] - box / 2 };
    if (frozen) stillStyle.value = pos;
    return pos;
  });
  const props = useAnimatedProps(() => {
    const frozen = lt.value >= MONTH_STILL_AT;
    if (frozen && stillText.value !== null) return { text: stillText.value, defaultValue: stillText.value } as object;
    const text = monthTotalAt(lt.value, data, size);
    if (frozen) stillText.value = text;
    return { text, defaultValue: text } as object;
  });
  return (
    <AnimatedInput
      testID="month-total"
     
      editable={false}
      pointerEvents="none"
      numberOfLines={1}
      defaultValue={finalText}
      animatedProps={props}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{
        position: 'absolute', width: BOX_WIDTH, height: box, textAlign: 'right', textAlignVertical: 'center', padding: 0, color: C.white,
        fontFamily: MOMENT_FONTS.mono, fontSize: fs, includeFontPadding: false,
      }, style]}
    />
  );
}

/** The ring's label, left-aligned at its point; kept as it was at MONTH_STILL_AT from then on. */
function RingLabel({ lt, data, size, text }: { lt: SharedValue<number>; data: number[]; size: Size; text: string }) {
  const fs = monthLabelSizes(size).ring;
  const box = fs * 1.4;
  const still = useSharedValue<Pos | null>(null);
  const style = useAnimatedStyle(() => {
    const frozen = lt.value >= MONTH_STILL_AT;
    if (frozen && still.value) return still.value;
    const r = monthRingAt(lt.value, data, size);
    const pos = { opacity: r[2], left: r[0], top: r[1] - box / 2, color: r[3] };
    if (frozen) still.value = pos;
    return pos;
  });
  return (
    <Animated.Text
      numberOfLines={1}
      style={[{
        position: 'absolute', width: BOX_WIDTH, height: box, lineHeight: box, textAlign: 'left', color: C.steel,
        fontFamily: MOMENT_FONTS.mono, fontSize: fs, includeFontPadding: false,
      }, style]}>
      {text}
    </Animated.Text>
  );
}

/** Monthly goal: the month's focus climbs a cylinder as a curtain, the goal floats as the sun's ring and closes when the total reaches it. */
export function Month({ moment, lt, size }: Props) {
  const { goalHours, dailyMs, monthFocusMs } = moment;
  // Built once per moment: a new array every render would restart Scene3D's animated draw.
  const data = useMemo(() => [goalHours === null ? -1 : goalHours * 3_600_000, ...dailyMs], [goalHours, dailyMs]);
  return (
    <>
      <Scene3D lt={lt} size={size} slots={MONTH_SLOTS} draw={monthSceneDraw} data={data} freezeAt={MONTH_STILL_AT} />
      <Glow3D lt={lt} at={monthGlowAt} data={data} size={size} />
      {/* Keyed by size and data: the labels cache their settled frame, so a resize or a new month remounts them. */}
      <RunningTotal key={`t${size.w}x${size.h}:${data.join()}`} lt={lt} data={data} size={size} finalText={monthTotalText(monthFocusMs)} />
      <RingLabel key={`r${size.w}x${size.h}:${data.join()}`} lt={lt} data={data} size={size} text={monthRingText(data)} />
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={2.2} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.7} />
    </>
  );
}
