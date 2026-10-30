import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';

import { applyFavourite, confirmLook, setFavouritePinned } from '@/state/actions/look';
import { useLookFavourites } from '@/state/hooks/useLookFavourites';
import { sameLook } from '@/theme/favourites';
import { normalizeLook, type LookMix } from '@/theme/look';
import { useTheme } from '@/theme/ThemeProvider';
import {
  bars, collectionLooks, fonts, layouts, motions, navStyles, palettes, shapes, surfaces, transitions,
} from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChipSet } from '@/ui/ChipSet';
import { collectionNoun } from '@/ui/collectionNoun';
import { Header } from '@/ui/Header';
import { LookPreview } from '@/ui/LookPreview';
import { glassValue } from '@/ui/lookNames';
import { Screen } from '@/ui/Screen';
import { SettingRow } from '@/ui/SettingRow';
import { T } from '@/ui/T';

const goBack = () => router.back();

type Dim = { key: keyof LookMix; title: string; hint: string; options: Record<string, string> };
const names = (o: Record<string, { name: string }>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.name]));

// Order, titles and hints from the style lab's DIMS. Glass tint + Glass blur are one row (the Glass screen), after Surfaces.
const BEFORE_GLASS: Dim[] = [
  { key: 'pal', title: 'Colors', hint: 'the whole palette', options: names(palettes) },
  { key: 'font', title: 'Typeface', hint: 'personality of the words', options: names(fonts) },
  { key: 'shape', title: 'Corners', hint: 'how soft things feel', options: names(shapes) },
  { key: 'surf', title: 'Surfaces', hint: 'how cards sit on the screen', options: surfaces },
];
const AFTER_GLASS: Dim[] = [
  { key: 'art', title: 'Collection', hint: 'what each finished task adds to your day', options: collectionLooks },
  { key: 'motion', title: 'Motion', hint: 'speed and bounce of every movement', options: names(motions) },
  { key: 'trans', title: 'Screen transition', hint: 'how one screen becomes the next', options: transitions },
  { key: 'layout', title: 'Home structure', hint: 'where the jar lives on Today', options: layouts },
  { key: 'bar', title: 'Countdown bar', hint: 'variants of your draining bar', options: bars },
  { key: 'nav', title: 'Bottom tabs', hint: 'how you move between the four pages', options: navStyles },
];

export function LookScreen() {
  const t = useTheme();
  const look = t.look;
  const favourites = useLookFavourites();
  // The one open row and its pending pick (an option key). Local state: leaving the screen discards it.
  const [open, setOpen] = useState<keyof LookMix | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  // Memoized so the preview's override provider only rebuilds its theme when the draft really changes.
  const draft = useMemo(() => (open && pick ? normalizeLook({ ...look, [open]: pick }) : look), [look, open, pick]);

  // Android back = the "‹ Profile" button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const close = () => {
    setOpen(null);
    setPick(null);
  };

  const section = (d: Dim) => {
    const isOpen = open === d.key;
    const current = d.options[look[d.key]];
    const picked = isOpen && pick ? pick : look[d.key];
    const entries = Object.entries(d.options);
    const hint = d.key === 'layout' ? `where the ${collectionNoun(look.art)} lives on Today` : d.hint;
    return (
      <Card key={d.key} style={{ paddingVertical: 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${d.title}, ${current}`}
          accessibilityState={{ expanded: isOpen }}
          onPress={() => {
            // Opening another row (or closing this one) discards a pending pick.
            setPick(null);
            setOpen(isOpen ? null : d.key);
          }}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <T importantForAccessibility="no" weight="semibold" style={{ flex: 1 }}>{d.title}</T>
          <T importantForAccessibility="no" variant="sub">{current}</T>
          <T importantForAccessibility="no" variant="sub" weight="bold">{isOpen ? '⌄' : '›'}</T>
        </Pressable>
        {isOpen ? (
          <View style={{ gap: 10, paddingBottom: 10 }}>
            <T variant="sub">{hint}</T>
            {d.key === 'pal' ? (
              <PaletteChips value={picked as LookMix['pal']} onPick={setPick} />
            ) : (
              <ChipSet
                label={d.title}
                clearable={false}
                options={entries.map(([, n]) => n)}
                value={d.options[picked]}
                onChange={n => {
                  const k = entries.find(([, name]) => name === n)?.[0];
                  if (k) setPick(k);
                }}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label="Confirm"
                disabled={!pick || pick === look[d.key]}
                onPress={() => {
                  confirmLook({ [d.key]: pick });
                  close();
                }}
              />
              <Button label="Cancel" kind="ghost" onPress={close} />
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={goBack} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T color="accent" weight="bold">‹ Profile</T>
      </Pressable>
      <Header title="Look" />
      <LookPreview look={draft} />
      <T variant="label">FAVOURITES</T>
      <Card style={{ gap: 4 }}>
        {favourites.map(f => {
          const on = sameLook(look, f.mix);
          const sw = palettes[f.mix.pal];
          return (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use the ${f.name} look`}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  close();
                  applyFavourite(f.id);
                }}
                style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {[sw.accent, sw.study, sw.health, sw.home].map((c, i) => (
                    <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c }} />
                  ))}
                </View>
                <T weight={on ? 'bold' : 'semibold'} style={{ flex: 1 }}>{f.name}</T>
                {on ? <T style={{ color: t.c.accent }}>✓</T> : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${f.pinned ? 'Unpin' : 'Pin'} ${f.name}`}
                accessibilityState={{ selected: f.pinned }}
                onPress={() => setFavouritePinned(f.id, !f.pinned)}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T importantForAccessibility="no" variant="sub" weight={f.pinned ? 'bold' : 'medium'} style={{ color: f.pinned ? t.c.accent : t.c.muted }}>
                  {f.pinned ? 'Pinned' : 'Pin'}
                </T>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <T variant="label">CHANGE ONE THING</T>
      {BEFORE_GLASS.map(section)}
      <Card style={{ paddingVertical: 2 }}>
        <SettingRow label="Glass" value={glassValue(look)} onPress={() => router.push('/settings/glass')} />
      </Card>
      {AFTER_GLASS.map(section)}
    </Screen>
  );
}

/** The six palettes as chips with a 4-dot swatch; selection = filled chip + check (never color alone). */
function PaletteChips({ value, onPick }: { value: LookMix['pal']; onPick: (k: LookMix['pal']) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Colors" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {(Object.keys(palettes) as LookMix['pal'][]).map(k => {
        const on = k === value;
        const p = palettes[k];
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityLabel={p.name}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onPick(k)}
            style={{
              minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: t.radius.rb,
              borderWidth: 1, borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : 'transparent',
            }}>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[p.accent, p.study, p.health, p.home].map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, borderWidth: 1, borderColor: t.c.line }} />
              ))}
            </View>
            <T variant="sub" weight="bold" style={{ color: on ? t.c.on : t.c.ink }}>{on ? `✓ ${p.name}` : p.name}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
