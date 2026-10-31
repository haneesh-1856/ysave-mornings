import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { confirmLook } from '@/state/actions/look';
import type { LookMix } from '@/theme/look';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { glassBlurs, glassTints, palettes } from '@/theme/tokens';
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
const palKeys = Object.keys(palettes) as LookMix['pal'][];
/** "Match the palette" is the palette entries themselves, so it is not listed as a tint; the key still works in saved looks. */
const tintKeys = (Object.keys(glassTints) as (keyof typeof glassTints)[]).filter(k => k !== 'match');

/** A palette as a 52 pt tile: its page color with a card and an accent dot on it (drawn from the palette, not the current theme). */
function PaletteSwatch({ pal }: { pal: LookMix['pal'] }) {
  const t = useTheme();
  const p = palettes[pal];
  return (
    <View style={{ width: 52, height: 52, borderRadius: Math.max(2, t.radius.r - 2), backgroundColor: p.bg, borderWidth: 1, borderColor: p.line, padding: 9, justifyContent: 'center' }}>
      <View style={{ flex: 1, borderRadius: 6, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 5 }}>
        <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: p.accent }} />
      </View>
    </View>
  );
}

/** One sample card in the draft look (decorative, so hidden from screen readers). */
function GlassPreview({ look, blurChosen }: { look: LookMix; blurChosen?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ThemeProvider look={look} blurChosen={blurChosen}>
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
  // Turning frost off goes back to the surface the user had; the saved look only remembers it while glass is off.
  const restoreSurf: LookMix['surf'] = savedOn ? 'flat' : look.surf;
  // Whole-screen draft; nothing is saved until Confirm, and leaving the screen drops it.
  const [on, setOn] = useState(savedOn);
  const [pal, setPal] = useState(look.pal);
  const [glass, setGlass] = useState(look.glass);
  const [gblur, setGblur] = useState(look.gblur);
  // Low-end phone, no blur level picked yet: the blur is off, so no level shows as selected until the user taps one.
  const lowEndDefault = t.lowEndDefault;
  const [blurPicked, setBlurPicked] = useState(false);
  const blurPending = lowEndDefault && blurPicked; // confirming this counts as a choice even at the same level

  // With "match the palette" the palette is the pick; any other tint is the pick and the palette is its light/dark base.
  const colorName = glass === 'match' ? palettes[pal].name : glassTints[glass].name;
  const onChanged = on !== savedOn;
  const changed = onChanged || pal !== look.pal || glass !== look.glass || gblur !== look.gblur || blurPending;
  // Memoized so the preview's override provider only rebuilds its theme when the draft really changes.
  const draft = useMemo<LookMix>(
    () => (changed ? { ...look, surf: onChanged ? (on ? 'glass' : restoreSurf) : look.surf, pal, glass, gblur } : look),
    [look, changed, onChanged, on, restoreSurf, pal, glass, gblur],
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
    if (onChanged) patch.surf = on ? 'glass' : restoreSurf;
    if (pal !== look.pal) patch.pal = pal;
    if (glass !== look.glass) patch.glass = glass;
    if (gblur !== look.gblur) patch.gblur = gblur;
    confirmLook(patch, { chooseBlur: blurPending }); // the saved look then equals the draft, so Confirm disables again
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="Color & glass" />
      <T variant="sub">Pick the color used across the whole app.</T>
      <GlassPreview look={draft} blurChosen={lowEndDefault ? blurPicked : undefined} />
      <T variant="label">{`COLOR · ${colorName.toUpperCase()}`}</T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Color" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {palKeys.map(k => {
          const sel = glass === 'match' && pal === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityLabel={palettes[k].name}
              accessibilityState={{ selected: sel, checked: sel }}
              onPress={() => {
                setPal(k);
                setGlass('match');
              }}
              style={{ width: '25%', minHeight: 44, alignItems: 'center', gap: 4 }}>
              <View style={sel ? { padding: 2, borderRadius: t.radius.r + 2, borderWidth: 2, borderColor: t.c.accent } : { padding: 4 }}>
                <PaletteSwatch pal={k} />
              </View>
              <T variant="sub" weight={sel ? 'bold' : 'semibold'} color={sel ? 'ink' : 'muted'} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>{palettes[k].name}</T>
            </Pressable>
          );
        })}
        {tintKeys.map(k => {
          const sel = glass === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityLabel={glassTints[k].name}
              accessibilityState={{ selected: sel, checked: sel }}
              onPress={() => {
                setGlass(k);
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
      <T variant="label">GLASS</T>
      <Card style={{ paddingVertical: 2 }}>
        <Switch label="Frosted glass" value={on} onChange={setOn} />
      </Card>
      {lowEndDefault && !blurPicked && <T variant="sub">Off, to save battery on this phone. Pick a level to turn it on.</T>}
      <ChipSet
        label="Glass blur"
        clearable={false}
        options={blurKeys.map(k => glassBlurs[k].name)}
        value={lowEndDefault && !blurPicked ? null : glassBlurs[gblur].name}
        onChange={n => {
          const k = blurKeys.find(b => glassBlurs[b].name === n);
          if (!k) return;
          setGblur(k);
          setBlurPicked(true);
        }}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Confirm" disabled={!changed} onPress={confirm} />
        <Button label="Cancel" kind="ghost" onPress={goBack} />
      </View>
    </Screen>
  );
}
