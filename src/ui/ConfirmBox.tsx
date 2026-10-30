import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { T } from './T';

type Props = { text: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
  /** Disables the confirm button (e.g. while the confirmed action is in flight). */
  disabled?: boolean;
};

/** Inline confirmation (no system alert): sits where the destructive button was. */
export function ConfirmBox({ text, confirmLabel, onConfirm, onCancel, danger, disabled }: Props) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={{ gap: 10, padding: 12, borderRadius: t.radius.r, borderWidth: 1, borderColor: t.c.line, backgroundColor: t.c.bg }}>
      <T variant="sub" color="ink">{text}</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button label={confirmLabel} kind={danger ? 'danger' : 'primary'} disabled={disabled} onPress={onConfirm} style={{ flexGrow: 1 }} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} style={{ flexGrow: 1 }} />
      </View>
    </View>
  );
}
