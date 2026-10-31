import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { addDays } from '@/domain/dayKey';
import { isGold, overtimeMs, remainingMs } from '@/domain/timer';
import type { DayTask, Epoch } from '@/domain/types';
import { now } from '@/state/clock';
import { useChain } from '@/state/hooks/useChain';
import { useDayPlan } from '@/state/hooks/useDayPlan';
import { useNow } from '@/state/hooks/useNow';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { usePlanTopics } from '@/state/hooks/usePlanTopics';
import { useCompletionWatcher } from '@/state/hooks/useRunTask';
import { useToday } from '@/state/hooks/useToday';
import type { TodayRow } from '@/state/hooks/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chain } from '@/ui/Chain';
import { Collection } from '@/ui/collection/Collection';
import { collectionNoun } from '@/ui/collectionNoun';
import { CheckRow } from '@/ui/CheckRow';
import { weekdayName } from '@/ui/dayNames';
import { Dock } from '@/ui/Dock';
import { Fold } from '@/ui/Fold';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { REMOVED_TOPIC } from '@/ui/PlannedList';
import { T } from '@/ui/T';
import { TaskRow } from '@/ui/TaskRow';
import { extraText, minutesLeftText } from '@/ui/timeText';

const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

/**
 * Once today is closed, the Today tab is where tomorrow is looked for: list tomorrow's stored rows (moved tasks
 * "from <weekday>" included) so nothing planned for tomorrow is hidden behind a count.
 */
function TomorrowTasks({ rows, topicName }: { rows: DayTask[]; topicName: (id: string) => string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {rows.map((r) => {
        const from = r.forwardedFromDayKey ? `from ${weekdayName(r.forwardedFromDayKey)}` : null;
        return (
          <View
            key={r.id}
            accessible
            accessibilityLabel={`Tomorrow: ${r.name}${from ? `, ${from}` : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.topic(r.colorKey).color }} />
            <View style={{ flex: 1 }}>
              <T numberOfLines={1}>{r.name}</T>
              <T variant="sub">{from ? `${topicName(r.topicId)} · ${from}` : topicName(r.topicId)}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

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

type TimedProps = { row: TodayRow; at: Epoch; onOpen: (dayTaskId: string) => void };

/** A timed row evaluated at a fixed instant. Only RunningRow feeds it a ticking instant. */
function TimedRowAt({ row, at, onOpen }: TimedProps) {
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
      a11yLabel={timedLabel(dayTask.name, minutes, state, left, over, gold)}
    />
  );
}

/** The running row owns the 1 Hz clock and the hit-zero watcher, so nothing else re-renders each second. */
function RunningRow({ row, onOpen }: { row: TodayRow; onOpen: (dayTaskId: string) => void }) {
  const at = useNow();
  useCompletionWatcher(row);
  return <TimedRowAt row={row} at={at} onOpen={onOpen} />;
}

// Every row opens its task page, closed day included (the page is read-only then).
const TimedRow = memo(function TimedRow({ row, onOpen }: { row: TodayRow; onOpen: (id: string) => void }) {
  return row.state === 'running'
    ? <RunningRow row={row} onOpen={onOpen} />
    : <TimedRowAt row={row} at={now()} onOpen={onOpen} />;
});

const CheckTaskRow = memo(function CheckTaskRow({ row, onOpen }: { row: TodayRow; onOpen: (id: string) => void }) {
  const from = row.dayTask.forwardedFromDayKey;
  const moved = row.dayTask.closeOutcome === 'moved';
  return (
    <CheckRow
      name={row.dayTask.name}
      topicColor={row.dayTask.colorKey}
      done={row.state === 'check-done'}
      forwardedFrom={from ? weekdayName(from) : undefined}
      movedTo={moved ? weekdayName(addDays(row.dayTask.dayKey, 1)) : undefined}
      onPress={() => onOpen(row.dayTask.id)}
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
  const planTopics = usePlanTopics();
  const [shut, setShut] = useState<Record<string, boolean>>({});

  const plan = (dayKey: string) => router.push({ pathname: '/plan/[dayKey]', params: { dayKey } });
  const see = (dayKey: string) => router.push({ pathname: '/planned/[dayKey]', params: { dayKey } });
  const openRun = useCallback(
    (dayTaskId: string) => router.push({ pathname: '/run/[dayTaskId]', params: { dayTaskId } }),
    [],
  );
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
  const { layout, art } = useTheme().look;
  const noun = collectionNoun(art);
  const n = items.length;
  const goClose = () => router.push('/close');
  const showClose = !closed && !empty;
  const closeButton = showClose ? <Button testID="today-close" label="Close today" kind="ghost" onPress={goClose} /> : null;

  return (
    <Screen tabs footer={layout === 'dock' ? <Dock items={items} closed={closed} onClose={showClose ? goClose : undefined} /> : undefined}>
      <Chain links={chain} />
      <Header title="Today" note={empty ? undefined : `${done} of ${total} done`} />
      {closed ? (
        <Card>
          <T weight="bold">Today is closed</T>
          <T variant="sub">It is read-only now.</T>
        </Card>
      ) : null}
      {layout === 'hero' ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Collection items={items} closed={closed} scale={1} animateLast />
          <T variant="sub">{`${n} in today's ${noun}`}</T>
        </View>
      ) : null}
      {canEditToday && !todayPlanned ? <Button testID="today-plan-today" label="Plan today" onPress={() => plan(todayKey)} /> : null}
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
          {closed ? (
            <TomorrowTasks
              rows={tomorrowPlan.rows}
              topicName={(id) => planTopics.find((x) => x.id === id)?.name ?? REMOVED_TOPIC}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="See" kind="ghost" onPress={() => see(tomorrow)} />
            <Button label="Edit" kind="ghost" onPress={() => plan(tomorrow)} />
          </View>
        </Card>
      ) : null}
      <Button testID="today-plan-tomorrow" label="Plan tomorrow" kind={tomorrowPlanned ? 'ghost' : 'primary'} onPress={() => plan(tomorrow)} />
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
                <TimedRow key={r.dayTask.id} row={r} onOpen={openRun} />
              ) : (
                <CheckTaskRow key={r.dayTask.id} row={r} onOpen={openRun} />
              ),
            )}
          </Fold>
        );
      })}
      {layout === 'hero' ? closeButton : null}
      {layout === 'corner' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {closeButton}
          <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
            <T variant="label" importantForAccessibility="no">{`Today's ${noun} · ${n}`}</T>
            <Collection items={items} closed={closed} scale={0.62} animateLast />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
