import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import type { Task } from '@/domain/types';
import { updateTopic } from '@/state/actions/library';
import { useTopicsLibrary, type TopicEntry } from '@/state/hooks/useTopicsLibrary';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Fold } from '@/ui/Fold';
import { formatMinutes } from '@/ui/formatMinutes';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

import { TaskEditor } from './TaskEditor';

const DRAFT = 'draft';
const MAX_DOTS = 6;

type Draft = { topicId: string; createdId: string | null };

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

export function TopicsScreen() {
  const { topics, taskCount } = useTopicsLibrary();
  const keyboard = useKeyboardSpace();
  const [flipped, setFlipped] = useState<string | null>(null); // a task id, or DRAFT
  const [draft, setDraft] = useState<Draft | null>(null);

  const flipTo = (key: string | null) => {
    setFlipped(key);
    if (key !== DRAFT) setDraft(null); // flipping away from a draft: unnamed -> discarded, named -> already saved
  };
  const addTask = (topicId: string) => {
    setDraft({ topicId, createdId: null });
    setFlipped(DRAFT);
  };
  const toggle = (e: TopicEntry) => {
    if (e.topic.isOpen) flipTo(null);
    updateTopic(e.topic.id, { isOpen: !e.topic.isOpen });
  };

  const count = topics.length;
  return (
    <Screen tabs>
      <Header title="Topics" note={`${count} ${count === 1 ? 'topic' : 'topics'} · ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`} />
      {count === 0 ? (
        <Card>
          <T weight="bold">No topics yet</T>
          <T variant="sub">Start with one thing you want to give time to.</T>
        </Card>
      ) : (
        <>
          <T variant="sub">Tap a task to flip it. Dots are this week&apos;s marbles.</T>
          {topics.map(e => (
            <TopicFold
              key={e.topic.id}
              entry={e}
              flipped={flipped}
              draft={draft}
              onToggle={() => toggle(e)}
              onFlip={flipTo}
              onAdd={() => addTask(e.topic.id)}
              onCreated={id => setDraft(d => (d ? { ...d, createdId: id } : d))}
            />
          ))}
        </>
      )}
      <Button label="+ New topic" kind="ghost" onPress={() => router.push('/topic/new')} />
      {keyboard > 0 ? <View style={{ height: keyboard }} /> : null}
    </Screen>
  );
}

type FoldProps = {
  entry: TopicEntry;
  flipped: string | null;
  draft: Draft | null;
  onToggle: () => void;
  onFlip: (key: string | null) => void;
  onAdd: () => void;
  onCreated: (id: string) => void;
};

function TopicFold({ entry, flipped, draft, onToggle, onFlip, onAdd, onCreated }: FoldProps) {
  const t = useTheme();
  const { topic, tasks, weeklyMinutes, weekDots } = entry;
  const n = tasks.length;
  const subtitle = `${n} ${n === 1 ? 'task' : 'tasks'} · ${formatMinutes(weeklyMinutes)} / week`;
  const dots = Math.min(weekDots.length, MAX_DOTS);
  const color = t.topic(topic.colorKey).color;
  const myDraft = draft && draft.topicId === topic.id ? draft : null;
  const createdId = myDraft?.createdId ?? null;
  const saved: Task[] = tasks.filter(x => x.id !== createdId);
  const createdTask = createdId ? tasks.find(x => x.id === createdId) ?? null : null;

  return (
    <Fold
      title={topic.name}
      colorKey={topic.colorKey}
      subtitle={subtitle}
      open={topic.isOpen}
      onToggle={onToggle}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {dots > 0 ? (
            <View accessibilityLabel={`${weekDots.length} marbles this week`} accessible style={{ flexDirection: 'row', gap: 3 }}>
              {weekDots.slice(0, dots).map((d, i) => (
                <View key={d.dayTaskId ?? `p${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${topic.name}`}
            onPress={() => router.push({ pathname: '/topic/[id]', params: { id: topic.id } })}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T weight="bold" accessible={false}>⋯</T>
          </Pressable>
        </View>
      }>
      <View style={{ paddingVertical: 4 }}>
        {saved.map(task => (
          <TaskEditor
            key={task.id}
            topicId={topic.id}
            task={task}
            flipped={flipped === task.id}
            onFlip={() => onFlip(task.id)}
            onClose={() => onFlip(null)}
            onCreated={onCreated}
            onDeleted={() => onFlip(null)}
          />
        ))}
        {myDraft ? (
          <TaskEditor
            key={DRAFT}
            topicId={topic.id}
            task={createdTask}
            flipped={flipped === DRAFT}
            onFlip={() => onFlip(DRAFT)}
            onClose={() => onFlip(null)}
            onCreated={onCreated}
            onDeleted={() => onFlip(null)}
          />
        ) : null}
        {myDraft ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={n === 0 ? `Add the first task to ${topic.name}` : `Add task to ${topic.name}`}
            onPress={onAdd}
            style={{ minHeight: 48, justifyContent: 'center' }}>
            <T weight="bold">{n === 0 ? '+ Add the first task' : '+ Add task'}</T>
          </Pressable>
        )}
      </View>
    </Fold>
  );
}
