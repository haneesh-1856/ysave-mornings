import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { formatHM, momentDetail, momentHeadline } from '../momentText';
import { MOMENT_COLORS as C } from './colors';
import { Headline, margin, Mono, Typed, unit, type Size } from './parts';
import { outExpo, seg } from './timeline';

export type FocusBar = { name: string; focusedMs: number };
/** How many bars fit above the big readout. */
export const MAX_BARS = 3;

type Props = { moment: Extract<Moment, { kind: 'longest' }>; lt: SharedValue<number>; size: Size; bars: readonly FocusBar[] };

function Row({ bar, i, max, lead, lt, size }: { bar: FocusBar; i: number; max: number; lead: boolean; lt: SharedValue<number>; size: Size }) {
  const { w, h } = size;
  const x0 = margin(size);
  const rw = w - x0 * 2;
  const rh = h * 0.075;
  const y = h * 0.22 + i * rh * 1.5;
  const fs = Math.max(10, unit(size) * 0.035);
  const fill = useAnimatedStyle(() => ({ width: (rw * bar.focusedMs * outExpo(seg(lt.value, 0.2 + i * 0.15, 1 + i * 0.15))) / max }));
  return (
    <>
      <Mono lt={lt} text={bar.name.toUpperCase()} x={[x0, x0 + rw * 0.7]} y={y} size={fs} color={lead ? C.white : C.steel} from={0.1 + i * 0.1} to={0.4 + i * 0.1} />
      <Mono lt={lt} text={formatHM(bar.focusedMs)} x={[x0 + rw * 0.6, x0 + rw]} y={y} size={fs} color={lead ? C.yellow : C.steel} align="right" from={0.1 + i * 0.1} to={0.4 + i * 0.1} />
      <View style={{ position: 'absolute', left: x0, width: rw, top: y + rh * 0.38, height: rh * 0.32, backgroundColor: C.edge }}>
        <Animated.View style={[{ height: '100%', backgroundColor: lead ? C.yellow : 'rgba(242,243,245,0.5)' }, fill]} />
      </View>
    </>
  );
}

/** Longest task: bars of today's timed tasks by focus (the winner in yellow), the big H:MM, the headline. */
export function Longest({ moment, lt, size, bars }: Props) {
  const { w, h } = size;
  const u = unit(size);
  const rows = (bars.length > 0 ? bars : [{ name: moment.name, focusedMs: moment.focusedMs }]).slice(0, MAX_BARS);
  const max = Math.max(1, ...rows.map((b) => b.focusedMs));
  return (
    <>
      {rows.map((b, i) => (
        <Row key={`${b.name}-${i}`} bar={b} i={i} max={max} lead={i === 0} lt={lt} size={size} />
      ))}
      <Mono lt={lt} text={formatHM(moment.focusedMs)} x={[0, w]} y={h * 0.56} size={u * 0.2} color={C.white} align="center" from={1.2} to={1.5} />
      <Mono lt={lt} text={`${moment.name.toUpperCase()} · H:MM`} x={[0, w]} y={h * 0.635} size={Math.max(10, u * 0.03)} align="center" from={1.3} to={1.6} />
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={1.5} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.0} />
    </>
  );
}
