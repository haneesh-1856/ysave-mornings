import type { SharedValue } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { formatHM, momentDetail, momentHeadline } from '../momentText';
import { Headline, margin, Roll, Typed, unit, type Size } from './parts';
import { Label3D, Scene3D, Glow3D } from './Scene3D';
import { MOMENT_COLORS as C } from './colors';
import { WEEK_LETTERS, WEEK_SLOTS, WEEK_STILL_AT, weekLetterAt, weekSceneDraw, weekGlowAt } from './weekScene';

type Props = { moment: Extract<Moment, { kind: 'week' }>; lt: SharedValue<number>; size: Size; settled: boolean };

/** Week complete: the 3D dial (a wedge per day, Sunday locks gold), four rolling readouts, the headline. */
export function Week({ moment, lt, size, settled }: Props) {
  const { w, h } = size;
  const fs = unit(size) * 0.055;
  const reads: [string, string][] = [
    ['TASKS DONE', String(moment.tasksDone)],
    ['FOCUS H:MM', formatHM(moment.focusedMs)],
    ['GOLD RINGS', String(moment.goldRings)],
    ['DAYS SHOWED UP', `${moment.daysShowedUp} / 7`],
  ];
  const colX = [margin(size) + w * 0.2, w - margin(size) - w * 0.2];
  return (
    <>
      <Scene3D lt={lt} size={size} slots={WEEK_SLOTS} draw={weekSceneDraw} data={moment.dailyMs} freezeAt={WEEK_STILL_AT} />
      <Glow3D lt={lt} at={weekGlowAt} data={moment.dailyMs} size={size} />
      {WEEK_LETTERS.map((ch, i) => (
        <Label3D key={i} lt={lt} at={weekLetterAt} data={i} text={ch} size={Math.max(9, unit(size) * 0.03)} color={C.steel} screen={size} />
      ))}
      {reads.map(([label, text], i) => (
        <Roll key={label} text={text} x={colX[i % 2]} y={h * 0.585 + Math.floor(i / 2) * h * 0.065} fs={fs} from={0.6 + i * 0.12} label={label} color={i === 0 ? C.yellow : C.white} lt={lt} settled={settled} size={size} />
      ))}
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={2.0} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.5} />
    </>
  );
}
