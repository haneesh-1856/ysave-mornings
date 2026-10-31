import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { NO_TOPIC_ID, NO_TOPIC_NAME, type Task, type Topic } from '@/domain/types';
import { updateTopic } from '@/state/actions/library';
import { useTopicsLibrary, type TopicEntry } from '@/state/hooks/useTopicsLibrary';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';

import { Card } from '@/ui/Card';
import { unitNoun } from '@/ui/collectionNoun';
import { Fold } from '@/ui/Fold';
import { formatMinutes } from '@/ui/formatMinutes';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

import { TaskEditor } from './TaskEditor';

const DRAFT = 'draft';
const MAX_DOTS = 6;
/** Stands in for the No topic group while a "+ New task" draft is open and no task is in it yet. */
const NO_TOPIC_STUB: TopicEntry = {
  topic: { id: NO_TOPIC_ID, name: NO_TOPIC_NAME, colorKey: 'none', sortOrder: 1000000, isOpen: true, deletedAt: null },
  tasks: [],
  weeklyMinutes: 0,
  weekDots: [],
};

/** `seq` keys the draft's editor: a new draft is a new instance, even in the same fold as a named one. */
type Draft = { seq: number; topicId: string; createdId: string | null };

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
    setDraft(d => ({ seq: (d?.seq ?? 0) + 1, topicId, createdId: null })); // a named draft before it stays as a saved card
    setFlipped(DRAFT);
  };
  // "+ New task": a draft in No topic. Its fold may be collapsed, or hidden because it holds no task yet.
  const newTask = () => {
    if (topics.some(e => e.topic.id === NO_TOPIC_ID && !e.topic.isOpen)) updateTopic(NO_TOPIC_ID, { isOpen: true });
    addTask(NO_TOPIC_ID);
  };
  // The draft moves to the topic it was given once it has a name (the picker may change it).
  const created = (id: string, topicId: string) => setDraft(d => (d ? { ...d, topicId, createdId: id } : d));
  const moved = (topicId: string) => {
    const to = topics.find(e => e.topic.id === topicId);
    if (to && !to.topic.isOpen) updateTopic(topicId, { isOpen: true }); // the card stays open, so show its new group
  };
  const toggle = (e: TopicEntry) => {
    if (e.topic.isOpen) flipTo(null);
    updateTopic(e.topic.id, { isOpen: !e.topic.isOpen });
  };

  const art = useTheme().look.art;
  const count = topics.filter(e => e.topic.id !== NO_TOPIC_ID).length; // the built-in No topic is not one of the user's topics
  const shown = draft?.topicId === NO_TOPIC_ID && !topics.some(e => e.topic.id === NO_TOPIC_ID) ? [...topics, NO_TOPIC_STUB] : topics;
  const options = [NO_TOPIC_STUB, ...topics.filter(e => e.topic.id !== NO_TOPIC_ID)].map(e => e.topic);
  return (
    <Screen tabs>
      <Header title="Topics" note={`${count} ${count === 1 ? 'topic' : 'topics'} · ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`} />
      {shown.length === 0 ? (
        <Card>
          <T weight="bold">No topics yet</T>
          <T variant="sub">Start with one thing you want to give time to.</T>
        </Card>
      ) : (
        <>
          <T variant="sub">Tap a task to flip it. {`Dots are this week's ${unitNoun(art, 2)}.`}</T>
          {shown.map(e => (
            <TopicFold
              key={e.topic.id}
              entry={e}
              options={options}
              flipped={flipped}
              draft={draft}
              onToggle={() => toggle(e)}
              onFlip={flipTo}
              onAdd={() => addTask(e.topic.id)}
              onCreated={created}
              onMoved={moved}
            />
          ))}
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="+ New topic" kind="ghost" onPress={() => router.push('/topic/new')} style={{ flex: 1 }} />
        <Button label="+ New task" kind="ghost" testID="library-new-task" onPress={newTask} style={{ flex: 1 }} />
      </View>
      {keyboard > 0 ? <View style={{ height: keyboard }} /> : null}
    </Screen>
  );
}

type FoldProps = {
  entry: TopicEntry;
  /** What every task card's topic picker offers. */
  options: Topic[];
  flipped: string | null;
  draft: Draft | null;
  onToggle: () => void;
  onFlip: (key: string | null) => void;
  onAdd: () => void;
  onCreated: (id: string, topicId: string) => void;
  onMoved: (topicId: string) => void;
};

function TopicFold({ entry, options, flipped, draft, onToggle, onFlip, onAdd, onCreated, onMoved }: FoldProps) {
  const t = useTheme();
  const { topic, tasks, weeklyMinutes, weekDots } = entry;
  const n = tasks.length;
  const subtitle = `${n} ${n === 1 ? 'task' : 'tasks'} · ${formatMinutes(weeklyMinutes)} / week`;
  const dots = Math.min(weekDots.length, MAX_DOTS);
  const color = t.topic(topic.colorKey).color;
  const builtIn = topic.id === NO_TOPIC_ID; // no edit screen: it cannot be renamed, recoloured or deleted
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
            <View accessibilityLabel={`${weekDots.length} ${unitNoun(t.look.art, weekDots.length)} this week`} accessible style={{ flexDirection: 'row', gap: 3 }}>
              {weekDots.slice(0, dots).map((d, i) => (
                <View key={d.dayTaskId ?? `p${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              ))}
            </View>
          ) : null}
          {builtIn ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${topic.name}`}
              onPress={() => router.push({ pathname: '/topic/[id]', params: { id: topic.id } })}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T weight="bold" accessible={false}>⋯</T>
            </Pressable>
          )}
        </View>
      }>
      <View style={{ paddingVertical: 4 }}>
        {saved.map(task => (
          <TaskEditor
            key={task.id}
            topicId={topic.id}
            topics={options}
            task={task}
            flipped={flipped === task.id}
            onFlip={() => onFlip(task.id)}
            onClose={() => onFlip(null)}
            onCreated={onCreated}
            onMoved={onMoved}
            onDeleted={() => onFlip(null)}
          />
        ))}
        {myDraft ? (
          <TaskEditor
            key={`${DRAFT}-${myDraft.seq}`}
            topicId={topic.id}
            topics={options}
            task={createdTask}
            flipped={flipped === DRAFT}
            onFlip={() => onFlip(DRAFT)}
            onClose={() => onFlip(null)}
            onCreated={onCreated}
            onMoved={onMoved}
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
