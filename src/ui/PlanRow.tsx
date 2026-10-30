import { Pressable, View } from 'react-native';

import type { PlanRow as PlanRowData } from '@/domain/plan';
import type { DayKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { shortWeekday, weekdayName, weekdayPlural } from './dayNames';
import { Checkbox } from './Checkbox';
import { ChipSet } from './ChipSet';
import { formatMinutes } from './formatMinutes';
import { CUES, TREATS } from './presets';
import { Stepper } from './Stepper';
import { T } from './T';
import { TextField } from './TextField';

type Props = {
  row: PlanRowData;
  topicName: string;
  /** The planned day; every day word (Friday / Fri / Fridays) is formatted from it via dayNames. */
  dayKey: DayKey;
  /** Intl locale for all day words; defaults to the device's. Tests pin 'en-US'. */
  locale?: string;
  expanded: boolean;
  onToggleTick: () => void;
  onToggleExpand: () => void;
  onStep: (delta: 5 | -5) => void;
  onCue: (v: string | null) => void;
  onTreat: (v: string | null) => void;
  note: string;
  onNote: (text: string) => void;
  /** Default true. False hides the Note field (a one-off row has no library task to keep the note). */
  noteEditable?: boolean;
};

const NOTE_MAX = 1000;

/** Subtitle by reason (contract). All day words come from dayNames with the same locale. */
function subtitle(row: PlanRowData, dayKey: DayKey, locale?: string): string {
  switch (row.reason) {
    case 'default':
      return 'default';
    case 'repeats':
      return `repeats ${shortWeekday(dayKey, locale)} · not a default`;
    case 'not_on_day':
      return `not on ${weekdayPlural(dayKey, locale)} · add once`;
    case 'forwarded':
      return row.forwardedFromDayKey ? `from ${weekdayName(row.forwardedFromDayKey, locale)}` : 'forwarded';
    case 'one_off':
      return `just for ${weekdayName(dayKey, locale)}`;
    case 'saved':
      return row.kind === 'check' ? 'checklist' : formatMinutes(row.minutes);
  }
}

export function PlanRow({ row, topicName, dayKey, locale, expanded, onToggleTick, onToggleExpand, onStep, onCue, onTreat, note, onNote, noteEditable = true }: Props) {
  const t = useTheme();
  const timed = row.kind === 'timed';
  const dayName = weekdayName(dayKey, locale);
  return (
    <View style={{ borderRadius: t.radius.r, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 12 }}>
        <Checkbox checked={row.ticked} onChange={onToggleTick} label={`Include ${row.name}`} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${row.name} for ${dayName}`}
          accessibilityState={{ expanded }}
          onPress={onToggleExpand}
          style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingLeft: 6 }}>
          <T weight="bold">{row.name}</T>
          <T variant="sub">{subtitle(row, dayKey, locale)}</T>
        </Pressable>
        {timed && row.reason !== 'saved' ? <T variant="sub" weight="bold">{formatMinutes(row.minutes)}</T> : null}
      </View>
      {expanded ? (
        <View style={{ gap: 14, padding: 14, paddingTop: 4 }}>
          <T variant="sub">{topicName}</T>
          {timed ? <Stepper value={row.minutes} onChange={v => onStep(v > row.minutes ? 5 : -5)} label={`${row.name} minutes`} /> : null}
          <ChipSet label="When" options={CUES} value={row.cue} onChange={onCue} />
          <ChipSet label="Treat" options={TREATS} value={row.treat} onChange={onTreat} />
          {noteEditable ? (
            <TextField label="Note" value={note} onChangeText={onNote} maxLength={NOTE_MAX} multiline placeholder="A note for this task" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
