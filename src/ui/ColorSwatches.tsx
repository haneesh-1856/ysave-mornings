import { Pressable, View } from 'react-native';

import type { ColorKey } from '@/domain/types';
import { TOPIC_COLOR_KEYS } from '@/theme/buildTheme';
import { luminance } from '@/theme/colorMix';
import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = { value: ColorKey; onChange: (k: ColorKey) => void };

/** The six topic colors. Selection = ring + check mark (never color alone). Colors differ per palette, so labels are numbers. */
export function ColorSwatches({ value, onChange }: Props) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Topic color" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {TOPIC_COLOR_KEYS.map((k, i) => {
        const on = k === value;
        const color = t.c[k];
        // whichever of ink / on text contrasts more with this swatch
        const mark = Math.abs(luminance(t.c.ink) - luminance(color)) > Math.abs(luminance(t.c.on) - luminance(color)) ? t.c.ink : t.c.on;
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityLabel={`Color ${i + 1}`}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(k)}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center',
                borderWidth: on ? 3 : 1, borderColor: on ? t.c.ink : t.c.line,
              }}>
              {on ? <T weight="bold" style={{ color: mark, fontSize: 16, lineHeight: 18 }}>✓</T> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
