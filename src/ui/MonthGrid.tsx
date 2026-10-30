import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { CollectionItem } from '@/domain/collection';
import type { DayKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';

import { Collection } from './collection/Collection';
import { monthName, weekdayInitials, weekdayName } from './dayNames';
import { T } from './T';
import { useMotion } from './useMotion';

/** One day in the grid. Structurally the same as state's `CalendarCell`, so that type is assignable. */
export type MonthGridCell = {
  dayKey: DayKey;
  items: CollectionItem[];
  glows: boolean;
  closed: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isFuture: boolean;
  /** A saved draft plan (ADR-010): a small outline dot, never a marble. */
  drafted?: boolean;
};

type Props = {
  weeks: (MonthGridCell | null)[][];
  selected: DayKey;
  onSelect: (dayKey: DayKey) => void;
  locale?: string;
};

const CELL_H = 58;
const JAR_SCALE = 0.26;
const dayOfMonth = (k: DayKey) => Number(k.slice(8));

/** "Thursday 22 October, today, glowing, 3 marbles" */
export function cellLabel(c: MonthGridCell, locale?: string): string {
  const parts = [`${weekdayName(c.dayKey, locale)} ${dayOfMonth(c.dayKey)} ${monthName(c.dayKey, locale)}`];
  if (c.isToday) parts.push('today');
  else if (c.isTomorrow) parts.push('tomorrow');
  if (c.glows) parts.push('glowing');
  if (c.drafted) parts.push('draft plan');
  const n = c.items.length;
  if (n > 0) parts.push(`${n} ${n === 1 ? 'marble' : 'marbles'}`);
  if (c.closed) parts.push('closed');
  return parts.join(', ');
}

/** A soft halo behind a glowing day. Gently pulses; completely still under Reduce Motion. */
function Halo() {
  const t = useTheme();
  const { reduce } = useMotion();
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(p);
      p.value = 1;
      return;
    }
    p.value = withRepeat(withTiming(0.6, { duration: 1600 }), -1, true);
    return () => cancelAnimation(p);
  }, [reduce, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View
      testID="glow"
      pointerEvents="none"
      importantForAccessibility="no"
      style={[
        {
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: Math.max(t.radius.r - 6, 6),
          backgroundColor: t.glow.fill, borderWidth: 1, borderColor: t.glow.ring,
          shadowColor: t.c.sun, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 3,
        },
        style,
      ]}
    />
  );
}

function Cell({ cell, selected, onSelect, locale }: { cell: MonthGridCell; selected: boolean; onSelect: (k: DayKey) => void; locale?: string }) {
  const t = useTheme();
  const r = Math.max(t.radius.r - 6, 6);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cellLabel(cell, locale)}
      accessibilityState={{ selected }}
      onPress={() => onSelect(cell.dayKey)}
      style={{ flex: 1, minHeight: CELL_H }}>
      <View
        style={{
          flex: 1, borderRadius: r, alignItems: 'center', paddingTop: 3, gap: 1,
          backgroundColor: selected ? t.selected : 'transparent', borderWidth: 2,
          borderColor: cell.isToday ? t.c.sun : selected ? t.c.accent : 'transparent',
        }}>
        {cell.glows ? <Halo /> : null}
        <T
          importantForAccessibility="no"
          weight={cell.isToday || selected ? 'extrabold' : 'semibold'}
          color={cell.isToday ? 'accent' : selected ? 'ink' : 'muted'}
          style={{ fontSize: 12, lineHeight: 16 }}>
          {dayOfMonth(cell.dayKey)}
        </T>
        {cell.items.length > 0 || cell.closed ? (
          <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
            <Collection items={cell.items} closed={cell.closed} scale={JAR_SCALE} />
          </View>
        ) : null}
        {cell.drafted ? (
          <View
            testID="draft-dot"
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: t.c.accent, marginTop: 2 }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** A month as weekday initials (Mon first) over rows of day cells; null cells are blank. */
export function MonthGrid({ weeks, selected, onSelect, locale }: Props) {
  const initials = weekdayInitials(locale);
  return (
    <View style={{ gap: 3 }}>
      <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 3 }}>
        {initials.map((d, i) => (
          <T key={i} variant="sub" weight="bold" style={{ flex: 1, textAlign: 'center', fontSize: 12, lineHeight: 16 }}>{d}</T>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: 3 }}>
          {week.map((cell, di) =>
            cell ? (
              <Cell key={cell.dayKey} cell={cell} selected={cell.dayKey === selected} onSelect={onSelect} locale={locale} />
            ) : (
              <View key={`blank-${di}`} importantForAccessibility="no-hide-descendants" style={{ flex: 1, minHeight: CELL_H }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
