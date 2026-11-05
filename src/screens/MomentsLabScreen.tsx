import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { weekStartOf } from '@/domain/dayKey';
import type { Moment } from '@/domain/moments';
import { BEST_RECENT_DAYS } from '@/domain/moments';
import { clearTrail, readLastClose, readTrail, saveLabFlags } from '@/state/devLab';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { DEFAULT_LAB_FLAGS, flagsText, getLabFlags, setLabFlags, type LabFlags } from '@/ui/moments/lab';
import { MomentsPlayer } from '@/ui/moments/MomentsPlayer';
import { Screen } from '@/ui/Screen';
import { Switch } from '@/ui/Switch';
import { T } from '@/ui/T';

// Moments lab (dev only, 2026-11-05): play any close moment on its own without closing a day, switch parts of the 3D
// drawing on and off, and read the crash trail the player leaves in the phone's storage. Used to find why Expo Go quits
// on the Pixel 9a as the first 3D scene starts.

const MIN = 60_000;
const TODAY = '2026-11-04';

/** EXAMPLE moments (not your data): one of each kind, with plausible values. */
export function exampleMoments(): Record<Moment['kind'], Moment> {
  const recent = [60, 90, 0, 120, 150, 40, 80, 100, 0, 30, 110, 70, 60].slice(0, BEST_RECENT_DAYS).map((m) => m * MIN);
  return {
    longest: { kind: 'longest', name: 'Deep work', colorKey: 'study', focusedMs: 95 * MIN, budgetSec: 90 * 60 },
    day: { kind: 'day', done: 4, total: 4, focusedMs: 185 * MIN, closedAt: Date.parse(`${TODAY}T21:00:00`) },
    best: { kind: 'best', todayMs: 185 * MIN, previousBestMs: 150 * MIN, recentMs: recent },
    streak: { kind: 'streak', days: 14, endDayKey: TODAY },
    week: {
      kind: 'week', weekStart: weekStartOf(TODAY), tasksDone: 18, focusedMs: 760 * MIN, goldRings: 5, daysShowedUp: 7,
      dailyMs: [120, 150, 95, 185, 60, 80, 70].map((m) => m * MIN),
    },
    month: {
      kind: 'month', monthKey: TODAY.slice(0, 7), monthFocusMs: 0, goalHours: 8, daysShowedUp: 4,
      dailyMs: [150, 0, 200, 185].map((m) => m * MIN),
    },
  };
}

function withTotals(m: Moment): Moment {
  return m.kind === 'month' ? { ...m, monthFocusMs: m.dailyMs.reduce((a, v) => a + v, 0) } : m;
}

type Play = { moments: Moment[]; bars: { name: string; focusedMs: number }[] };
const EXAMPLE_BARS = [
  { name: 'Deep work', focusedMs: 95 * MIN },
  { name: 'Workout', focusedMs: 50 * MIN },
  { name: 'Reading', focusedMs: 40 * MIN },
];

const time = (at: number) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function MomentsLabScreen() {
  const t = useTheme();
  const [flags, setFlags] = useState<LabFlags>(getLabFlags());
  const [play, setPlay] = useState<Play | null>(null);
  const [trail, setTrail] = useState(readTrail);
  const last = readLastClose();
  const ex = exampleMoments();

  const change = (patch: Partial<LabFlags>) => {
    const next = setLabFlags({ ...flags, ...patch });
    saveLabFlags(next);
    setFlags(next);
  };
  const done = useCallback(() => {
    setPlay(null);
    setTrail(readTrail());
  }, []);
  const start = (moments: Moment[], bars = EXAMPLE_BARS) => setPlay({ moments: moments.map(withTotals), bars });

  return (
    <Screen>
      {play ? <MomentsPlayer moments={play.moments} bars={play.bars} onDone={done} /> : null}
      <Header title="Moments lab" note="Dev only" />

      <Card>
        <T variant="label">Crash trail</T>
        <T variant="sub">The last steps the player reached, saved as they happen. After a crash, reopen the app and look here.</T>
        {trail.length === 0 ? <T variant="sub">Empty.</T> : null}
        {trail.slice(-25).map((s, i) => (
          <T key={i} variant="sub" style={{ fontVariant: ['tabular-nums'] }}>
            {time(s.at)} · {s.step}
          </T>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button label="Refresh" kind="ghost" onPress={() => setTrail(readTrail())} />
          <Button label="Clear" kind="ghost" onPress={() => { clearTrail(); setTrail([]); }} />
        </View>
      </Card>

      <Card>
        <T variant="label">Play</T>
        {last ? (
          <Button label={`Replay last close (${last.moments.map((m) => m.kind).join(', ')})`} onPress={() => start(last.moments, last.bars)} />
        ) : (
          <T variant="sub">No close recorded yet. The next close by hand is kept here to replay.</T>
        )}
        <T variant="sub">Example moments (made-up values, not your data):</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['longest', 'day', 'best', 'streak', 'week', 'month'] as const).map((k) => (
            <Button key={k} label={k} kind="ghost" onPress={() => start([ex[k]])} />
          ))}
          <Button label="day → best (like your close)" kind="ghost" onPress={() => start([ex.longest, ex.day, ex.best])} />
          <Button label="All six" kind="ghost" onPress={() => start(Object.values(ex))} />
        </View>
      </Card>

      <Card>
        <T variant="label">3D drawing switches</T>
        <T variant="sub" style={{ color: t.c.muted }}>Now: {flagsText(flags)}</T>
        <Switch label="Draw the 3D scene" value={flags.scene3d} onChange={(v) => change({ scene3d: v })} />
        <Switch label="Dashed lines (animated dashes)" value={flags.dashes} onChange={(v) => change({ dashes: v })} />
        <Switch label="Floating 3D labels" value={flags.labels} onChange={(v) => change({ labels: v })} />
        <Switch label="Glow around the gold" value={flags.glow} onChange={(v) => change({ glow: v })} />
        <T variant="sub">Colours of the 3D shapes:</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {([['animated', 'As designed'], ['fixed', 'One fixed grey']] as const).map(([k, label]) => (
            <Button key={k} label={flags.colors === k ? `✓ ${label}` : label} kind={flags.colors === k ? 'primary' : 'ghost'} onPress={() => change({ colors: k })} />
          ))}
        </View>
        <Button label="Reset switches" kind="ghost" onPress={() => change(DEFAULT_LAB_FLAGS)} />
      </Card>

      <Button label="Back" kind="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))} />
    </Screen>
  );
}
