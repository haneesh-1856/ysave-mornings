import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type ChainLink = 'solid' | 'rest' | 'today';

/** The soft chain: one link per day, rest days dashed, today in sun. No counter, no "broken" state. */
export function Chain({ links }: { links: ChainLink[] }) {
  const t = useTheme();
  let solid = 0;
  const rest = links.filter(l => l === 'rest').length;
  const active = links.length - rest;
  return (
    <View
      accessible
      style={{ flexDirection: 'row', gap: 4 }}
      accessibilityLabel={`Last ${links.length} days: ${active} active, ${rest} rest`}>
      {links.map((l, i) => {
        const color = l === 'today' ? t.c.sun : l === 'rest' ? t.c.muted : t.chain[solid++ % 3];
        return (
          <View
            key={i}
            style={{ width: 25, height: 13, borderRadius: 8, borderWidth: 3, borderColor: color, borderStyle: l === 'rest' ? 'dashed' : 'solid', opacity: l === 'rest' ? 0.7 : 1 }}
          />
        );
      })}
    </View>
  );
}
