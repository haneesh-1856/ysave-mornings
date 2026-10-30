import { useState } from 'react';
import { View } from 'react-native';

import type { ColorKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { unitNoun } from './collectionNoun';
import { ColorSwatches } from './ColorSwatches';
import { ConfirmBox } from './ConfirmBox';
import { Fold } from './Fold';
import { T } from './T';
import { TextField } from './TextField';

export const TOPIC_NAME_MAX = 24;

type Props = {
  initialName: string;
  initialColor: ColorKey;
  onSave: (name: string, colorKey: ColorKey) => void;
  /** Passing this shows the Remove section (edit mode). */
  onRemove?: () => void;
  /** A problem reported by the save (e.g. a ValidationError message), shown under the name. */
  error?: string;
  /** A save/remove is in flight: disables Save and Remove so a second press can't double-submit. */
  busy?: boolean;
};

const noop = () => {};

/** Name + color + live preview for a topic. Presentational: the route decides what saving means. */
export function TopicForm({ initialName, initialColor, onSave, onRemove, error, busy = false }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<ColorKey>(initialColor);
  const [asking, setAsking] = useState(false);
  const units = unitNoun(useTheme().look.art, 2);
  const blank = name.trim().length === 0;

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        maxLength={TOPIC_NAME_MAX}
        placeholder="e.g. Study"
        error={blank ? 'A topic needs a name' : error}
      />
      <View style={{ gap: 4 }}>
        <T variant="label">Color</T>
        <ColorSwatches value={color} onChange={setColor} />
      </View>
      <View style={{ gap: 4 }}>
        <T variant="label">Preview</T>
        <View pointerEvents="none">
          <Fold title={blank ? 'New topic' : name.trim()} colorKey={color} subtitle="Preview" open={false} onToggle={noop} />
        </View>
      </View>
      <Button label="Save" disabled={blank || busy} onPress={() => onSave(name, color)} />
      {onRemove ? (
        asking ? (
          <ConfirmBox
            danger
            text={`Remove ${initialName}? Removes its tasks from your library. Past days keep their ${units}.`}
            confirmLabel="Remove"
            disabled={busy}
            onConfirm={onRemove}
            onCancel={() => setAsking(false)}
          />
        ) : (
          <Button label="Remove topic" kind="ghost" disabled={busy} onPress={() => setAsking(true)} />
        )
      ) : null}
    </View>
  );
}
