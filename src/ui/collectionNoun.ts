import { collectionNouns, type collectionLooks } from '@/theme/tokens';

type Art = keyof typeof collectionLooks;

/** What the collection is called in this look: "jar", "garden", "sky", ... "stamp card". */
export const collectionNoun = (art: Art): string => collectionNouns[art][0];

/** What one item is called, with a plural for n !== 1: "marbles", "leaf"/"leaves", "stamp"/"stamps". */
export function unitNoun(art: Art, n: number): string {
  const unit: string = collectionNouns[art][1];
  return n === 1 ? unit : unit === 'leaf' ? 'leaves' : `${unit}s`;
}
