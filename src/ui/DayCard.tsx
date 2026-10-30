import { View } from 'react-native';

import type { CollectionItem } from '@/domain/collection';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Card } from './Card';
import { Collection } from './collection/Collection';
import { T } from './T';

type Props = {
  title: string;
  line: string;
  items: CollectionItem[];
  closed: boolean;
  glows: boolean;
  action?: { label: string; onPress: () => void };
};

/** The selected day on the Calendar: a small jar, the day's title and one calm line, and an optional "Plan"/"Edit" button. */
export function DayCard({ title, line, items, closed, glows, action }: Props) {
  const t = useTheme();
  const glow = glows
    ? { borderWidth: 1.5, borderColor: t.glow.ring, shadowColor: t.c.sun, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }
    : undefined;
  return (
    <Card style={glow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Collection items={items} closed={closed} scale={0.6} />
        <View accessible accessibilityLabel={`${title}. ${line}`} style={{ flex: 1, gap: 2 }}>
          <T importantForAccessibility="no" weight="bold">{title}</T>
          <T importantForAccessibility="no" variant="sub">{line}</T>
        </View>
        {action ? <Button label={action.label} kind="ghost" onPress={action.onPress} style={{ minHeight: 44, paddingHorizontal: 16 }} /> : null}
      </View>
    </Card>
  );
}
