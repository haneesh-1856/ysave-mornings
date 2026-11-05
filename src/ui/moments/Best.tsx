import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { Moment } from '@/domain/moments';

import { formatHM, momentDetail, momentHeadline } from '../momentText';
import { BEST_SLOTS, BEST_STILL_AT, bestLabelAt, bestLabelSizes, bestSceneDraw, bestGlowAt } from './bestScene';
import { MOMENT_COLORS as C } from './colors';
import { Headline, Typed, type Size } from './parts';
import { Label3D, Scene3D, Glow3D } from './Scene3D';

type Props = { moment: Extract<Moment, { kind: 'best' }>; lt: SharedValue<number>; size: Size };

/** Personal best: the last 13 days under a glass plane at the previous best, today's gold column breaking through it. */
export function Best({ moment, lt, size }: Props) {
  const { recentMs, todayMs, previousBestMs } = moment;
  // Built once per moment: a new array every render would restart Scene3D's animated draw.
  const data = useMemo(() => [...recentMs, todayMs, previousBestMs], [recentMs, todayMs, previousBestMs]);
  const labels = useMemo((): [number[], string, number, string][] => {
    const f = bestLabelSizes(size);
    return [
      [[0, todayMs, previousBestMs], `BEST ${formatHM(previousBestMs)}`, f.best, C.steel],
      [[1, todayMs, previousBestMs], formatHM(todayMs), f.today, C.white],
      [[2, todayMs, previousBestMs], `+${formatHM(todayMs - previousBestMs)}`, f.delta, C.yellow],
    ];
  }, [size, todayMs, previousBestMs]);
  return (
    <>
      <Scene3D lt={lt} size={size} slots={BEST_SLOTS} draw={bestSceneDraw} data={data} freezeAt={BEST_STILL_AT} />
      <Glow3D lt={lt} at={bestGlowAt} data={data} size={size} />
      {labels.map(([d, text, fs, color]) => (
        <Label3D key={d[0]} lt={lt} at={bestLabelAt} data={d} size={fs} screen={size} text={text} color={color} align={d[0] === 0 ? 'left' : 'center'} />
      ))}
      <Headline lt={lt} size={size} text={momentHeadline(moment)} from={2.05} />
      <Typed lt={lt} size={size} text={momentDetail(moment)} from={2.55} />
    </>
  );
}
