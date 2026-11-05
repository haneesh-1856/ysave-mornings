import { TextInput, View, type InputModeOptions, type KeyboardTypeOptions, type ReturnKeyTypeOptions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  value: string;
  onChangeText: (s: string) => void;
  label: string;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
  testID?: string;
  /** Shown under the field; also marks the border. The text carries the meaning, color only reinforces. */
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  inputMode?: InputModeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /** Hide the n/max counter (e.g. a numeric field where it only adds noise). */
  hideCounter?: boolean;
};

const COUNTER_WITHIN = 5;

export function TextField({ value, onChangeText, label, maxLength, placeholder, multiline, error, testID, keyboardType, inputMode, returnKeyType, onSubmitEditing, hideCounter }: Props) {
  const t = useTheme();
  const showCounter = !hideCounter && value.length >= maxLength - COUNTER_WITHIN;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <T variant="label">{label}</T>
        {showCounter ? <T variant="sub" accessibilityLabel={`${value.length} of ${maxLength} characters`}>{`${value.length}/${maxLength}`}</T> : null}
      </View>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={s => onChangeText(s.length > maxLength ? s.slice(0, maxLength) : s)}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={t.c.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        inputMode={inputMode}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{
          minHeight: multiline ? 88 : 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Math.min(t.radius.r, 16),
          borderWidth: error ? 2 : 1, borderColor: error ? t.c.danger : t.c.line, backgroundColor: t.c.surface, color: t.c.ink,
          fontFamily: t.font.semibold, fontSize: 16, textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? <T variant="sub" color="danger" accessibilityRole="alert">{error}</T> : null}
    </View>
  );
}
