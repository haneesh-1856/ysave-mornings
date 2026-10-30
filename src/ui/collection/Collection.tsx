import { useTheme } from '@/theme/ThemeProvider';

import { Bracelet } from './Bracelet';
import { Cairn } from './Cairn';
import { Garden } from './Garden';
import { Honey } from './Honey';
import { Jar, type CollectionProps } from './Jar';
import { Lights } from './Lights';
import { Plant } from './Plant';
import { Shelf } from './Shelf';
import { Sky } from './Sky';
import { StampCard } from './StampCard';

export type { CollectionProps };

/** Picks the renderer for the look's collection style (`theme.look.art`); `glass` is the plain jar. */
export function Collection(props: CollectionProps) {
  switch (useTheme().look.art) {
    case 'line': return <Jar {...props} variant="line" />;
    case 'paper': return <Jar {...props} variant="paper" />;
    case 'garden': return <Garden {...props} />;
    case 'plant': return <Plant {...props} />;
    case 'sky': return <Sky {...props} />;
    case 'bracelet': return <Bracelet {...props} />;
    case 'cairn': return <Cairn {...props} />;
    case 'lights': return <Lights {...props} />;
    case 'honey': return <Honey {...props} />;
    case 'shelf': return <Shelf {...props} />;
    case 'card': return <StampCard {...props} />;
    default: return <Jar {...props} />;
  }
}
