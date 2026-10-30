import { View } from 'react-native';

import type { CollectionItem } from '@/domain/collection';
import type { LookMix } from '@/theme/look';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { navStyles } from '@/theme/tokens';

import { Card } from './Card';
import { Collection } from './collection/Collection';
import { CountdownBar } from './CountdownBar';
import { T } from './T';

const SAMPLE: CollectionItem[] = [
  { kind: 'planning', dayTaskId: null, colorKey: 'sun', small: false, gold: false, at: 1 },
  { kind: 'task', dayTaskId: 'a', colorKey: 'study', small: false, gold: true, at: 2 },
  { kind: 'task', dayTaskId: 'b', colorKey: 'home', small: true, gold: false, at: 3 },
];
const TABS = ['Topics', 'Today', 'Calendar', 'Profile'];

/** Static stand-in for the real TabBar (which needs the tabs navigator's state): same shape per nav style, no icons. */
function NavSample() {
  const t = useTheme();
  const nav = t.look.nav;
  const box =
    nav === 'float'
      ? { marginHorizontal: 8, borderRadius: t.radius.r + 14, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line, padding: 6 }
      : nav === 'bar'
        ? { borderTopWidth: 1, borderColor: t.c.line, backgroundColor: t.c.surface, paddingTop: 6 }
        : { backgroundColor: t.c.bg, paddingTop: 8 };
  return (
    <View accessible accessibilityLabel={`Tab bar: ${navStyles[nav]}`} style={[{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', minHeight: 36 }, box]}>
      {TABS.map((n, i) =>
        nav === 'minimal' ? (
          <View key={n} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i === 1 ? t.c.accent : t.c.muted }} />
        ) : (
          <T key={n} variant="sub" weight="semibold" style={{ fontSize: 11.5, color: i === 1 ? t.c.accent : t.c.muted }}>{n}</T>
        ),
      )}
    </View>
  );
}

function PreviewBody() {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.c.bg, borderRadius: t.radius.r, padding: 12, gap: 10, overflow: 'hidden', borderWidth: 1, borderColor: t.c.line }}>
      <Card>
        <T weight="bold">DSA practice</T>
        <T variant="sub">After breakfast · 30 min</T>
      </Card>
      <CountdownBar budgetMs={30 * 60_000} remainingMs={20 * 60_000} overtimeMs={0} variant={t.look.bar} />
      <View style={{ alignItems: 'center' }}>
        <Collection items={SAMPLE} closed={false} scale={0.8} />
      </View>
      <NavSample />
    </View>
  );
}

/**
 * The look in miniature, themed from `look` so it follows every tap. Pass a stable object (the saved look from the
 * store is one): the provider rebuilds the theme whenever this identity changes. Decorative, so hidden from screen readers.
 */
export function LookPreview({ look }: { look: LookMix }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ThemeProvider look={look}>
        <PreviewBody />
      </ThemeProvider>
    </View>
  );
}
