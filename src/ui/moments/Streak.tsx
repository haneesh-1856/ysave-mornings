import type { SharedValue } from 'react-native-reanimated';

import { STREAK_MAX_STEPS, streakWeekdays, type Moment } from '@/domain/moments';

import { momentDetail, momentHeadline } from '../momentText';
import { MOMENT_COLORS as C } from './colors';
import { Headline, margin, Mono, Typed, unit, type Size } from './parts';
import { Label3D, Scene3D, Glow3D } from './Scene3D';
import { STREAK_LABELLED, STREAK_SLOTS, STREAK_STILL_AT, streakLabelOf, streakLabelSize, streakSceneDraw, streakGlowAt } from './streakScene';
import { WEEK_LETTERS } from './weekScene';

type Props = { moment: Extract<Moment, { kind: 'streak' }>; lt: SharedValue<number>; size: Size };

/** Streak: a spiral stair, a step per day (up to 21), today's on top in gold, the latest week's steps labelled with their weekday. */
export function Streak({ moment, lt, size }: Props) {
  const days = streakWeekdays(moment);
  const n = days.length;
  const fs = streakLabelSize(size, n);
  return (
    <>
      <Scene3D lt={lt} size={size} slots={STREAK_SLOTS} draw={streakSceneDraw} data={n} freezeAt={STREAK_STILL_AT} />
      <Glow3D lt={lt} at={streakGlowAt} data={n} size={size} />
      {days.map((wd, i) => i < n - STREAK_LABELLED ? null : (
        <Label3D
          key={i} lt={lt} at={streakLabelOf} data={[i, n]} size={fs} screen={size}
          text={i === n - 1 ? `${WEEK_LETTERS[wd]} · TODAY` : WEEK_LETTERS[wd]} color={C.steel}
        />
      ))}
      {moment.days > STREAK_MAX_STEPS ? (
        <Mono lt={lt} text={`LAST ${STREAK_MAX_STEPS} DAYS`} y={size.h * 0.675} size={Math.max(9, unit(size) * 0.026)} x={[margin(size), size.w - margin(size)]} align="center" from={0.6} to={0.9} />
      ) : null}
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={1.95} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.45} />
    </>
  );
}
