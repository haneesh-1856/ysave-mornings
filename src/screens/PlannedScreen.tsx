import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { isDayKey } from '@/domain/dayKey';
import type { DayKey } from '@/domain/types';
import { useDayPlan } from '@/state/hooks/useDayPlan';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { usePlanTopics } from '@/state/hooks/usePlanTopics';
import { Button } from '@/ui/Button';
import { Collection } from '@/ui/collection/Collection';
import { weekdayName } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { PlannedList } from '@/ui/PlannedList';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

/** Route wrapper: reads the param and validates it. */
export function PlannedRoute() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  return <PlannedScreen dayKey={dayKey} />;
}

// Pop back to the existing (tabs) entry in the root stack (Today tab focused) instead of stacking a
// second (tabs) instance; if none exists, dismissTo replaces the current screen with it.
const goToday = () => router.dismissTo('/(tabs)/today');
// Plan takes this screen's place; Plan's confirm then replaces itself with a fresh Planned, so the
// stack never holds two Planned screens.
const replaceWithPlan = (dayKey: DayKey) => router.replace({ pathname: '/plan/[dayKey]', params: { dayKey } });

export function PlannedScreen({ dayKey }: { dayKey: string | undefined }) {
  if (!dayKey || !isDayKey(dayKey)) {
    return (
      <Screen>
        <Header title="Not a day" />
        <T>That is not a day we can show.</T>
        <Button label="Back to Today" onPress={goToday} />
      </Screen>
    );
  }
  return <PlannedBody dayKey={dayKey} />;
}

function PlannedBody({ dayKey }: { dayKey: DayKey }) {
  const { todayKey, days } = usePlannableDays();
  const { day, rows, items } = useDayPlan(dayKey);
  const topics = usePlanTopics();
  const plannable = days.includes(dayKey);
  const name = dayKey === todayKey ? 'Today' : weekdayName(dayKey);
  const planned = day != null && day.planConfirmedAt != null;

  if (!planned) {
    return (
      <Screen>
        <Header title={`Nothing planned for ${name} yet`} />
        {plannable ? <Button label="Plan it" onPress={() => replaceWithPlan(dayKey)} /> : null}
        <Button label="Back to Today" kind={plannable ? 'ghost' : 'primary'} onPress={goToday} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {plannable ? <Button label="Edit" kind="ghost" onPress={() => replaceWithPlan(dayKey)} /> : null}
          <Button testID="planned-done" label="Done" onPress={goToday} />
        </>
      }>
      <Header title={`${name} is planned`} />
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Collection items={items} closed={false} scale={2.3} animateLast />
      </View>
      <PlannedList rows={rows} topics={topics} />
    </Screen>
  );
}
