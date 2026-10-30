import { View } from 'react-native';

import { T } from './T';

/** Screen title with a small right-hand note, e.g. "Today · 2 of 5 done". */
export function Header({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <T variant="title" accessibilityRole="header">{title}</T>
      {note ? <T variant="sub" weight="semibold">{note}</T> : null}
    </View>
  );
}
