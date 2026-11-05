import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Moment } from '@/domain/moments';
import { MOMENT_FONTS } from '@/theme/fonts';

import { useMotion } from '../useMotion';
import { endingText, momentAnnouncement, momentTelemetry } from '../momentText';
import { labStep } from './lab';
import { Best } from './Best';
import { MOMENT_COLORS as C } from './colors';
import { Day } from './Day';
import { Longest, type FocusBar } from './Longest';
import { Month } from './Month';
import { Chrome, Mono, unit, type Size } from './parts';
import { Streak } from './Streak';
import { Week } from './Week';
import { SunMarkAnimated, holeRadius, zoomToCover } from './SunMarkAnimated';
import { CUT, endOf, markAt, MOMENT_DUR, outExpo, phaseAt, seg, totalOf } from './timeline';

/** The ring finished closing (all tasks done) at this many seconds after the last moment. */
const ENDED_AT = 1.45;
/** How long each moment stays up in the reduced motion path. */
export const REDUCED_STEP_MS = 2200;
/** The clock runs this long past the end so "tap to continue" pulses for a minute, then stops (no idle frame work). */
const EXTRA_S = 60;
/**
 * TEMPORARY (2026-11-03, user request while tracing the close crash on the Pixel 9a): in development builds (Expo Go)
 * the animated sequence plays at quarter speed so each step can be watched and described. Release builds play at 1.
 * The timeline itself is unchanged; only the clock that drives it runs slower. Remove once the crash is found.
 */
export const DEV_MOMENTS_SPEED = __DEV__ ? 0.25 : 1;

type Props = {
  moments: readonly Moment[];
  /** Today's timed tasks by focus, for the Longest bars. */
  bars: readonly FocusBar[];
  onDone: () => void;
};

function MomentBody({ moment, lt, size, bars, settled }: { moment: Moment; lt: SharedValue<number>; size: Size; bars: readonly FocusBar[]; settled: boolean }) {
  switch (moment.kind) {
    case 'longest': return <Longest moment={moment} lt={lt} size={size} bars={bars} />;
    case 'day': return <Day moment={moment} lt={lt} size={size} settled={settled} />;
    case 'best': return <Best moment={moment} lt={lt} size={size} />;
    case 'streak': return <Streak moment={moment} lt={lt} size={size} />;
    case 'week': return <Week moment={moment} lt={lt} size={size} settled={settled} />;
    case 'month': return <Month moment={moment} lt={lt} size={size} />;
    default: {
      const unreachable: never = moment;
      return unreachable;
    }
  }
}

/** Background, telemetry and the moment itself, drawn at screen size. */
function MomentFrame({ moment, index, count, lt, size, bars, settled }: {
  moment: Moment; index: number; count: number; lt: SharedValue<number>; size: Size; bars: readonly FocusBar[]; settled: boolean;
}) {
  const { label, stamp } = momentTelemetry(moment);
  useEffect(() => {
    labStep(`moment ${index + 1}/${count} ${moment.kind} mounted`);
  }, [moment.kind, index, count]);
  return (
    <View style={{ width: size.w, height: size.h }} testID={`moment-${moment.kind}`}>
      <Chrome lt={lt} size={size} n={index + 1} of={count} label={label} stamp={stamp} />
      <MomentBody moment={moment} lt={lt} size={size} bars={bars} settled={settled} />
    </View>
  );
}

/** The sun's name, what the day came to, and the pulsing "tap to continue". `et` is seconds since the last moment ended. */
function EndingLayer({ et, size, ending, count }: { et: SharedValue<number>; size: Size; ending: ReturnType<typeof endingText>; count: number }) {
  const { w, h } = size;
  const u = unit(size);
  const cy = h / 2 + w * 0.5 * 0.48;
  const hint = useAnimatedStyle(() => {
    const hk = seg(et.value, 2.0, 2.3);
    // Once the clock has stopped (EXTRA_S), the hint holds steady instead of freezing mid-pulse.
    return { opacity: et.value >= EXTRA_S ? 0.8 : hk * (0.55 + 0.45 * Math.sin(et.value * 3)) };
  });
  const bar = useAnimatedStyle(() => ({ opacity: 0.35 * seg(et.value, 2.0, 2.3) }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID={`moments-ending-${count}`}>
      <Mono lt={et} text={ending.title} x={[0, w]} y={cy} size={Math.max(11, u * 0.034)} color={C.white} align="center" from={1.4} to={1.9} />
      <Mono lt={et} text={ending.sub} x={[0, w]} y={cy + u * 0.055} size={Math.max(9, u * 0.026)} align="center" from={1.6} to={2.1} />
      <Animated.Text
        style={[{ position: 'absolute', left: 0, width: w, top: h * 0.92 - 12, height: 24, lineHeight: 24, textAlign: 'center', color: C.steel, fontFamily: MOMENT_FONTS.mono, fontSize: Math.max(10, u * 0.032), includeFontPadding: false }, hint]}>
        TAP TO CONTINUE
      </Animated.Text>
      <Animated.View style={[{ position: 'absolute', left: w * 0.33, width: w * 0.34, top: h - h * 0.022, height: 4, backgroundColor: C.white }, bar]} />
    </View>
  );
}

type StageProps = {
  moments: readonly Moment[];
  bars: readonly FocusBar[];
  size: Size;
  index: number;
  quiet: boolean;
  ending: ReturnType<typeof endingText>;
  onIndex: (i: number) => void;
  onEnded: () => void;
};

/** The full sequence: ring draws, fly through, moments with wipes between, pull back, ending. One shared clock `t`. */
function AnimatedStage({ moments, bars, size, index, quiet, ending, onIndex, onEnded }: StageProps) {
  const count = moments.length;
  const { w, h } = size;
  const end = endOf(count);
  const zoomMax = zoomToCover(w, h);
  const t = useSharedValue(0);

  useEffect(() => {
    const total = totalOf(count) + EXTRA_S;
    t.value = withTiming(total, { duration: (total * 1000) / DEV_MOMENTS_SPEED, easing: Easing.linear });
    return () => cancelAnimation(t);
  }, [t, count]);

  useAnimatedReaction(
    () => phaseAt(t.value, count).index,
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(onIndex, cur);
    },
  );
  useAnimatedReaction(
    () => t.value >= end + ENDED_AT,
    (cur, prev) => {
      if (cur && !prev) scheduleOnRN(onEnded);
    },
  );

  const lt = useDerivedValue(() => phaseAt(t.value, count).local);
  const et = useDerivedValue(() => t.value - end);
  const radius = useDerivedValue(() => holeRadius(w * 0.5) * markAt(t.value, count, quiet, zoomMax).zoom);
  const mask = useAnimatedStyle(() => {
    const r = radius.value;
    return { left: w / 2 - r, top: h / 2 - r, width: 2 * r, height: 2 * r, borderRadius: r, opacity: markAt(t.value, count, quiet, zoomMax).windowOpen ? 1 : 0 };
  });
  const content = useAnimatedStyle(() => ({ left: radius.value - w / 2, top: radius.value - h / 2 }));
  const wipe = useAnimatedStyle(() => ({
    opacity: phaseAt(t.value, count).index > 0 && lt.value < CUT ? 1 : 0,
    transform: [{ translateX: w * outExpo(seg(lt.value, 0, CUT)) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, mask]}>
        <Animated.View style={[{ position: 'absolute', width: w, height: h }, content]}>
          <MomentFrame key={moments[index].kind} moment={moments[index]} index={index} count={count} lt={lt} size={size} bars={bars} settled={false} />
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: C.yellow }, wipe]} />
        </Animated.View>
      </Animated.View>
      <SunMarkAnimated t={t} count={count} quiet={quiet} w={w} h={h} />
      <EndingLayer et={et} size={size} ending={ending} count={count} />
    </View>
  );
}

/** Fades its children in over 250 ms. Reduced motion keeps this short fade (it is not movement). */
function FadeInView({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 250 });
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/** Reduced motion: no fly through and no rolls. Each moment's final frame fades in, then the ending's final frame. */
function ReducedStage({ moments, bars, size, index, quiet, ending, onIndex, onEnded }: StageProps) {
  const count = moments.length;
  const settledLt = useSharedValue(MOMENT_DUR);
  const settledT = useSharedValue(totalOf(count));
  const et = useSharedValue(totalOf(count) - endOf(count));
  const [atEnding, setAtEnding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (index + 1 < count) onIndex(index + 1);
      else {
        setAtEnding(true);
        onEnded();
      }
    }, REDUCED_STEP_MS);
    return () => clearTimeout(timer);
  }, [index, count, onIndex, onEnded]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {atEnding ? (
        <FadeInView key="ending">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
          <SunMarkAnimated t={settledT} count={count} quiet={quiet} w={size.w} h={size.h} />
          <EndingLayer et={et} size={size} ending={ending} count={count} />
        </FadeInView>
      ) : (
        <FadeInView key={`moment-${index}`}>
          <MomentFrame moment={moments[index]} index={index} count={count} lt={settledLt} size={size} bars={bars} settled />
        </FadeInView>
      )}
    </View>
  );
}

/**
 * The close moments player: a full-screen overlay with its own fixed look. Skip ends it at any time; once the
 * sequence has ended, a tap anywhere continues (an accidental tap mid-sequence does nothing). Needs at least one moment.
 */
export function MomentsPlayer({ moments, bars, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduce } = useMotion();
  const size = useMemo<Size>(() => ({ w: width, h: height }), [width, height]);
  const ending = useMemo(() => endingText(moments), [moments]);
  const [index, setIndex] = useState(0);
  const [ended, setEnded] = useState(false);

  // Moments lab crash trail (does nothing unless the dev setup plugged a sink in).
  useEffect(() => {
    labStep(`player opened: ${moments.map((m) => m.kind).join(', ')} (${size.w}x${size.h}, speed ${DEV_MOMENTS_SPEED}x${reduce ? ', reduced motion' : ''})`);
    return () => labStep('player closed');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per player
  }, []);
  useEffect(() => {
    if (ended) labStep('ending reached');
  }, [ended]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(momentAnnouncement(moments[index]));
  }, [moments, index]);

  useEffect(() => {
    if (!ended) return;
    AccessibilityInfo.announceForAccessibility(ending.announcement);
    if (!ending.quiet) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [ended, ending]);

  const onEnded = useCallback(() => setEnded(true), []);
  const stage: StageProps = { moments, bars, size, index, quiet: ending.quiet, ending, onIndex: setIndex, onEnded };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: C.bg }} testID="moments-player">
        <StatusBar style="light" />
        {/* Screen readers get the announcements; the drawn text would only repeat them. */}
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {reduce ? <ReducedStage {...stage} /> : <AnimatedStage {...stage} />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={onDone}
          testID="moments-skip"
          hitSlop={8}
          // Bottom right: at the top it sat on the telemetry stamp ("01:39") on the Pixel 9a (2026-11-05).
          style={{ position: 'absolute', bottom: insets.bottom + 12, right: 12, minWidth: 44, height: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.steel, fontFamily: MOMENT_FONTS.mono, fontSize: 12, letterSpacing: 1 }}>SKIP</Text>
        </Pressable>
        {ended ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={onDone}
            testID="moments-continue"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>
    </Modal>
  );
}
