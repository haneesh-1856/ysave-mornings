import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { isDayKey } from '@/domain/dayKey';
import type { PlanDraft, PlanRow as PlanRowData } from '@/domain/plan';
import type { DayKey } from '@/domain/types';
import { ValidationError } from '@/state/errors';
import { usePlanDraft } from '@/state/hooks/usePlanDraft';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { usePlanTopics } from '@/state/hooks/usePlanTopics';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useTaskNote } from '@/state/hooks/useTaskNote';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { ConfirmBox } from '@/ui/ConfirmBox';
import { monthName, weekdayName, weekdayPlural } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { OneOffForm } from '@/ui/OneOffForm';
import { PlanFooter } from '@/ui/PlanFooter';
import { PlanRow } from '@/ui/PlanRow';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

const REMOVED_TOPIC = 'Removed topic';
const EMPTY_DRAFT = 'Tick at least one task, or discard the draft.';
const NOT_PLANNABLE =
  'You can plan today until it closes, or tomorrow. Days further out can be drafted from the Calendar with "Plan ahead".';
const DRAFT_HINT = 'A draft is saved for later. You confirm it the evening before.';

/** Android does not lift a ScrollView above the keyboard by itself (iOS does, via Screen), so add the room. */
function useKeyboardSpace() {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', e => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

/** Plan can be the first screen of a stack (opened by replace from onboarding), so fall back to Today. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/today');
}

function BackButton() {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Button label="‹ Back" kind="ghost" accessibilityLabel="Back" onPress={goBack} />
    </View>
  );
}

function NotPlannable() {
  return (
    <Screen>
      <BackButton />
      <Header title="Plan" />
      <T>{NOT_PLANNABLE}</T>
    </Screen>
  );
}

export function PlanScreen() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  if (typeof dayKey !== 'string' || !isDayKey(dayKey)) return <NotPlannable />;
  return <PlanBody dayKey={dayKey as DayKey} />;
}

function findRow(draft: PlanDraft, key: string | null): PlanRowData | undefined {
  if (key == null) return undefined;
  return [...draft.groups.flatMap(g => g.rows), ...draft.notOn].find(r => r.key === key);
}

function PlanBody({ dayKey }: { dayKey: DayKey }) {
  const t = useTheme();
  const { todayKey } = usePlannableDays();
  const plan = usePlanDraft(dayKey);
  const guard = useSubmitGuard();
  const keyboard = useKeyboardSpace();
  const topics = usePlanTopics();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [discarding, setDiscarding] = useState(false);
  // One hook call for the single expanded row (hooks are never called per row or conditionally).
  const expandedTaskId = plan.draft ? findRow(plan.draft, expanded)?.taskId ?? null : null;
  const libraryNote = useTaskNote(expandedTaskId);

  if (!plan.plannable || !plan.draft) return <NotPlannable />;
  const draft = plan.draft;
  const topicById = new Map(topics.map(x => [x.id, x]));
  const name = weekdayName(dayKey);
  const title = dayKey === todayKey ? 'Plan today' : `Plan ${name}`;

  const toggleExpand = (key: string) => setExpanded(cur => (cur === key ? null : key));

  const renderRow = (row: PlanRowData) => (
    <PlanRow
      key={row.key}
      row={row}
      dayKey={dayKey}
      topicName={topicById.get(row.topicId)?.name ?? REMOVED_TOPIC}
      expanded={expanded === row.key}
      onToggleTick={() => plan.toggle(row.key)}
      onToggleExpand={() => toggleExpand(row.key)}
      onStep={d => plan.step(row.key, d)}
      onCue={v => plan.setCue(row.key, v)}
      onTreat={v => plan.setTreat(row.key, v)}
      note={row.note ?? ''}
      onNote={text => plan.setNote(row.key, text)}
      libraryNote={expanded === row.key ? libraryNote : undefined}
    />
  );

  const isDraft = plan.mode === 'draft';
  const saveDraft = () => {
    try {
      guard.run(() => {
        plan.saveDraft();
        goBack();
      });
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      setError(e.message); // fallback: the button is disabled while nothing is ticked
    }
  };
  const discardDraft = () => {
    try {
      guard.run(() => {
        plan.discardDraft();
        goBack();
      });
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      setDiscarding(false);
      setError(e.message);
    }
  };

  const shownError = error ?? (isDraft && !plan.canConfirm ? EMPTY_DRAFT : undefined);

  const confirm = () => {
    try {
      guard.run(() => {
        plan.confirm();
        router.replace({ pathname: '/planned/[dayKey]', params: { dayKey } });
      });
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      setError(e.message);
    }
  };

  return (
    <Screen
      footer={
        <>
          {shownError ? <T accessibilityRole="alert" weight="bold">{shownError}</T> : null}
          <PlanFooter
            count={plan.totals.count}
            minutes={plan.totals.minutes}
            dayName={name}
            canConfirm={plan.canConfirm}
            busy={guard.busy}
            onConfirm={isDraft ? saveDraft : confirm}
            draft={isDraft}
          />
          {isDraft && plan.hasDraft ? (
            discarding ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <ConfirmBox
                  text="Discard this draft? Nothing else changes."
                  confirmLabel="Discard"
                  danger
                  disabled={guard.busy}
                  onConfirm={discardDraft}
                  onCancel={() => setDiscarding(false)}
                />
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                <Button label="Discard draft" kind="ghost" disabled={guard.busy} onPress={() => setDiscarding(true)} />
              </View>
            )
          ) : null}

        </>
      }>
      <BackButton />
      <Header title={isDraft ? 'Plan ahead' : title} />
      {isDraft ? <T variant="sub">{`${name}, ${Number(dayKey.slice(8))} ${monthName(dayKey)}`}</T> : null}
      {isDraft && !plan.hasDraft ? <T variant="sub">{DRAFT_HINT}</T> : null}
      {draft.groups.map(g => {
        const topic = topicById.get(g.topicId);
        if (g.rows.length === 0) return null;
        const tone = t.topic(topic?.colorKey ?? g.rows[0].colorKey);
        return (
          <View key={g.topicId} style={{ gap: 8 }}>
            <View style={{ borderRadius: t.radius.r, backgroundColor: tone.fold, paddingHorizontal: 12, paddingVertical: 8 }}>
              <T weight="bold" accessibilityRole="header">{topic?.name ?? REMOVED_TOPIC}</T>
            </View>
            {g.rows.map(renderRow)}
          </View>
        );
      })}
      {draft.notOn.length > 0 ? (
        <View style={{ gap: 8 }}>
          <T variant="label" accessibilityRole="header">{`Not on ${weekdayPlural(dayKey)} · tap to add once`}</T>
          {draft.notOn.map(renderRow)}
        </View>
      ) : null}
      {adding ? (
        <OneOffForm
          dayName={name}
          topics={topics.map(x => ({ id: x.id, name: x.name, colorKey: x.colorKey }))}
          onAdd={row => {
            plan.addOneOff(row);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a one-off task"
          onPress={() => setAdding(true)}
          style={{ minHeight: 48, justifyContent: 'center' }}>
          <T weight="bold">+ Add a one-off task</T>
        </Pressable>
      )}
      {keyboard > 0 ? <View style={{ height: keyboard }} /> : null}
    </Screen>
  );
}
