import { Pressable, View } from 'react-native';

import type { CollectionItem } from '@/domain/collection';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Card } from './Card';
import { Collection } from './collection/Collection';
import { collectionNoun, unitNoun } from './collectionNoun';
import { T } from './T';

type Props = {
  items: CollectionItem[];
  closed: boolean;
  onPress?: () => void;
  /** Shows the small Close button (the day can close). */
  onClose?: () => void;
};

const COLLECTION_SCALE = 0.5;

/** Bottom dock (layout 'dock'), a Card in the look's surface: a small collection, "Today's <noun> / N <units>" and, when the day can close, Close. */
export function Dock({ items, closed, onPress, onClose }: Props) {
  const t = useTheme();
  const n = items.length;
  const noun = collectionNoun(t.look.art);
  const label = `Today's ${noun}, ${n} ${unitNoun(t.look.art, n)}${closed ? ', closed' : ''}`;
  const body = (
    <>
      <Collection items={items} closed={closed} scale={COLLECTION_SCALE} animateLast />
      <View style={{ flex: 1 }}>
        <T variant="label" importantForAccessibility="no">{`Today's ${noun}`}</T>
        <T weight="bold" importantForAccessibility="no">{`${n} ${unitNoun(t.look.art, n)}`}</T>
      </View>
    </>
  );
  const close = onClose ? (
    <Button label="Close" accessibilityLabel="Close today" onPress={onClose} style={{ minHeight: 44, paddingHorizontal: 14 }} />
  ) : null;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12 }}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {body}
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>{body}</View>
      )}
      {close}
    </Card>
  );
}
