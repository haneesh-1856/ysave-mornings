import { Pressable, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import { T } from './T';

type Props = { mask: number; onChange: (mask: number) => void; size?: number; readOnly?: boolean };

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const LETTERS = 'MTWTFSS';
const R_OUT = 30, R_IN = 16, GAP = 0.06, C = 32;

const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;

/** Path of slice i (0 = Monday, at 12 o'clock, clockwise), same geometry as the style-lab prototype. */
function slice(i: number) {
  const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 7 + GAP;
  const a1 = a0 + (2 * Math.PI) / 7 - 2 * GAP;
  const [x0, y0] = pt(R_OUT, a0), [x1, y1] = pt(R_OUT, a1), [x2, y2] = pt(R_IN, a1), [x3, y3] = pt(R_IN, a0);
  const [tx, ty] = pt((R_OUT + R_IN) / 2, (a0 + a1) / 2);
  return { d: `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`, tx, ty };
}
const SLICES = DAY_NAMES.map((_, i) => slice(i));

/**
 * Seven-slice repeat-day ring, bit 0 = Monday.
 *
 * Touch design: a slice at the default 96 pt is only ~40 pt wide, under the 44 pt minimum. So the ring slices are
 * a visual/direct-manipulation convenience (hidden from the accessibility tree), and the real, labelled, >= 44 x 44 pt
 * targets are the row of day letters under the ring (it wraps on very narrow widths). In `readOnly` mode the row is
 * omitted and the ring itself carries one summary label.
 */
export function WeekRing({ mask, onChange, size = 96, readOnly }: Props) {
  const t = useTheme();
  const on = (i: number) => ((mask >> i) & 1) === 1;
  const toggle = (i: number) => onChange(mask ^ (1 << i));
  const repeating = DAY_NAMES.filter((_, i) => on(i));

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        accessible={readOnly ? true : undefined}
        accessibilityLabel={readOnly ? (repeating.length ? `Repeats ${repeating.join(', ')}` : 'No repeat days') : undefined}
        accessibilityElementsHidden={!readOnly}
        importantForAccessibility={readOnly ? 'yes' : 'no-hide-descendants'}>
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {SLICES.map((s, i) => (
            <Path key={DAY_NAMES[i]} d={s.d} fill={on(i) ? t.c.accent : t.c.line} onPress={readOnly ? undefined : () => toggle(i)} />
          ))}
          {SLICES.map((s, i) => (
            <SvgText key={DAY_NAMES[i]} x={s.tx} y={s.ty + 3} textAnchor="middle" fontSize={7} fontWeight="700" fill={on(i) ? t.c.on : t.c.muted} pointerEvents="none">
              {LETTERS[i]}
            </SvgText>
          ))}
        </Svg>
      </View>
      {readOnly ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          {DAY_NAMES.map((name, i) => (
            <Pressable
              key={name}
              accessibilityRole="checkbox"
              accessibilityLabel={`${name}, ${on(i) ? 'repeats' : 'off'}`}
              accessibilityState={{ checked: on(i) }}
              onPress={() => toggle(i)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on(i) ? t.c.accent : 'transparent', borderWidth: 1.5, borderColor: on(i) ? t.c.accent : t.c.line,
                }}>
                <T variant="sub" weight="bold" style={{ color: on(i) ? t.c.on : t.c.muted }}>{LETTERS[i]}</T>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
