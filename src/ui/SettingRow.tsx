import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = {
  label: string;
  value?: string;
  onPress?: () => void;
  /** A control on the right (e.g. a Switch). */
  right?: ReactNode;
  disabled?: boolean;
  /** Show the value as a small tag. Defaults to true for a value on a row with no press and no `right` ("Not decided", "Coming later"). */
  tag?: boolean;
};

/** One line of a settings list: label, optional value, "›" when it opens something. */
export function SettingRow({ label, value, onPress, right, disabled = false, tag }: Props) {
  const t = useTheme();
  const asTag = tag ?? (!onPress && right === undefined && value !== undefined);
  const hide = right === undefined ? 'no' : 'auto'; // with a control on the right the row isn't one item, so its texts must stay readable
  const content = (
    <>
      <T importantForAccessibility={hide} weight="semibold" style={{ flex: 1 }} numberOfLines={2}>{label}</T>
      {value !== undefined ? (
        asTag ? (
          <View importantForAccessibility={hide} style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: t.c.tint2 }}>
            <T variant="sub" weight="bold" color="ink" style={{ fontSize: 11.5, lineHeight: 15 }}>{value}</T>
          </View>
        ) : (
          <T importantForAccessibility={hide} variant="sub">{value}</T>
        )
      ) : null}
      {right}
      {onPress ? <T importantForAccessibility="no" variant="sub" weight="bold">›</T> : null}
    </>
  );
  const row = { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 } as const;
  const spoken = value !== undefined ? `${label}, ${value}` : label;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={disabled ? undefined : onPress}
        style={[row, { opacity: disabled ? 0.5 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  // A control on the right keeps its own accessibility (it is not swallowed into one label).
  if (right !== undefined) return <View style={[row, { opacity: disabled ? 0.5 : 1 }]}>{content}</View>;
  return (
    <View accessible accessibilityLabel={spoken} accessibilityState={{ disabled }} style={[row, { opacity: disabled ? 0.5 : 1 }]}>
      {content}
    </View>
  );
}
