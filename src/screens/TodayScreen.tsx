import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { addDays } from '@/domain/dayKey';
import { isGold, overtimeMs, remainingMs } from '@/domain/timer';
import type { Epoch } from '@/domain/types';
import { toggleCheckTask } from '@/state/actions/run';
import { now } from '@/state/clock';
import { ValidationError } from '@/state/errors';
import { useChain } from '@/state/hooks/useChain';
import { useDayPlan } from '@/state/hooks/useDayPlan';
import { useNow } from '@/state/hooks/useNow';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { useCompletionWatcher } from '@/state/hooks/useRunTask';
import { useToday } from '@/state/hooks/useToday';
import type { TodayRow } from '@/state/hooks/useToday';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chain } from '@/ui/Chain';
import { CheckRow } from '@/ui/CheckRow';
import { weekdayName } from '@/ui/dayNames';
import { Dock } from '@/ui/Dock';
import { Fold } from '@/ui/Fold';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';
import { TaskRow } from '@/ui/TaskRow';
import { extraText, minutesLeftText } from '@/ui/timeText';

const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

type Timed = Exclude<TodayRow['state'], 'check-open' | 'check-done'>;

function timedLabel(name: string, minutes: number, state: Timed, left: number, over: number, gold: boolean): string {
  const mark = gold ? ', gold' : '';
  switch (state) {
    case 'idle': return `${name}, ${minutes} minutes, start`;
    case 'running': return `${name}, ${minutesLeftText(left)}, running`;
    case 'paused': return `${name}, ${minutesLeftText(left)}, paused`;
    case 'overtime': return `${name}, done, ${extraText(over)}${mark}`;
    case 'stopped': return `${name}, done${mark}`;
  }
}

type TimedProps = { row: TodayRow; at: Epoch; onOpen: (dayTaskId: string) => void; disabled?: boolean };

/** A timed row evaluated at a fixed instant. Only RunningRow feeds it a ticking instant. */
function TimedRowAt({ row, at, onOpen, disabled }: TimedProps) {
  const { dayTask, sessions, state } = row;
  if (state === 'check-open' || state === 'check-done') return null;
  const minutes = Math.round(dayTask.budgetSec / 60);
  const left = remainingMs(dayTask.budgetSec, sessions, at);
  const over = overtimeMs(dayTask.budgetSec, sessions, at);
  const gold = isGold(dayTask.budgetSec, sessions, at);
  return (
    <TaskRow
      name={dayTask.name}
      topicColor={dayTask.colorKey}
      minutes={minutes}
      state={state}
      remainingMs={left}
      overtimeMs={over}
      gold={gold}
      onPress={() => onOpen(dayTask.id)}
      disabled={disabled}
      a11yLabel={timedLabel(dayTask.name, minutes, state, left, over, gold)}
    />
  );
}

/** The running row owns the 1 Hz clock and the hit-zero watcher, so nothing else re-renders each second. */
function RunningRow({ row, onOpen, disabled }: { row: TodayRow; onOpen: (dayTaskId: string) => void; disabled: boolean }) {
  const at = useNow();
  useCompletionWatcher(row);
  return <TimedRowAt row={row} at={at} onOpen={onOpen} disabled={disabled} />;
}

const noop = () => {};

const TimedRow = memo(function TimedRow({ row, onOpen, locked }: { row: TodayRow; onOpen: (id: string) => void; locked: boolean }) {
  // A closed day's rows announce as disabled and do nothing when pressed.
  return row.state === 'running'
    ? <RunningRow row={row} onOpen={onOpen} disabled={locked} />
    : <TimedRowAt row={row} at={now()} onOpen={onOpen} disabled={locked} />;
});

const CheckTaskRow = memo(function CheckTaskRow({ row, onToggle, locked }: { row: TodayRow; onToggle: (id: string) => void; locked: boolean }) {
  const from = row.dayTask.forwardedFromDayKey;
  return (
    <CheckRow
      name={row.dayTask.name}
      topicColor={row.dayTask.colorKey}
      done={row.state === 'check-done'}
      forwardedFrom={from ? weekdayName(from) : undefined}
      onToggle={() => onToggle(row.dayTask.id)}
      disabled={locked}
    />
  );
});

export default function TodayScreen() {
  const { todayKey, closed, rows, done, total, items } = useToday();
  const { days } = usePlannableDays();
  const todayPlan = useDayPlan(todayKey);
  const todayPlanned = todayPlan.day?.planConfirmedAt != null;
  const tomorrow = addDays(todayKey, 1);
  const tomorrowPlan = useDayPlan(tomorrow);
  const tomorrowPlanned = tomorrowPlan.day?.planConfirmedAt != null;
  const chain = useChain();
  const [shut, setShut] = useState<Record<string, boolean>>({});

  const plan = (dayKey: string) => router.push({ pathname: '/plan/[dayKey]', params: { dayKey } });
  const see = (dayKey: string) => router.push({ pathname: '/planned/[dayKey]', params: { dayKey } });
  const openRun = useCallback(
    (dayTaskId: string) => router.push({ pathname: '/run/[dayTaskId]', params: { dayTaskId } }),
    [],
  );
  const toggle = useCallback((dayTaskId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      toggleCheckTask(dayTaskId);
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e; // e.g. the day closed meanwhile: nothing to do
    }
  }, []);

  const groups = useMemo(() => {
    const out: { topicId: string; name: string; rows: TodayRow[] }[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.topicId === r.dayTask.topicId) last.rows.push(r);
      else out.push({ topicId: r.dayTask.topicId, name: r.topicName, rows: [r] });
    }
    return out;
  }, [rows]);

  const canEditToday = days.includes(todayKey) && !closed;
  const empty = rows.length === 0;

  return (
    <Screen tabs footer={<Dock items={items} closed={closed} />}>
      <Chain links={chain} />
      <Header title="Today" note={empty ? undefined : `${done} of ${total} done`} />
      {closed ? (
        <Card>
          <T weight="bold">Today is closed</T>
          <T variant="sub">It is read-only now.</T>
        </Card>
      ) : null}
      {!closed && !empty ? <Button label="Close today" kind="ghost" onPress={() => router.push('/close')} /> : null}
      {canEditToday && !todayPlanned ? <Button label="Plan today" onPress={() => plan(todayKey)} /> : null}
      {todayPlanned ? (
        <Card>
          <T weight="bold">{`Today is planned · ${tasks(todayPlan.rows.length)}`}</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="See" accessibilityLabel="See today's plan" kind="ghost" onPress={() => see(todayKey)} />
            {/* Edit while today is open (ADR-009). */}
            {canEditToday ? (
              <Button label="Edit" accessibilityLabel="Edit today's plan" kind="ghost" onPress={() => plan(todayKey)} />
            ) : null}
          </View>
        </Card>
      ) : null}
      {tomorrowPlanned ? (
        <Card>
          <T weight="bold">{`Tomorrow is planned · ${tasks(tomorrowPlan.rows.length)}`}</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="See" kind="ghost" onPress={() => see(tomorrow)} />
            <Button label="Edit" kind="ghost" onPress={() => plan(tomorrow)} />
          </View>
        </Card>
      ) : null}
      <Button label="Plan tomorrow" kind={tomorrowPlanned ? 'ghost' : 'primary'} onPress={() => plan(tomorrow)} />
      {empty ? <T variant="sub">Nothing planned for today</T> : null}
      {groups.map((g) => {
        const doneInGroup = g.rows.filter((r) => r.dayTask.completedAt !== null).length;
        return (
          <Fold
            key={g.topicId}
            title={g.name}
            colorKey={g.rows[0].dayTask.colorKey}
            subtitle={`${doneInGroup} of ${g.rows.length} done`}
            open={!shut[g.topicId]}
            onToggle={() => setShut((s) => ({ ...s, [g.topicId]: !s[g.topicId] }))}>
            {g.rows.map((r) =>
              r.dayTask.kind === 'timed' ? (
                <TimedRow key={r.dayTask.id} row={r} onOpen={closed ? noop : openRun} locked={closed} />
              ) : (
                <CheckTaskRow key={r.dayTask.id} row={r} onToggle={closed ? noop : toggle} locked={closed} />
              ),
            )}
          </Fold>
        );
      })}
    </Screen>
  );
}
