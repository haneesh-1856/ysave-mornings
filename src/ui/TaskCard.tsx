import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { TaskKind } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { ChipSet } from './ChipSet';
import { unitNoun } from './collectionNoun';
import { ConfirmBox } from './ConfirmBox';
import { CUES, TREATS } from './presets';
import { repeatText } from './repeatText';
import { Segmented } from './Segmented';
import { Switch } from './Switch';
import { T } from './T';
import { TextField } from './TextField';
import { TimeSlider } from './TimeSlider';
import { useMotion } from './useMotion';
import { WeekRing } from './WeekRing';

export type TaskCardValue = {
  name: string;
  kind: TaskKind;
  minutes: number;
  repeatMask: number;
  isDefault: boolean;
  cue: string | null;
  treat: string | null;
  note: string;
};
/** Everything except the two text fields, which have their own callbacks (the screen debounces them). */
export type TaskCardPatch = Partial<Omit<TaskCardValue, 'name' | 'note'>>;

type Props = {
  value: TaskCardValue;
  flipped: boolean;
  /** Front tapped. */
  onFlip: () => void;
  /** "Done" on the back. */
  onDone: () => void;
  onName: (text: string) => void;
  onNote: (text: string) => void;
  onChange: (patch: TaskCardPatch) => void;
  /** Delete was confirmed. */
  onDelete: () => void;
};

const NAME_MAX = 40;
const NOTE_MAX = 1000;

const KINDS = [
  { value: 'timed', label: 'Timed' },
  { value: 'check', label: 'Checklist' },
];

/**
 * One task: a compact row (front) that flips (rotateX) into an editor (back). Presentational: the name and note
 * text is held here while typing and reported on every keystroke; the screen decides when to save.
 */
export function TaskCard({ value, flipped, onFlip, onDone, onName, onNote, onChange, onDelete }: Props) {
  const t = useTheme();
  const { reduce } = useMotion();
  const [shown, setShown] = useState(flipped); // which face is drawn (swaps at the half-way point of a flip)
  const rot = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    const half = t.motion.duration / 2;
    const easing = Easing.bezier(...t.motion.bezier);
    rot.value = withTiming(90, { duration: half, easing });
    const swap = setTimeout(() => {
      setShown(flipped);
      rot.value = -90;
      rot.value = withTiming(0, { duration: half, easing });
    }, half);
    return () => clearTimeout(swap);
  }, [flipped, reduce, t.motion, rot]);

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateX: `${rot.value}deg` }] }));

  return (
    <Animated.View style={faceStyle}>
      {(reduce ? flipped : shown) ? (
        <Back value={value} onDone={onDone} onName={onName} onNote={onNote} onChange={onChange} onDelete={onDelete} />
      ) : (
        <Front value={value} onFlip={onFlip} />
      )}
    </Animated.View>
  );
}

function Front({ value, onFlip }: { value: TaskCardValue; onFlip: () => void }) {
  const t = useTheme();
  const name = value.name.trim() || 'Unnamed task';
  const length = value.kind === 'check' ? 'checklist' : `${value.minutes} min`;
  const detail = `${repeatText(value.repeatMask)} · ${length}${value.isDefault ? ' · default' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${detail}`}
      accessibilityHint="Flips the card to edit it"
      onPress={onFlip}
      style={({ pressed }) => ({
        minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9,
        borderBottomWidth: 1, borderBottomColor: t.c.line, opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, gap: 1 }}>
        <T weight="semibold" numberOfLines={1}>{name}</T>
        <T variant="sub">{detail}</T>
      </View>
      <T color="muted" accessible={false}>⟲</T>
    </Pressable>
  );
}

function Back({ value, onDone, onName, onNote, onChange, onDelete }: Omit<Props, 'flipped' | 'onFlip'>) {
  const [name, setName] = useState(value.name);
  const [note, setNote] = useState(value.note);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const units = unitNoun(useTheme().look.art, 2);
  const timed = value.kind === 'timed';
  const blank = name.trim().length === 0;

  return (
    <View style={{ gap: 12, paddingVertical: 12 }}>
      <TextField
        label="Task name"
        placeholder="Name this task"
        maxLength={NAME_MAX}
        value={name}
        error={touched && blank ? 'A task needs a name' : undefined}
        onChangeText={s => {
          setName(s);
          setTouched(true);
          onName(s);
        }}
      />
      <View style={{ gap: 6 }}>
        <T variant="label">Repeats</T>
        <WeekRing mask={value.repeatMask} onChange={repeatMask => onChange({ repeatMask })} />
        <T variant="sub">{repeatText(value.repeatMask)}</T>
      </View>
      <View style={{ gap: 6 }}>
        <T variant="label">Kind</T>
        <Segmented options={KINDS} value={value.kind} onChange={kind => onChange({ kind: kind === 'check' ? 'check' : 'timed' })} />
        <T variant="sub">{timed ? 'Finishes when its time runs out' : "Tick it when it's done"}</T>
      </View>
      {timed ? <TimeSlider value={value.minutes} onChange={minutes => onChange({ minutes })} /> : null}
      <Switch label="Default task" value={value.isDefault} onChange={isDefault => onChange({ isDefault })} />
      <T variant="sub">{value.isDefault ? 'Added to your plan automatically' : 'Listed in your plan, unticked'}</T>
      <View style={{ gap: 6 }}>
        <T variant="label">When</T>
        <ChipSet label="When" options={CUES} value={value.cue} onChange={cue => onChange({ cue })} />
      </View>
      <View style={{ gap: 6 }}>
        <T variant="label">Treat</T>
        <ChipSet label="Treat" options={TREATS} value={value.treat} onChange={treat => onChange({ treat })} />
      </View>
      <TextField
        label="Notes"
        placeholder="Anything to remember: the next chapter, a shopping list"
        maxLength={NOTE_MAX}
        multiline
        value={note}
        onChangeText={s => {
          setNote(s);
          onNote(s);
        }}
      />
      {confirming ? (
        <ConfirmBox
          danger
          text={`Delete ${name.trim() || 'this task'}? Past days keep their ${units}.`}
          confirmLabel="Delete"
          onConfirm={onDelete}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button label="Delete task" kind="ghost" onPress={() => setConfirming(true)} />
          <Button label="Done" onPress={onDone} />
        </View>
      )}
    </View>
  );
}

