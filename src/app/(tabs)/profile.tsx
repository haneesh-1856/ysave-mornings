import { Pressable, View } from 'react-native';

import { DEFAULT_LOOK, normalizeLook, type LookMix } from '@/theme/look';
import { palettes, presets } from '@/theme/tokens';
import { useLookStore, useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

const LOOKS = [{ name: 'Your saved mix', note: 'Night owl, glass, springy', mix: DEFAULT_LOOK }, ...presets.map(p => ({ ...p, mix: normalizeLook(p.mix) }))];
const sameLook = (a: LookMix, b: LookMix) => (Object.keys(a) as (keyof LookMix)[]).every(k => a[k] === b[k]);

// M0: a preset switcher so the theme can be checked on a real phone. The full Look settings arrive in M7.
export default function ProfileScreen() {
  const t = useTheme();
  const setLook = useLookStore(s => s.setLook);
  return (
    <Screen tabs>
      <Header title="Profile" />
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
