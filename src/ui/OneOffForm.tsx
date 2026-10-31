import { useState } from 'react';
import { View } from 'react-native';

import { NO_TOPIC_ID, type TaskKind } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { ChipSet } from './ChipSet';
import { T } from './T';
import { TextField } from './TextField';
import { TopicPicker, type TopicOption } from './TopicPicker';

export type OneOffRow = { topicId: string; name: string; kind: TaskKind; minutes: number; note: string | null };

type Props = {
  /** Weekday of the day being planned: the note field reads "Note for <weekday>". */
  dayName: string;
  topics: TopicOption[];
  onAdd: (row: OneOffRow) => void;
  onCancel: () => void;
};

const NAME_MAX = 40;
const NOTE_MAX = 1000;
const LENGTHS = ['Checklist', '15', '30', '45', '60', '90'] as const;
/** A checklist has no timer; its minutes are not used, so it carries the 15 min fallback the domain uses for check rows. */
const CHECK_MINUTES = 15;

/** Name first (the only required field), then topic (starts on No topic), length, and the day's note last. */
export function OneOffForm({ dayName, topics, onAdd, onCancel }: Props) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [topicId, setTopicId] = useState<string>(NO_TOPIC_ID);
  const [length, setLength] = useState<string>('30');
  const [note, setNote] = useState('');

  const valid = name.trim() !== '';
  const submit = () => {
    if (!valid) return;
    const check = length === 'Checklist';
    onAdd({
      topicId,
      name: name.trim(),
      kind: check ? 'check' : 'timed',
      minutes: check ? CHECK_MINUTES : Number(length),
      note: note.trim() === '' ? null : note,
    });
  };

  return (
    <View style={{ gap: 14, padding: 14, borderRadius: t.radius.r, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}>
      <TextField label="Task name" value={name} onChangeText={setName} maxLength={NAME_MAX} placeholder="Just for this day" />
      <TopicPicker topics={topics} value={topicId} onChange={setTopicId} />
      <View style={{ gap: 6 }}>
        <T variant="label">Length</T>
        <ChipSet label="Length" options={LENGTHS} value={length} onChange={v => setLength(v ?? length)} />
      </View>
      <TextField label={`Note for ${dayName}`} value={note} onChangeText={setNote} maxLength={NOTE_MAX} multiline placeholder="Optional" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Add" disabled={!valid} onPress={submit} style={{ flex: 1 }} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
