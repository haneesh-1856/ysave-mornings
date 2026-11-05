import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { formatHM, momentDetail, momentHeadline } from '../momentText';
import { MOMENT_COLORS as C } from './colors';
import { Headline, margin, Roll, Typed, unit, type Size } from './parts';
import { seg } from './timeline';

type Props = { moment: Extract<Moment, { kind: 'day' }>; lt: SharedValue<number>; size: Size; settled: boolean };

function Segment({ i, lit, x, y, sw, sh, lt }: { i: number; lit: boolean; x: number; y: number; sw: number; sh: number; lt: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const k = seg(lt.value, 1.2 + i * 0.1, 1.35 + i * 0.1);
    return { opacity: lit && k > 0 ? 0.4 + 0.6 * k : 0 };
  });
  return (
    <View style={{ position: 'absolute', left: x + i * sw + 2, top: y, width: sw - 4, height: sh, backgroundColor: C.edge }}>
      <Animated.View style={[{ flex: 1, backgroundColor: C.yellow }, style]} />
    </View>
  );
}

/** Day complete: rolling tasks and focus readouts, a bar with one segment per task, the headline. */
export function Day({ moment, lt, size, settled }: Props) {
  const { w, h } = size;
  const fs = w * 0.17;
  const cy = h * 0.34;
  const sw = (w * 0.86) / Math.max(1, moment.total);
  return (
    <>
      <Roll text={`${moment.done}/${moment.total}`} x={w * 0.29} y={cy} fs={fs} from={0.2} label="TASKS" lt={lt} settled={settled} size={size} />
      <Roll text={formatHM(moment.focusedMs)} x={w * 0.71} y={cy} fs={fs} from={0.45} label="FOCUS H:MM" lt={lt} settled={settled} size={size} />
      {Array.from({ length: moment.total }, (_, i) => (
        <Segment key={i} i={i} lit={i < moment.done} x={margin(size)} y={cy + fs * 1.0} sw={sw} sh={unit(size) * 0.014} lt={lt} />
      ))}
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={1.8} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.3} />
    </>
  );
}
