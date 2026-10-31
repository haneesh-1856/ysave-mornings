import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean };

/** A 44 pt touch target around a 26 pt box. */
export function Checkbox({ checked, onChange, label, disabled = false }: Props) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : () => onChange(!checked)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <T
        importantForAccessibility="no"
        maxFontSizeMultiplier={1} // the ✓ sits in a fixed 26 pt box; the 44 pt target and the row text still scale
        weight="extrabold"
        style={{
          width: 26, height: 26, borderRadius: 8, borderWidth: 2, textAlign: 'center', lineHeight: 22, overflow: 'hidden',
          borderColor: checked ? t.c.accent : t.c.line, backgroundColor: checked ? t.c.accent : 'transparent', color: t.c.on,
        }}>
        {checked ? '✓' : ''}
      </T>
    </Pressable>
  );
}
