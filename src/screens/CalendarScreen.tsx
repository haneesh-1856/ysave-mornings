import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { addMonths, monthKeyOf } from '@/domain/calendar';
import type { DayKey, MonthKey } from '@/domain/types';
import { useCalendarMonth } from '@/state/hooks/useCalendarMonth';
import { useDayCard } from '@/state/hooks/useDayCard';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { useTheme } from '@/theme/ThemeProvider';
import { CalendarLegend } from '@/ui/CalendarLegend';
import { DayCard } from '@/ui/DayCard';
import { dayCardLine } from '@/ui/dayCardLine';
import { monthName, weekdayName } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { MonthGrid } from '@/ui/MonthGrid';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

const SWIPE_PX = 50;

/** "Thursday, 22 October" in the device's locale. */
const cardTitle = (k: DayKey) => `${weekdayName(k)}, ${Number(k.slice(8))} ${monthName(k)}`;

function Arrow({ dir, onPress }: { dir: 'prev' | 'next'; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous month' : 'Next month'}
      onPress={onPress}
      hitSlop={4}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <T importantForAccessibility="no" weight="bold" style={{ fontSize: 26, lineHeight: 30, color: t.c.accent }}>
        {dir === 'prev' ? '‹' : '›'}
      </T>
    </Pressable>
  );
}

function TodayChip({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go to today"
      onPress={onPress}
      style={{
        alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
        borderRadius: t.radius.rb, borderWidth: 1.5, borderColor: t.c.accent,
      }}>
      <T importantForAccessibility="no" weight="bold" style={{ color: t.c.accent }}>Today</T>
    </Pressable>
  );
}

export default function CalendarScreen() {
  // Which month and day are shown; both snap back to today whenever today's key changes.
  const { todayKey: today } = usePlannableDays();
  const [view, setView] = useState<{ anchor: DayKey; month: MonthKey; selected: DayKey }>({
    anchor: today, month: monthKeyOf(today), selected: today,
  });
  let { month, selected } = view;
  if (view.anchor !== today) {
    // Day boundary: reset during render (React re-renders at once, before anything is drawn).
    month = monthKeyOf(today);
    selected = today;
    setView({ anchor: today, month, selected });
  }
  const cal = useCalendarMonth(month);
  const shownMonth = cal.month;
  const sel = selected;
  const card = useDayCard(sel);

  // The selection follows the month: today if it is in the shown month, else the 1st, so the card is always in the grid.
  const go = useCallback(
    (n: number) =>
      setView((v) => {
        const m = addMonths(v.month, n);
        return { ...v, month: m, selected: monthKeyOf(today) === m ? today : `${m}-01` };
      }),
    [today],
  );
  const prev = () => go(-1);
  const next = () => go(1);
  const goToday = useCallback(() => setView((v) => ({ ...v, month: monthKeyOf(today), selected: today })), [today]);

  const pan = usePanGesture({
    runOnJS: true,
    testID: 'calendar-swipe',
    activeOffsetX: [-20, 20],
    failOffsetY: [-15, 15],
    onDeactivate: (e) => {
      if (e.translationX <= -SWIPE_PX) next();
      else if (e.translationX >= SWIPE_PX) prev();
    },
  });

  // later days: Plan ahead / Edit draft; tomorrow with an unfinalized draft: Finalize; otherwise Plan / Edit.
  const actionLabel = card.canDraft
    ? card.drafted ? 'Edit draft' : 'Plan ahead'
    : card.canPlan
      ? card.drafted && !card.planned ? 'Finalize' : card.planned ? 'Edit' : 'Plan'
      : undefined;

  const monthDate = `${shownMonth}-01`;
  const year = shownMonth.slice(0, 4);
  const title = year === today.slice(0, 4) ? monthName(monthDate) : `${monthName(monthDate)} ${year}`;

  return (
    <Screen tabs>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Arrow dir="prev" onPress={prev} />
        <View style={{ flex: 1 }}>
          <Header title={title} note={`Day ${cal.dayNumber}`} />
        </View>
        <Arrow dir="next" onPress={next} />
      </View>
      {shownMonth !== monthKeyOf(today) ? <TodayChip onPress={goToday} /> : null}
      <GestureDetector gesture={pan}>
        <View style={{ gap: 12 }}>
          <MonthGrid weeks={cal.weeks} selected={sel} onSelect={(k) => setView((v) => ({ ...v, selected: k }))} />
          <CalendarLegend />
        </View>
      </GestureDetector>
      <DayCard
        title={cardTitle(sel)}
        line={dayCardLine(card, weekdayName(sel))}
        items={card.items}
        closed={card.closed}
        glows={card.glows}
        action={actionLabel ? { label: actionLabel, onPress: () => router.push({ pathname: '/plan/[dayKey]', params: { dayKey: sel } }) } : undefined}
      />
    </Screen>
  );
}
