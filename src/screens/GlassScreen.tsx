import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { confirmLook } from '@/state/actions/look';
import type { LookMix } from '@/theme/look';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { glassBlurs, glassTints } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChipSet } from '@/ui/ChipSet';
import { GlassSwatch } from '@/ui/GlassSwatch';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { Switch } from '@/ui/Switch';
import { T } from '@/ui/T';

const goBack = () => router.back();
const blurKeys = Object.keys(glassBlurs) as (keyof typeof glassBlurs)[];
const tintKeys = Object.keys(glassTints) as (keyof typeof glassTints)[];

/** One sample card in the draft look (decorative, so hidden from screen readers). */
function GlassPreview({ look }: { look: LookMix }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ThemeProvider look={look}>
        <PreviewCard />
      </ThemeProvider>
    </View>
  );
}

function PreviewCard() {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.c.bg, borderRadius: t.radius.r, padding: 12, overflow: 'hidden', borderWidth: 1, borderColor: t.c.line }}>
      <Card>
        <T weight="bold">DSA practice</T>
        <T variant="sub">After breakfast · 30 min</T>
      </Card>
    </View>
  );
}

export function GlassScreen() {
  const t = useTheme();
  const look = t.look;
  const savedOn = look.surf === 'glass';
  // Whole-screen draft; nothing is saved until Confirm, and leaving the screen drops it.
  const [on, setOn] = useState(savedOn);
  const [glass, setGlass] = useState(look.glass);
  const [gblur, setGblur] = useState(look.gblur);

  const onChanged = on !== savedOn;
  const changed = onChanged || glass !== look.glass || gblur !== look.gblur;
  // Memoized so the preview's override provider only rebuilds its theme when the draft really changes.
  const draft = useMemo<LookMix>(
    () => (changed ? { ...look, surf: onChanged ? (on ? 'glass' : 'flat') : look.surf, glass, gblur } : look),
    [look, changed, onChanged, on, glass, gblur],
  );

  // Android back = the "‹ Profile" button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const confirm = () => {
    const patch: Partial<LookMix> = {};
    if (onChanged) patch.surf = on ? 'glass' : 'flat';
    if (glass !== look.glass) patch.glass = glass;
    if (gblur !== look.gblur) patch.gblur = gblur;
    confirmLook(patch); // the saved look then equals the draft, so Confirm disables again
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="Glass" />
      <T variant="sub">Pick the colors that glow behind your cards. Your chain follows along.</T>
      <GlassPreview look={draft} />
      <Card style={{ paddingVertical: 2 }}>
        <Switch label="Frosted glass" value={on} onChange={setOn} />
      </Card>
      <T variant="label">{`TINT · ${glassTints[glass].name.toUpperCase()}`}</T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Glass tint" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {tintKeys.map(k => {
          const sel = on && glass === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityLabel={glassTints[k].name}
              accessibilityState={{ selected: sel, checked: sel }}
              onPress={() => {
                setGlass(k);
                setOn(true);
              }}
              style={{ width: '25%', minHeight: 44, alignItems: 'center', gap: 4 }}>
              <View style={sel ? { padding: 2, borderRadius: t.radius.r + 2, borderWidth: 2, borderColor: t.c.accent } : { padding: 4 }}>
                <GlassSwatch tint={glassTints[k]} />
              </View>
              <T variant="sub" weight={sel ? 'bold' : 'semibold'} color={sel ? 'ink' : 'muted'} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>{glassTints[k].name}</T>
            </Pressable>
          );
        })}
      </View>
      <T variant="label">BLUR</T>
      <ChipSet
        label="Glass blur"
        clearable={false}
        options={blurKeys.map(k => glassBlurs[k].name)}
        value={glassBlurs[gblur].name}
        onChange={n => {
          const k = blurKeys.find(b => glassBlurs[b].name === n);
          if (k) setGblur(k);
        }}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Confirm" disabled={!changed} onPress={confirm} />
        <Button label="Cancel" kind="ghost" onPress={goBack} />
      </View>
    </Screen>
  );
}
