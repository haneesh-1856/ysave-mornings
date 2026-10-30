import { collectionLooks } from '@/theme/tokens';

import { collectionNoun, unitNoun } from '../collectionNoun';

const ARTS = Object.keys(collectionLooks) as (keyof typeof collectionLooks)[];

describe('collectionNoun / unitNoun', () => {
  it('names the collection and its unit for all 12 looks', () => {
    expect(ARTS).toHaveLength(12);
    expect(ARTS.map(a => collectionNoun(a))).toEqual(
      ['jar', 'jar', 'jar', 'garden', 'sky', 'bracelet', 'cairn', 'lights', 'honeycomb', 'shelf', 'plant', 'stamp card'],
    );
    expect(ARTS.map(a => unitNoun(a, 1))).toEqual(
      ['marble', 'marble', 'marble', 'flower', 'star', 'bead', 'stone', 'light', 'cell', 'book', 'leaf', 'stamp'],
    );
  });
  it('pluralises, with the leaf exception', () => {
    expect(unitNoun('glass', 0)).toBe('marbles');
    expect(unitNoun('glass', 2)).toBe('marbles');
    expect(unitNoun('plant', 1)).toBe('leaf');
    expect(unitNoun('plant', 3)).toBe('leaves');
    expect(unitNoun('card', 5)).toBe('stamps');
  });
});
