import type { ReactNode } from 'react';
import { View } from 'react-native';

import { T } from './T';

/** Screen title with a small right-hand note, e.g. "Today · 2 of 5 done", and an optional `right` element (e.g. a button). */
export function Header({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <T variant="title" accessibilityRole="header">{title}</T>
      {note || right ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          {note ? <T variant="sub" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{note}</T> : null}
          {right}
        </View>
      ) : null}
    </View>
  );
}
