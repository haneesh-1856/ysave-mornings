import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { ColorKey, TaskKind } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { ChipSet } from './ChipSet';
import { T } from './T';
import { TextField } from './TextField';

type TopicOption = { id: string; name: string; colorKey: ColorKey };
export type OneOffRow = { topicId: string; name: string; kind: TaskKind; minutes: number };

type Props = {
  topics: TopicOption[];
  onAdd: (row: OneOffRow) => void;
  onCancel: () => void;
};

const NAME_MAX = 40;
const LENGTHS = ['Checklist', '15', '30', '45', '60', '90'] as const;
/** A checklist has no timer; its minutes are not used, so it carries the 15 min fallback the domain uses for check rows. */
const CHECK_MINUTES = 15;

export function OneOffForm({ topics, onAdd, onCancel }: Props) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [length, setLength] = useState<string>('30');

  const valid = name.trim() !== '' && topicId != null;
  const submit = () => {
    if (!valid || topicId == null) return;
    const check = length === 'Checklist';
    onAdd({ topicId, name: name.trim(), kind: check ? 'check' : 'timed', minutes: check ? CHECK_MINUTES : Number(length) });
  };

  return (
    <View style={{ gap: 14, padding: 14, borderRadius: t.radius.r, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}>
      <TextField label="Task name" value={name} onChangeText={setName} maxLength={NAME_MAX} placeholder="Just for this day" />
      <View style={{ gap: 6 }}>
        <T variant="label">Topic</T>
        <View accessibilityRole="radiogroup" accessibilityLabel="Topic" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {topics.map(tp => {
            const on = tp.id === topicId;
            const color = t.topic(tp.colorKey).color;
            return (
              <Pressable
                key={tp.id}
                accessibilityRole="radio"
                accessibilityLabel={tp.name}
                accessibilityState={{ selected: on, checked: on }}
                onPress={() => setTopicId(tp.id)}
                style={{
                  minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: t.radius.rb,
                  borderWidth: on ? 2 : 1, borderColor: on ? t.c.accent : t.c.line,
                }}>
                <View importantForAccessibility="no-hide-descendants" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                <T variant="sub" weight="bold" style={{ color: t.c.ink }}>{tp.name}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <T variant="label">Length</T>
        <ChipSet label="Length" options={LENGTHS} value={length} onChange={v => setLength(v ?? length)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Add" disabled={!valid} onPress={submit} style={{ flex: 1 }} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
