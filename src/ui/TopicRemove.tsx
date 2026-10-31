import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { NO_TOPIC_ID } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { ConfirmBox } from './ConfirmBox';
import { T } from './T';
import { TopicPicker, type TopicOption } from './TopicPicker';

/** Picker value for "delete this task with the topic"; never a real topic id. */
const DELETE = '__delete__';

type Props = {
  name: string;
  /** The topic's live tasks, in order. */
  tasks: { id: string; name: string }[];
  /** Where tasks may go (not the topic being removed); No topic is offered first. */
  targets: TopicOption[];
  /** Called with where each kept task goes (tasks not listed are deleted), or with nothing to delete the topic with all its tasks. */
  onRemove: (moves?: { taskId: string; toTopicId: string }[]) => void;
  onCancel: () => void;
  /** Remove is in flight: disables the buttons that remove. */
  busy?: boolean;
  /** Why the last attempt was refused. */
  error?: string;
  /** What the user calls the things a topic holds, for the plain confirm ("Past days keep their ..."). */
  units: string;
};

/**
 * Inline confirmation for removing a topic (ADR-013). No tasks: one confirm. With tasks: ask whether to move any first;
 * "Yes" lists them, each with its own destination (No topic by default, another topic, or Delete with the topic).
 */
export function TopicRemove({ name, tasks, targets, onRemove, onCancel, busy = false, error, units }: Props) {
  const t = useTheme();
  const [moving, setMoving] = useState(false);
  const [dest, setDest] = useState<Record<string, string>>({}); // taskId -> topic id or DELETE
  const [open, setOpen] = useState<string | null>(null); // the task whose picker is showing

  if (tasks.length === 0) {
    return (
      <ConfirmBox
        danger
        text={`Remove ${name}? Removes its tasks from your library. Past days keep their ${units}.`}
        confirmLabel="Remove"
        disabled={busy}
        onConfirm={() => onRemove()}
        onCancel={onCancel}
      />
    );
  }

  const n = tasks.length;
  const err = error ? <T variant="sub" color="danger" accessibilityRole="alert">{error}</T> : null;
  if (!moving) {
    return (
      <View accessibilityRole="alert" style={{ gap: 10, padding: 12, borderRadius: t.radius.r, borderWidth: 1, borderColor: t.c.line, backgroundColor: t.c.bg }}>
        <T variant="sub" color="ink">{`${name} has ${n} ${n === 1 ? 'task' : 'tasks'}. Move any of them before deleting?`}</T>
        {err}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button label="Yes, move tasks" onPress={() => setMoving(true)} style={{ flexGrow: 1 }} />
          <Button label="No, delete all" kind="danger" disabled={busy} onPress={() => onRemove()} style={{ flexGrow: 1 }} />
          <Button label="Cancel" kind="ghost" onPress={onCancel} style={{ flexGrow: 1 }} />
        </View>
      </View>
    );
  }

  // A task added meanwhile, or whose chosen topic was removed meanwhile, goes to No topic.
  const where = (id: string) => {
    const d = dest[id];
    return d === DELETE || targets.some(x => x.id === d) ? d : NO_TOPIC_ID;
  };
  const nameOf = (id: string) => targets.find(x => x.id === id)?.name ?? 'No topic';
  const moved = tasks.filter(x => where(x.id) !== DELETE).length; // a task removed meanwhile no longer counts
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: t.radius.r, borderWidth: 1, borderColor: t.c.line, backgroundColor: t.c.bg }}>
      <T variant="label">Where each task goes</T>
      {tasks.map(x => {
        const to = where(x.id);
        const gone = to === DELETE;
        return (
          <View key={x.id} style={{ gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${x.name}, ${gone ? 'is deleted' : `moves to ${nameOf(to)}`}. Change`}
              onPress={() => setOpen(open === x.id ? null : x.id)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: t.radius.rb, borderWidth: 1, borderColor: t.c.line }}>
              <T variant="sub" weight="bold" color={gone ? 'danger' : 'ink'}>{`${x.name} → ${gone ? 'Delete' : nameOf(to)}`}</T>
            </Pressable>
            {open === x.id ? (
              <TopicPicker
                label={`Move ${x.name} to`}
                topics={targets}
                value={to}
                extra={{ id: DELETE, name: 'Delete' }}
                onChange={id => { setDest(prev => ({ ...prev, [x.id]: id })); setOpen(null); }}
              />
            ) : null}
          </View>
        );
      })}
      <T variant="sub" color="ink">{`${moved} ${moved === 1 ? 'moves' : 'move'} · ${n - moved} ${n - moved === 1 ? 'is' : 'are'} deleted`}</T>
      {err}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          label="Move and delete topic"
          kind="danger"
          disabled={busy}
          onPress={() => onRemove(tasks.filter(x => where(x.id) !== DELETE).map(x => ({ taskId: x.id, toTopicId: where(x.id) })))}
          style={{ flexGrow: 1 }}
        />
        <Button label="Back" kind="ghost" onPress={() => setMoving(false)} style={{ flexGrow: 1 }} />
      </View>
    </View>
  );
}
