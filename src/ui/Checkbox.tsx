import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = { checked: boolean; onChange: (v: boolean) => void; label: string };

/** A 44 pt touch target around a 26 pt box. */
export function Checkbox({ checked, onChange, label }: Props) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <T
        importantForAccessibility="no"
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
