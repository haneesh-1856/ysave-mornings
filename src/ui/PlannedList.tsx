import { useMemo } from 'react';
import { View } from 'react-native';

import type { DayTask, Topic } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { weekdayName } from '@/ui/dayNames';
import { formatMinutes } from '@/ui/formatMinutes';
import { T } from '@/ui/T';

/** Same label the Plan screen uses for a topic that has been removed since the day was planned. */
export const REMOVED_TOPIC = 'Removed topic';

/**
 * A day's planned tasks (topic dot, task name, topic name, "from <weekday>" when forwarded, minutes or
 * "checklist") in a card, followed by the total "n tasks · Xh Ym". Presentational: the caller passes the
 * stored rows (useDayPlan) and the live topics (usePlanTopics). A row whose topic is missing shows
 * "Removed topic" with the row's snapshot colour.
 */
export function PlannedList({ rows, topics }: { rows: DayTask[]; topics: Topic[] }) {
  const t = useTheme();
  const topicById = useMemo(() => new Map(topics.map(x => [x.id, { name: x.name, colorKey: x.colorKey }])), [topics]);
  const totalSec = rows.reduce((s, r) => s + (r.kind === 'timed' ? r.budgetSec : 0), 0);
  const count = rows.length;
  return (
    <>
      <Card>
        {rows.map(r => {
          const topic = topicById.get(r.topicId);
          return (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.topic(topic?.colorKey ?? r.colorKey).color }}
              />
              <View style={{ flex: 1 }}>
                <T weight="bold">{r.name}</T>
                <T variant="sub">
                  {topic?.name ?? REMOVED_TOPIC}
                  {r.forwardedFromDayKey ? ` · from ${weekdayName(r.forwardedFromDayKey)}` : ''}
                </T>
              </View>
              <T variant="sub">{r.kind === 'check' ? 'checklist' : `${Math.round(r.budgetSec / 60)} min`}</T>
            </View>
          );
        })}
      </Card>
      <T variant="sub" weight="semibold">
        {`${count} ${count === 1 ? 'task' : 'tasks'} · ${formatMinutes(totalSec / 60)}`}
      </T>
    </>
  );
}
