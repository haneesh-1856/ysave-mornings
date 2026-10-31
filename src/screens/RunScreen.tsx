import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { extraMinutesLabel, isGold, minutesLeftLabel, overtimeMs, remainingMs } from '@/domain/timer';
import type { DayTask, Session } from '@/domain/types';
import { setDayTaskNote } from '@/state/actions/plan';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '@/state/actions/run';
import { now } from '@/state/clock';
import { ValidationError } from '@/state/errors';
import { useNow } from '@/state/hooks/useNow';
import { useRunTask } from '@/state/hooks/useRunTask';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useToday } from '@/state/hooks/useToday';
import type { TodayRow } from '@/state/hooks/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { BigNumber } from '@/ui/BigNumber';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Celebration } from '@/ui/Celebration';
import { Collection } from '@/ui/collection/Collection';
import { CountdownBar } from '@/ui/CountdownBar';
import { weekdayName } from '@/ui/dayNames';
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
  'check-open': 'To do', 'check-done': 'Done',
} as const;

// Leaving Run never pauses (doc 04 section 4): the session keeps running from its stored timestamp.
const goToday = () => router.dismissTo('/(tabs)/today');

/** Route wrapper: reads the param. */
export function RunRoute() {
  const { dayTaskId } = useLocalSearchParams<{ dayTaskId: string }>();
  return <RunScreen dayTaskId={dayTaskId} />;
}

/** The task page: one day task, timed or checklist, with its notes and its action. Read-only once the day is closed. */
export function RunScreen({ dayTaskId }: { dayTaskId: string | undefined }) {
  const run = useRunTask(dayTaskId ?? '');
  const row = run?.row ?? null;
  if (!dayTaskId || !row) {
    return (
      <Screen>
        <Header title="This task isn't on today's list" />
        <T>It may have been moved or removed.</T>
        <Button label="Back" onPress={goToday} />
      </Screen>
    );
  }
  return (
    <RunBody
      dayTask={row.dayTask}
      state={row.state}
      sessions={row.sessions}
      topicName={row.topicName}
      libraryNote={run?.note ?? ''}
      closed={run?.day?.closedAt != null}
    />
  );
}

type BodyProps = {
  dayTask: DayTask;
  state: TodayRow['state'];
  sessions: Session[];
  topicName: string;
  libraryNote: string;
  closed: boolean;
};

function RunBody({ dayTask, state, sessions, topicName, libraryNote, closed }: BodyProps) {
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

  const noteEditor = useNoteEditor(dayTask.id, dayTask.note ?? '');
  const weekday = weekdayName(dayTask.dayKey);
  const leave = () => { noteEditor.flush(); goToday(); };

  const timed = dayTask.kind === 'timed';
  const gold = state === 'stopped' && isGold(dayTask.budgetSec, sessions, now());

  let button;
  if (closed) button = <Button label="Back to Today" onPress={leave} />;
  else if (!timed) {
    button = done
      ? <Button label="Mark not done" kind="ghost" disabled={guard.busy} onPress={() => act(toggleCheckTask)} />
      : <Button testID="task-mark-done" label="Mark done" disabled={guard.busy} onPress={() => act(toggleCheckTask)} />;
  } else if (state === 'idle') button = <Button testID="run-start" label="Start" disabled={guard.busy} onPress={() => act(startTask)} />;
  else if (state === 'running') button = <Button label="Pause" kind="ghost" disabled={guard.busy} onPress={() => act(pauseTask)} />;
  else if (state === 'paused') button = <Button label="Resume" disabled={guard.busy} onPress={() => act(startTask)} />;
  else if (state === 'overtime') button = <Button label="Stop" disabled={guard.busy} onPress={() => act(stopTask)} />;
  else button = <Button label="Back to Today" onPress={leave} />;

  return (
    <Screen footer={button}>
      <Pressable testID="run-back" accessibilityRole="button" accessibilityLabel="Today" onPress={leave} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
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
      {dayTask.forwardedFromDayKey ? <T variant="sub">{`from ${weekdayName(dayTask.forwardedFromDayKey)}`}</T> : null}
      {closed ? <T variant="sub">Today is closed. It is read-only now.</T> : null}
      {libraryNote ? (
        <Card>
          <T variant="label">Library note</T>
          <T>{libraryNote}</T>
        </Card>
      ) : null}
      <NoteCard editor={noteEditor} weekday={weekday} readOnly={closed} />

      {timed ? <RunClock dayTask={dayTask} sessions={sessions} /> : null}
      <Celebration visible={done} />
      {gold ? <T weight="bold" color="accent" style={{ textAlign: 'center' }}>Gold ring earned</T> : null}
      {error ? <T variant="sub" color="danger" accessibilityRole="alert" style={{ textAlign: 'center' }}>{error}</T> : null}
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

/** The day note's draft: raw text while editing (the action turns blank into null), saved after a pause and on leave/unmount. */
function useNoteEditor(dayTaskId: string, saved: string): NoteEditor {
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
    if (value === null) return;
    pending.current = null;
    try {
      setDayTaskNote(dayTaskId, value);
      setError(null);
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else throw e;
    }
  }, [dayTaskId]);

  useEffect(() => flush, [flush]); // unmount flush
  useEffect(() => {
    // Backgrounding may be the last chance before the OS kills the app.
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') flush(); });
    return () => sub.remove();
  }, [flush]);

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

function NoteCard({ editor, weekday, readOnly }: { editor: NoteEditor; weekday: string; readOnly: boolean }) {
  const label = `Note for ${weekday}`;
  if (readOnly) {
    if (!editor.text) return null;
    return (
      <Card>
        <T variant="label">{label}</T>
        <T>{editor.text}</T>
      </Card>
    );
  }
  if (editor.editing) {
    return (
      <Card>
        <TextField label={label} value={editor.text} onChangeText={editor.change} maxLength={NOTE_MAX} multiline error={editor.error ?? undefined} />
      </Card>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={editor.text ? `${label}: ${editor.text}. Tap to edit` : `${label}. Tap to add a note`} onPress={editor.begin}>
      <Card>
        <T variant="label">{label}</T>
        <T variant={editor.text ? 'body' : 'sub'}>{editor.text || 'Tap to add a note'}</T>
      </Card>
    </Pressable>
  );
}
