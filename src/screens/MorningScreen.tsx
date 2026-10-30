import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, View } from 'react-native';

import { useChain } from '@/state/hooks/useChain';
import { markMorningSeen, useMorning } from '@/state/hooks/useMorning';
import { usePlannableDays } from '@/state/hooks/usePlannableDays';
import { Button } from '@/ui/Button';
import { Chain } from '@/ui/Chain';
import { Collection } from '@/ui/collection/Collection';
import { weekdayName } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { SunriseCard } from '@/ui/SunriseCard';
import { T } from '@/ui/T';

// Pop back to the existing (tabs) entry, or replace this screen with it when Morning is the only route
// (the cold-launch Redirect replaces '/', so a plain back would exit the app).
const goToday = () => router.dismissTo('/(tabs)/today');

/** Morning, "A fresh page": the day, the soft chain, and today's jar if it is already planned. */
export function MorningScreen() {
  const { todayKey, dayNumber, plannedToday, items } = useMorning();
  const links = useChain();
  const { days } = usePlannableDays();
  const canPlan = days.includes(todayKey);

  // Shown once per day: marking it seen also re-arms the new-day redirect (useMorningRedirect).
  useEffect(() => {
    markMorningSeen();
  }, []);

  // Android back goes to Today rather than leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToday();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <Screen footer={<Button label={plannedToday ? "See today's plan" : 'Go to Today'} onPress={goToday} />}>
      <Header title={weekdayName(todayKey)} note={`Day ${dayNumber}`} />
      <Chain links={links} />
      <SunriseCard dayName={weekdayName(todayKey)} dayNumber={dayNumber} />
      {plannedToday ? (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Collection items={items} closed={false} scale={2} animateLast />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <T>Today isn&apos;t planned yet</T>
          {canPlan ? (
            <Button
              label="Plan today"
              kind="ghost"
              onPress={() => router.replace({ pathname: '/plan/[dayKey]', params: { dayKey: todayKey } })}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
