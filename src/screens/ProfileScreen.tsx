import { router } from 'expo-router';
import { View } from 'react-native';

import { useDayStart } from '@/state/hooks/useDayStart';
import { useLookFavourites } from '@/state/hooks/useLookFavourites';
import { useProfileStats } from '@/state/hooks/useProfileStats';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { unitNoun } from '@/ui/collectionNoun';
import { hourText } from '@/ui/dayNames';
import { glassValue, lookName } from '@/ui/lookNames';
import { Screen } from '@/ui/Screen';
import { SettingRow } from '@/ui/SettingRow';
import { StatTiles } from '@/ui/StatTiles';
import { T } from '@/ui/T';

/** Focused time as hours: whole hours from 10h up ("14h"), one decimal below ("3.5h", "0h" for none). */
export function hoursText(hours: number): string {
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${Math.round(hours * 10) / 10}h`;
}

export function ProfileScreen() {
  const t = useTheme();
  const stats = useProfileStats();
  const { hour } = useDayStart();
  const favourites = useLookFavourites();
  return (
    <Screen tabs>
      <View style={{ alignItems: 'center', gap: 4, paddingTop: 6 }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="extrabold" style={{ fontSize: 26, lineHeight: 32, color: t.c.on }}>Y</T>
        </View>
        <T weight="bold" accessibilityRole="header" style={{ fontSize: 17 }}>You</T>
        <T variant="sub">{`Day ${stats.dayNumber} with YSave Mornings`}</T>
      </View>
      <StatTiles
        tiles={[
          { value: String(stats.daysShowedUp), label: 'days you showed up' },
          { value: hoursText(stats.focusedHours), label: 'focused' },
          { value: String(stats.marbles), label: unitNoun(t.look.art, 2) },
        ]}
      />
      <Card style={{ paddingVertical: 2 }}>
        <SettingRow label="My day starts" value={hourText(hour)} onPress={() => router.push('/settings/day-start')} />
        <SettingRow label="Look" value={lookName(t.look, favourites)} onPress={() => router.push('/settings/look')} />
        <SettingRow label="Glass" value={glassValue(t.look)} onPress={() => router.push('/settings/glass')} />
        <SettingRow label="Sounds" value="Coming later" />
        <SettingRow label="Reminders" value="Not decided" />
        <SettingRow label="Friends & teams" value="Coming later" />
      </Card>
    </Screen>
  );
}
