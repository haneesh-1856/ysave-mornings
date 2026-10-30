import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { extraMinutesLabel, isGold, minutesLeftLabel, overtimeMs, remainingMs } from '@/domain/timer';
import type { DayTask, Session } from '@/domain/types';
import { setTaskNoteFromPlan } from '@/state/actions/plan';
import { pauseTask, startTask, stopTask } from '@/state/actions/run';
import { now } from '@/state/clock';
import { ValidationError } from '@/state/errors';
import { useNow } from '@/state/hooks/useNow';
import { useRunTask } from '@/state/hooks/useRunTask';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useToday } from '@/state/hooks/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { BigNumber } from '@/ui/BigNumber';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Celebration } from '@/ui/Celebration';
import { Collection } from '@/ui/collection/Collection';
import { CountdownBar } from '@/ui/CountdownBar';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';
import { TextField } from '@/ui/TextField';

const NOTE_MAX = 1000;
const NOTE_DEBOUNCE_MS = 600;
const COOLDOWN_MS = 500; // buttons stay locked this long after a press: a fast second tap must not undo the first
const KEEP_AWAKE_TAG = 'run-screen';

const STATE_LABEL = {
  idle: 'Ready', running: 'Running', paused: 'Paused', overtime: 'Done · still going', stopped: 'Done',
} as const;

// Leaving Run never pauses (doc 04 section 4): the session keeps running from its stored timestamp.
const goToday = () => router.dismissTo('/(tabs)/today');

/** Route wrapper: reads the param. */
export function RunRoute() {
  const { dayTaskId } = useLocalSearchParams<{ dayTaskId: string }>();
  return <RunScreen dayTaskId={dayTaskId} />;
}

export function RunScreen({ dayTaskId }: { dayTaskId: string | undefined }) {
  const run = useRunTask(dayTaskId ?? '');
  const row = run?.row ?? null;
  if (!dayTaskId || !row || row.dayTask.kind !== 'timed') {
    return (
      <Screen>
        <Header title="This task isn't running today" />
        <T>It is not on today&apos;s list, or it is a checklist task (tick those on Today).</T>
        <Button label="Back" onPress={goToday} />
      </Screen>
    );
  }
  return (
    <RunBody
      dayTask={row.dayTask}
      state={row.state === 'check-open' || row.state === 'check-done' ? 'idle' : row.state}
      sessions={row.sessions}
      topicName={row.topicName}
      note={run?.note ?? ''}
    />
  );
}

type BodyProps = {
  dayTask: DayTask;
  state: 'idle' | 'running' | 'paused' | 'overtime' | 'stopped';
  sessions: Session[];
  topicName: string;
  note: string;
};

function RunBody({ dayTask, state, sessions, topicName, note }: BodyProps) {
  const t = useTheme();
  const { day, items } = useToday();
  const done = dayTask.completedAt !== null;
  const [openedDone] = useState(done); // a marble only drops for a completion seen on this screen
  const guard = useSubmitGuard();
  const [error, setError] = useState<string | null>(null);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (cooldown.current) clearTimeout(cooldown.current); }, []);

  // The screen stays awake while a session is open (running, or counting overtime); released on pause/stop/leave.
  const awake = state === 'running' || state === 'overtime';
  useEffect(() => {
    if (!awake) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => { deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {}); };
  }, [awake]);

  const act = (fn: (id: string) => void) => {
    try {
      const ran = guard.run(() => { fn(dayTask.id); return true; });
      if (ran) {
        setError(null);
        cooldown.current = setTimeout(guard.reset, COOLDOWN_MS);
      }
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    }
  };

  const noteEditor = useNoteEditor(dayTask.taskId, note);
  const leave = () => { noteEditor.flush(); goToday(); };

  const gold = state === 'stopped' && isGold(dayTask.budgetSec, sessions, now());

  let button;
  if (state === 'idle') button = <Button label="Start" disabled={guard.busy} onPress={() => act(startTask)} />;
  else if (state === 'running') button = <Button label="Pause" kind="ghost" disabled={guard.busy} onPress={() => act(pauseTask)} />;
  else if (state === 'paused') button = <Button label="Resume" disabled={guard.busy} onPress={() => act(startTask)} />;
  else if (state === 'overtime') button = <Button label="Stop" disabled={guard.busy} onPress={() => act(stopTask)} />;
  else button = <Button label="Back to Today" onPress={leave} />;

  return (
    <Screen footer={button}>
      <Pressable accessibilityRole="button" accessibilityLabel="Today" onPress={leave} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Today</T>
      </Pressable>
      <T variant="label" accessibilityLiveRegion="polite">{STATE_LABEL[state]}</T>
      <Header title={dayTask.name} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.topic(dayTask.colorKey).color }} />
        <T variant="sub">{topicName}</T>
      </View>
      {dayTask.cue ? <T variant="sub">{`Cue: ${dayTask.cue}`}</T> : null}
      {dayTask.treat ? (
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: t.radius.rb, backgroundColor: t.c.tint3 }}>
          <T variant="sub" weight="bold">{`Treat: ${dayTask.treat}`}</T>
        </View>
      ) : null}
      {dayTask.taskId ? <NoteCard editor={noteEditor} /> : null}

      <RunClock dayTask={dayTask} sessions={sessions} />
      <Celebration visible={done} />
      {gold ? <T weight="bold" color="accent" style={{ textAlign: 'center' }}>Gold ring earned</T> : null}
      {error ? <T variant="sub" accessibilityRole="alert" style={{ color: '#d4574e', textAlign: 'center' }}>{error}</T> : null}
      {done ? (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Collection items={items} closed={day?.closedAt != null} scale={1.2} animateLast={!openedDone} />
        </View>
      ) : null}
    </Screen>
  );
}

/** Big number + bar. Only an open session ticks; the ticking child re-renders alone, never the screen. */
function RunClock({ dayTask, sessions }: { dayTask: DayTask; sessions: Session[] }) {
  const live = sessions.some((s) => s.endedAt === null);
  return live ? <LiveFace dayTask={dayTask} sessions={sessions} /> : <ClockFace dayTask={dayTask} sessions={sessions} at={now()} />;
}

function LiveFace({ dayTask, sessions }: { dayTask: DayTask; sessions: Session[] }) {
  const at = useNow();
  return <ClockFace dayTask={dayTask} sessions={sessions} at={at} />;
}

function ClockFace({ dayTask, sessions, at }: { dayTask: DayTask; sessions: Session[]; at: number }) {
  const t = useTheme();
  const rem = remainingMs(dayTask.budgetSec, sessions, at);
  const over = overtimeMs(dayTask.budgetSec, sessions, at);
  const extra = dayTask.completedAt !== null && rem <= 0;
  return (
    <View style={{ gap: 14, paddingVertical: 8 }}>
      <BigNumber
        value={extra ? `+${extraMinutesLabel(over)}` : `${minutesLeftLabel(rem)}`}
        caption={extra ? 'min extra' : 'min left'}
      />
      <CountdownBar budgetMs={dayTask.budgetSec * 1000} remainingMs={Math.max(0, rem)} overtimeMs={over} variant={t.look.bar} />
    </View>
  );
}

type NoteEditor = { text: string; editing: boolean; error: string | null; begin(): void; change(s: string): void; flush(): void };

/** Note draft with a debounced save to the library task (setTaskNoteFromPlan); flushed on leave and unmount. */
function useNoteEditor(taskId: string | null, saved: string): NoteEditor {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = pending.current;
    if (value === null || taskId === null) return;
    pending.current = null;
    try {
      setTaskNoteFromPlan(taskId, value);
      setError(null);
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    }
  }, [taskId]);

  useEffect(() => flush, [flush]); // unmount flush

  return {
    text: editing ? draft : saved,
    editing,
    error,
    begin: () => {
      setDraft(saved);
      setEditing(true);
    },
    change: (s) => {
      setDraft(s);
      pending.current = s;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, NOTE_DEBOUNCE_MS);
    },
    flush,
  };
}

function NoteCard({ editor }: { editor: NoteEditor }) {
  if (editor.editing) {
    return (
      <Card>
        <TextField label="Note" value={editor.text} onChangeText={editor.change} maxLength={NOTE_MAX} multiline error={editor.error ?? undefined} />
      </Card>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={editor.text ? `Note: ${editor.text}. Tap to edit` : 'Add a note'} onPress={editor.begin}>
      <Card>
        <T variant="label">Note</T>
        <T variant={editor.text ? 'body' : 'sub'}>{editor.text || 'Tap to add a note'}</T>
      </Card>
    </Pressable>
  );
}
