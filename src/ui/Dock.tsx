import { useContext } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { CollectionItem } from '@/domain/collection';
import { useTheme } from '@/theme/ThemeProvider';

import { Collection } from './collection/Collection';

type Props = { items: CollectionItem[]; closed: boolean; onPress?: () => void };

const JAR_SCALE = 0.5;

/** Bottom dock holding a small jar (layout 'dock'). Other layouts are M7. */
export function Dock({ items, closed, onPress }: Props) {
  const t = useTheme();
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const n = items.length;
  const label = `Today's jar, ${n} ${n === 1 ? 'marble' : 'marbles'}${closed ? ', closed' : ''}`;
  const style = {
    alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 44, paddingTop: 8, paddingBottom: 8 + bottom,
    backgroundColor: t.c.surface, borderTopWidth: 1, borderTopColor: t.c.line,
  };
  const jar = <Collection items={items} closed={closed} scale={JAR_SCALE} animateLast />;
  if (!onPress) return <View style={style}>{jar}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {jar}
    </Pressable>
  );
}
