import { DEFAULT_LOOK, normalizeLook, type LookMix } from './look';
import { collectionLooks, palettes, presets } from './tokens';

/** One of the (at most 5) looks the Look screen lists; the array order is most recently used first. */
export type LookFavourite = { id: string; name: string; mix: LookMix; pinned: boolean; usedAt: number };

export const MAX_FAVOURITES = 5;

const seedMix = (name: string) => normalizeLook(presets.find(p => p.name === name)?.mix);

/** First run: the owner's style-lab mix plus four ready-made presets. */
export const SEED_FAVOURITES: LookFavourite[] = [
  { name: 'Night owl glass', mix: DEFAULT_LOOK },
  { name: 'Morning mist', mix: seedMix('Morning mist') },
  { name: 'Sunrise jam', mix: seedMix('Sunrise jam') },
  { name: 'Lagoon glass', mix: seedMix('Lagoon glass') },
  { name: 'Lavender journal', mix: seedMix('Lavender journal') },
].map((f, i) => ({ id: `seed-${i + 1}`, name: f.name, mix: f.mix, pinned: false, usedAt: 0 }));

export const sameLook = (a: LookMix, b: LookMix) => (Object.keys(a) as (keyof LookMix)[]).every(k => a[k] === b[k]);

/** '<palette name> · <collection name>', e.g. 'Night owl · Garden'. */
export const autoName = (mix: LookMix) => `${palettes[mix.pal].name} · ${collectionLooks[mix.art]}`;

/** Accepts anything stored: absent -> seeds; drops invalid entries, normalizes mixes, de-duplicates, caps at 5. */
export function normalizeFavourites(input: unknown): LookFavourite[] {
  if (!Array.isArray(input)) return SEED_FAVOURITES;
  const out: LookFavourite[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string' || !r.name) continue;
    if (!r.mix || typeof r.mix !== 'object') continue;
    const mix = normalizeLook(r.mix);
    if (out.some(f => f.id === r.id || sameLook(f.mix, mix))) continue;
    out.push({
      id: r.id,
      name: r.name,
      mix,
      pinned: r.pinned === true,
      usedAt: typeof r.usedAt === 'number' && Number.isFinite(r.usedAt) ? r.usedAt : 0,
    });
    if (out.length === MAX_FAVOURITES) break;
  }
  return out;
}

/** The look was used: an equal mix moves to the top, else a new entry is added (evicting the oldest unpinned). */
export function recordFavourite(list: LookFavourite[], mix: LookMix, at: number, newId: () => string): LookFavourite[] {
  const i = list.findIndex(f => sameLook(f.mix, mix));
  if (i >= 0) return [{ ...list[i], usedAt: at }, ...list.slice(0, i), ...list.slice(i + 1)];
  const next = [{ id: newId(), name: autoName(mix), mix, pinned: false, usedAt: at }, ...list];
  if (next.length <= MAX_FAVOURITES) return next;
  // The array is most-recent-first, so the last unpinned entry is the least recently used.
  for (let j = next.length - 1; j > 0; j--) {
    if (!next[j].pinned) return [...next.slice(0, j), ...next.slice(j + 1)];
  }
  return list; // all pinned: the look still applies, it just isn't remembered
}

export const setPinned = (list: LookFavourite[], id: string, pinned: boolean): LookFavourite[] =>
  list.map(f => (f.id === id ? { ...f, pinned } : f));
