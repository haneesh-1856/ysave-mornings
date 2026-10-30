import {
  autoName, MAX_FAVOURITES, normalizeFavourites, recordFavourite, SEED_FAVOURITES, setPinned, type LookFavourite,
} from '../favourites';
import { DEFAULT_LOOK, type LookMix } from '../look';

const mixOf = (patch: Partial<LookMix>): LookMix => ({ ...DEFAULT_LOOK, ...patch });
let n = 0;
const id = () => `new-${++n}`;

describe('seeds', () => {
  it('are five distinct looks in order', () => {
    expect(SEED_FAVOURITES.map(f => f.name)).toEqual([
      'Night owl glass', 'Morning mist', 'Sunrise jam', 'Lagoon glass', 'Lavender journal',
    ]);
    expect(SEED_FAVOURITES.map(f => f.id)).toEqual(['seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5']);
    expect(SEED_FAVOURITES[0].mix).toEqual(DEFAULT_LOOK);
    expect(normalizeFavourites(SEED_FAVOURITES)).toHaveLength(5);
  });
});

describe('normalizeFavourites', () => {
  it('seeds when absent or not an array', () => {
    expect(normalizeFavourites(undefined)).toEqual(SEED_FAVOURITES);
    expect(normalizeFavourites('x')).toEqual(SEED_FAVOURITES);
  });
  it('drops invalid entries, normalizes mixes, de-duplicates, caps', () => {
    const good = { id: 'a', name: 'A', mix: { pal: 'sunrise' }, pinned: true, usedAt: 5 };
    const out = normalizeFavourites([null, 3, { id: 'x' }, good, { ...good, id: 'b' }]);
    expect(out).toEqual([{ ...good, mix: mixOf({ pal: 'sunrise' }) }]); // 'b' has an equal mix
    const arts = ['glass', 'line', 'paper', 'garden', 'sky', 'bracelet', 'cairn', 'lights'];
    const many = arts.map((art, i) => ({ id: `i${i}`, name: 'n', mix: { art } }));
    expect(normalizeFavourites(many)).toHaveLength(MAX_FAVOURITES);
  });
});

describe('recordFavourite', () => {
  it('moves an equal mix to the top keeping name and pin', () => {
    const list = setPinned(SEED_FAVOURITES, 'seed-3', true);
    const out = recordFavourite(list, SEED_FAVOURITES[2].mix, 50, id);
    expect(out[0]).toEqual({ ...list[2], usedAt: 50 });
    expect(out).toHaveLength(5);
  });
  it('adds a new top entry and evicts the least recently used unpinned', () => {
    const out = recordFavourite(SEED_FAVOURITES, mixOf({ art: 'garden' }), 9, id);
    expect(out[0]).toMatchObject({ name: 'Night owl · Garden', pinned: false, usedAt: 9 });
    expect(out).toHaveLength(5);
    expect(out.find(f => f.id === 'seed-5')).toBeUndefined();
  });
  it('skips pinned entries when evicting', () => {
    const list = setPinned(SEED_FAVOURITES, 'seed-5', true);
    const out = recordFavourite(list, mixOf({ art: 'garden' }), 9, id);
    expect(out.find(f => f.id === 'seed-5')).toBeDefined();
    expect(out.find(f => f.id === 'seed-4')).toBeUndefined();
  });
  it('leaves the list unchanged when all are pinned', () => {
    const all: LookFavourite[] = SEED_FAVOURITES.map(f => ({ ...f, pinned: true }));
    expect(recordFavourite(all, mixOf({ art: 'garden' }), 9, id)).toBe(all);
  });
});

describe('setPinned / autoName', () => {
  it('toggles one entry', () => {
    const out = setPinned(SEED_FAVOURITES, 'seed-2', true);
    expect(out.map(f => f.pinned)).toEqual([false, true, false, false, false]);
  });
  it('names from palette and collection', () => {
    expect(autoName(DEFAULT_LOOK)).toBe('Night owl · Glass jar');
    expect(autoName(mixOf({ pal: 'mist', art: 'sky' }))).toBe('Mist · Constellation');
  });
});
