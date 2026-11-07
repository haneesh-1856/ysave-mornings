import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { addDays } from '@/domain/dayKey';
import type { DayKey } from '@/domain/types';
import { useInsights } from '@/state/hooks/useInsights';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { shortWeekday, weekdayName } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { Bars, DotStrip, PairRows, PairedBars, StackedBar } from '@/ui/insights/charts';
import { dateText, durationText, nounFor, partialText, plural, shortDateText, spokenMs } from '@/ui/insights/format';
import { spokenDuration } from '@/ui/momentText';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

export const EMPTY_TEXT = 'Nothing in these 30 days yet.';

/** Falls back to Profile when there is no history (e.g. opened by a deep link). */
const goBack = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
};

const MONDAY = '2024-01-01'; // any Monday: names the seven weekdays
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));
const BIN_NAMES = ['Under 5 min', '5 to 14 min', '15 to 29 min', '30 to 44 min', '45 to 59 min', '60 min and over'];
const BIN_SHORT = ['<5', '5-14', '15-29', '30-44', '45-59', '60+'];
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const maxOf = (xs: number[]) => xs.reduce((m, x) => Math.max(m, x), 0);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T variant="label" accessibilityRole="header" style={{ marginTop: 6 }}>{title}</T>
      {children}
    </View>
  );
}

function InsightCard({ title, about, empty, children }: { title: string; about: string; empty: boolean; children: ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <T weight="bold" accessibilityRole="header">{title}</T>
      <T variant="sub">{about}</T>
      {empty ? <T variant="sub" weight="semibold">{EMPTY_TEXT}</T> : children}
    </Card>
  );
}

/** A big number with a small caption under it. */
function Figure({ value, caption }: { value: string; caption: string }) {
  return (
    <View accessible accessibilityLabel={`${caption}: ${value}`} style={{ flexShrink: 1 }}>
      <T importantForAccessibility="no" weight="extrabold" style={{ fontSize: 20, lineHeight: 26 }}>{value}</T>
      <T importantForAccessibility="no" variant="sub" style={{ fontSize: 12, lineHeight: 16 }}>{caption}</T>
    </View>
  );
}

const Figures = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 6 }}>{children}</View>
);

/** Equal columns that line up under the bars: a small value, the week's first date, and a partial-week note. */
function WeekColumns({ weeks }: { weeks: { weekStart: DayKey; daysInWindow: number; value: string }[] }) {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row' }}>
      {weeks.map(w => (
        <View key={w.weekStart} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 1 }}>
          <T weight="bold" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{w.value}</T>
          <T variant="sub" style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>{shortDateText(w.weekStart)}</T>
          {partialText(w.daysInWindow) ? (
            <T variant="sub" style={{ fontSize: 10, lineHeight: 13, textAlign: 'center' }}>{partialText(w.daysInWindow)}</T>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const weekPhrase = (w: { weekStart: DayKey; daysInWindow: number }) =>
  `week of ${shortDateText(w.weekStart)}${partialText(w.daysInWindow) ? ` (${partialText(w.daysInWindow)})` : ''}`;

function Legend({ items }: { items: { color: string; text: string }[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((i, idx) => (
        <View key={`${idx}-${i.text}`} accessible accessibilityLabel={i.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View importantForAccessibility="no" style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <T importantForAccessibility="no" variant="sub" color="ink" style={{ flexShrink: 1 }}>{i.text}</T>
        </View>
      ))}
    </View>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}, ${detail}`} style={{ minHeight: 44, justifyContent: 'center' }}>
      <View importantForAccessibility="no" style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <T weight="semibold" style={{ flexShrink: 1 }}>{label}</T>
        <T weight="extrabold">{value}</T>
      </View>
      <T importantForAccessibility="no" variant="sub">{detail}</T>
    </View>
  );
}

export function InsightsScreen() {
  const t = useTheme();
  const ins = useInsights();

  // Android back = the "‹ Profile" button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const noFocus = ins.totalFocusMs === 0;

  // Hours you focus
  const hourMs = ins.hours.msByHour;
  const hourTop = hourMs.indexOf(maxOf(hourMs));
  const hourSpoken = hourMs
    .map((ms, h) => (ms > 0 ? `${h} to ${(h + 1) % 24}, ${spokenMs(ms)}` : ''))
    .filter(Boolean)
    .join('; ');
  const hourLabel = `Focus by hour of the day. ${hourSpoken ? `${hourSpoken}.` : 'No timer runs in these 30 days.'}`;

  // Your week shape
  const wd = ins.weekdays;
  const wdSpoken = WEEKDAYS.map((k, i) => `${weekdayName(k)} ${spokenMs(wd.avgMs[i])} over ${plural(wd.dayCount[i], 'day')}`).join(', ');
  const wdLabel = `Average focus per weekday. ${wdSpoken}.`;

  // First timer of the day
  const fs = ins.firstStart;
  const fsMax = Math.max(60, Math.ceil(maxOf(fs.days.map(d => d.minutes)) / 60) * 60);
  const spokenMin = (min: number) => (min === 0 ? '0 minutes' : spokenDuration(min * 60_000));
  const fsMedian = fs.medianMinutes === null ? 'none' : spokenMin(fs.medianMinutes);
  const fsSorted = [...fs.days].sort((x, y) => (x.dayKey < y.dayKey ? -1 : x.dayKey > y.dayKey ? 1 : 0));
  const fsEarliest = fsSorted.reduce<(typeof fsSorted)[number] | null>((m, d) => (m === null || d.minutes < m.minutes ? d : m), null);
  const fsLatest = fsSorted.reduce<(typeof fsSorted)[number] | null>((m, d) => (m === null || d.minutes > m.minutes ? d : m), null);
  const fsLabel =
    `First timer of each day, counted from when that day starts. ${plural(fs.days.length, 'day')}. Median ${fsMedian}.` +
    (fsEarliest && fsLatest
      ? ` Earliest ${spokenMin(fsEarliest.minutes)} on ${dateText(fsEarliest.dayKey)}. Latest ${spokenMin(fsLatest.minutes)} on ${dateText(fsLatest.dayKey)}.`
      : '');

  // Topic split
  const topicLabel = `Focus by topic. ${ins.topics.map(x => `${x.name} ${spokenMs(x.ms)}`).join(', ')}.`;

  // Planned and focused
  const planMax = maxOf(ins.planned.flatMap(p => [p.plannedMs, p.focusedMs]));
  const planSpoken = ins.planned.map(p => `${p.name} planned ${spokenMs(p.plannedMs)}, focused ${spokenMs(p.focusedMs)}`).join('; ');
  const planLabel = `Planned and focused time by topic. ${planSpoken}.`;

  // Session lengths
  const sessLabel = `Timer runs by length. ${BIN_NAMES.map((n, i) => `${n} ${plural(ins.sessions.bins[i], 'run')}`).join(', ')}.`;

  // Weekly focus
  const trendLabel = `Focus by week. ${ins.trend.map(w => `${weekPhrase(w)} ${spokenMs(w.ms)}`).join(', ')}.`;

  // Days you showed up
  const upSpoken = ins.showedUp.byWeek.map(w => `${weekPhrase(w)} ${plural(w.days, 'day')} of ${w.daysInWindow}`).join(', ');
  const upLabel = `Days you showed up, by week. ${upSpoken}.`;

  // Gold rings
  const goldSpoken = ins.gold.byWeek.map(w => `${weekPhrase(w)} ${plural(w.rings, 'ring')} on ${plural(w.days, 'day')}`).join(', ');
  const goldLabel = `Gold rings by week. ${goldSpoken}.`;

  // Moved and let go
  const carrySpoken = ins.carry.byWeek.map(w => `${weekPhrase(w)} ${plural(w.moved, 'task')} moved, ${plural(w.letGo, 'task')} let go`).join(', ');
  const carryLabel = `Moved and let go tasks by week. ${carrySpoken}.`;
  const carryMax = maxOf(ins.carry.byWeek.flatMap(w => [w.moved, w.letGo]));

  // Checklist ticks
  const checkTotal = ins.checks.ticked + ins.checks.notTicked;
  const checkLabel = `Checklist items on closed days. ${plural(ins.checks.ticked, 'item')} ticked, ${plural(ins.checks.notTicked, 'item')} not ticked.`;

  const { bestDay, longestSession, longestRun } = ins.records;

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="Insights" note="Last 30 days" />
      <T variant="sub">Counted on this phone from your days, tasks and timers.</T>

      <Group title="When you focus">
        <InsightCard title="Hours you focus" about="Focus time in each hour of the clock, added up over the 30 days." empty={noFocus}>
          <Bars values={hourMs} max={maxOf(hourMs)} color={t.c.accent} label={hourLabel} />
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['0:00', '6:00', '12:00', '18:00', '24:00'].map(s => (
              <T key={s} variant="sub" style={{ fontSize: 11 }}>{s}</T>
            ))}
          </View>
          <Figures>
            <Figure value={`${hourTop}:00 to ${hourTop + 1}:00`} caption="hour with the most focus" />
            <Figure value={durationText(hourMs[hourTop])} caption="focused in that hour" />
          </Figures>
        </InsightCard>

        <InsightCard title="Your week shape" about="Average focus on each weekday, over the days of that weekday in the 30 days." empty={noFocus}>
          <Bars values={wd.avgMs} max={maxOf(wd.avgMs)} color={t.c.accent} label={wdLabel} h={64} />
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((k, i) => (
              <View key={k} style={{ flex: 1, alignItems: 'center' }}>
                <T variant="sub" style={{ fontSize: 11, lineHeight: 14 }}>{shortWeekday(k)}</T>
                <T weight="bold" style={{ fontSize: 12, lineHeight: 16 }}>{durationText(wd.avgMs[i])}</T>
                <T variant="sub" style={{ fontSize: 10, lineHeight: 13 }}>{plural(wd.dayCount[i], 'day')}</T>
              </View>
            ))}
          </View>
        </InsightCard>

        <InsightCard title="First timer of the day" about="How long after your day starts the first timer began, one dot per day." empty={fs.days.length === 0}>
          <DotStrip values={fs.days.map(d => d.minutes)} max={fsMax} median={fs.medianMinutes} color={t.c.accent} label={fsLabel} />
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="sub" style={{ fontSize: 11 }}>0:00</T>
            <T variant="sub" style={{ fontSize: 11 }}>{`${fsMax / 60}:00 after your day starts`}</T>
          </View>
          <Figures>
            <Figure value={fs.medianMinutes === null ? 'none' : durationText(fs.medianMinutes * 60_000)} caption="median, after your day starts" />
            <Figure value={String(fs.days.length)} caption={`${nounFor(fs.days.length, 'day')} with a timer`} />
          </Figures>
        </InsightCard>
      </Group>

      <Group title="What you spend it on">
        <InsightCard title="Topic split" about="Focus time per topic, as parts of one bar." empty={ins.topics.length === 0}>
          <StackedBar parts={ins.topics.map(x => ({ value: x.ms, color: t.topic(x.colorKey).color }))} label={topicLabel} />
          <Legend items={ins.topics.map(x => ({ color: t.topic(x.colorKey).color, text: `${x.name}  ${durationText(x.ms)}` }))} />
          <Figure value={durationText(sum(ins.topics.map(x => x.ms)))} caption="focused in total" />
        </InsightCard>

        <InsightCard title="Planned and focused" about="For timed tasks: the time planned (light bar) beside the time focused (colour bar), per topic." empty={ins.planned.length === 0}>
          <PairRows
            rows={ins.planned.map(p => ({ planned: p.plannedMs, focused: p.focusedMs, color: t.topic(p.colorKey).color }))}
            max={planMax}
            plannedColor={t.c.muted}
            label={planLabel}
          />
          <Legend items={ins.planned.map(p => ({ color: t.topic(p.colorKey).color, text: `${p.name}  planned ${durationText(p.plannedMs)}, focused ${durationText(p.focusedMs)}` }))} />
        </InsightCard>

        <InsightCard title="Session lengths" about="How many timer runs fell in each length." empty={ins.sessions.count === 0}>
          <Bars values={ins.sessions.bins} max={maxOf(ins.sessions.bins)} color={t.c.accent} label={sessLabel} />
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row' }}>
            {BIN_SHORT.map((s, i) => (
              <View key={s} style={{ flex: 1, alignItems: 'center' }}>
                <T weight="bold" style={{ fontSize: 12, lineHeight: 16 }}>{String(ins.sessions.bins[i])}</T>
                <T variant="sub" style={{ fontSize: 11, lineHeight: 14 }}>{`${s} min`}</T>
              </View>
            ))}
          </View>
          <Figures>
            <Figure value={String(ins.sessions.count)} caption={`timer ${nounFor(ins.sessions.count, 'run')}`} />
            <Figure value={ins.sessions.medianMs === null ? 'none' : durationText(ins.sessions.medianMs)} caption="median run, H:MM" />
          </Figures>
        </InsightCard>
      </Group>

      <Group title="Over time">
        <InsightCard title="Weekly focus" about="Focus time in each week. A week partly outside the 30 days counts the days inside them." empty={noFocus}>
          <Bars values={ins.trend.map(w => w.ms)} max={maxOf(ins.trend.map(w => w.ms))} color={t.c.accent} label={trendLabel} />
          <WeekColumns weeks={ins.trend.map(w => ({ ...w, value: durationText(w.ms) }))} />
          <Figure value={durationText(ins.totalFocusMs)} caption="focused in 30 days" />
        </InsightCard>

        <InsightCard title="Days you showed up" about="Days with at least one marble (a confirmed plan or a finished task), by week. The pale bar is how many days of that week are in the 30 days." empty={ins.showedUp.total === 0}>
          <Bars values={ins.showedUp.byWeek.map(w => w.days)} track={ins.showedUp.byWeek.map(w => w.daysInWindow)} max={7} color={t.c.accent} label={upLabel} />
          <WeekColumns weeks={ins.showedUp.byWeek.map(w => ({ ...w, value: `${w.days} of ${w.daysInWindow}` }))} />
          <Figure value={String(ins.showedUp.total)} caption={`${nounFor(ins.showedUp.total, 'day')} you showed up, of 30`} />
        </InsightCard>

        <InsightCard title="Gold rings" about="Timed tasks that ran at least 1 minute past their planned time, by week." empty={ins.gold.rings === 0}>
          <Bars values={ins.gold.byWeek.map(w => w.rings)} max={maxOf(ins.gold.byWeek.map(w => w.rings))} color={t.c.sun} label={goldLabel} />
          <WeekColumns weeks={ins.gold.byWeek.map(w => ({ ...w, value: String(w.rings) }))} />
          <Figures>
            <Figure value={String(ins.gold.rings)} caption={`gold ${nounFor(ins.gold.rings, 'ring')}`} />
            <Figure value={String(ins.gold.days)} caption={`${nounFor(ins.gold.days, 'day')} with a gold ring`} />
          </Figures>
        </InsightCard>
      </Group>

      <Group title="How days end">
        <InsightCard title="Moved and let go" about="Tasks you moved to another day (colour bar) and tasks you let go (grey bar), on closed days, by week." empty={ins.carry.moved + ins.carry.letGo === 0}>
          <PairedBars a={ins.carry.byWeek.map(w => w.moved)} b={ins.carry.byWeek.map(w => w.letGo)} max={carryMax} colorA={t.c.accent} colorB={t.c.muted} label={carryLabel} />
          <WeekColumns weeks={ins.carry.byWeek.map(w => ({ ...w, value: `${w.moved} / ${w.letGo}` }))} />
          <Figures>
            <Figure value={String(ins.carry.moved)} caption="moved" />
            <Figure value={String(ins.carry.letGo)} caption="let go" />
          </Figures>
        </InsightCard>

        <InsightCard title="Checklist ticks" about="Checklist items on closed days, ticked and not ticked." empty={checkTotal === 0}>
          <StackedBar parts={[{ value: ins.checks.ticked, color: t.c.accent }, { value: ins.checks.notTicked, color: t.c.muted }]} label={checkLabel} />
          <Legend items={[{ color: t.c.accent, text: `Ticked  ${ins.checks.ticked}` }, { color: t.c.muted, text: `Not ticked  ${ins.checks.notTicked}` }]} />
        </InsightCard>

        <InsightCard title="Your records" about="The largest values inside these 30 days." empty={!bestDay && !longestSession && !longestRun}>
          {bestDay ? <Row label="Most focus in a day" value={durationText(bestDay.ms)} detail={dateText(bestDay.dayKey)} /> : null}
          {longestSession ? (
            <Row label="Longest timer run" value={durationText(longestSession.ms)} detail={`${longestSession.taskName} · ${dateText(longestSession.dayKey)}`} />
          ) : null}
          {longestRun ? <Row label="Most days in a row" value={plural(longestRun.days, 'day')} detail={`ending ${dateText(longestRun.endDayKey)}`} /> : null}
        </InsightCard>
      </Group>
    </Screen>
  );
}
