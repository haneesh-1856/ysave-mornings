import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useDayStart } from '@/state/hooks/useDayStart';
import { useProfileStats } from '@/state/hooks/useProfileStats';
import { DEFAULT_LOOK, normalizeLook, type LookMix } from '@/theme/look';
import { palettes, presets } from '@/theme/tokens';
import { useLookStore, useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { hourText } from '@/ui/dayNames';
import { Screen } from '@/ui/Screen';
import { SettingRow } from '@/ui/SettingRow';
import { StatTiles } from '@/ui/StatTiles';
import { T } from '@/ui/T';

const LOOKS = [{ name: 'Your saved mix', note: 'Night owl, glass, springy', mix: DEFAULT_LOOK }, ...presets.map(p => ({ ...p, mix: normalizeLook(p.mix) }))];
const sameLook = (a: LookMix, b: LookMix) => (Object.keys(a) as (keyof LookMix)[]).every(k => a[k] === b[k]);

/** Focused time as hours: whole hours from 10h up ("14h"), one decimal below ("3.5h", "0h" for none). */
export function hoursText(hours: number): string {
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${Math.round(hours * 10) / 10}h`;
}

export function ProfileScreen() {
  const t = useTheme();
  const setLook = useLookStore(s => s.setLook);
  const stats = useProfileStats();
  const { hour } = useDayStart();
  const lookName = LOOKS.find(l => sameLook(t.look, l.mix))?.name ?? 'Custom';
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
          { value: String(stats.marbles), label: 'marbles' },
        ]}
      />
      <Card style={{ paddingVertical: 2 }}>
        <SettingRow label="My day starts" value={hourText(hour)} onPress={() => router.push('/settings/day-start')} />
        <SettingRow label="Look" value={lookName} tag={false} />
        <T variant="sub" style={{ fontSize: 12 }}>Full settings in M7</T>
        <SettingRow label="Glass" value="Coming in M7" />
        <SettingRow label="Sounds" value="Coming later" />
        <SettingRow label="Reminders" value="Not decided" />
        <SettingRow label="Friends & teams" value="Coming later" />
      </Card>
      {/* M0 preset switcher, kept so the theme can be checked on a real phone. */}
      <T variant="label">Try a look</T>
      <Card style={{ gap: 4 }}>
        {LOOKS.map(p => (
          <Preset key={p.name} name={p.name} note={p.note} onPress={() => setLook(p.mix)} on={sameLook(t.look, p.mix)} swatch={palettes[p.mix.pal]} />
        ))}
      </Card>
    </Screen>
  );
}

type PresetProps = { name: string; note: string; on: boolean; onPress: () => void; swatch: { accent: string; study: string; health: string; home: string } };
function Preset({ name, note, on, onPress, swatch }: PresetProps) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Use the ${name} look`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[swatch.accent, swatch.study, swatch.health, swatch.home].map((c, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c }} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <T weight={on ? 'bold' : 'semibold'}>{name}</T>
        <T variant="sub">{note}</T>
      </View>
      {on ? <T style={{ color: t.c.accent }}>✓</T> : null}
    </Pressable>
  );
}
