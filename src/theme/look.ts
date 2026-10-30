import {
  bars, collectionLooks, fonts, glassBlurs, glassTints, layouts, motions, navStyles, palettes, shapes, surfaces, transitions,
} from './tokens';

/** Everything the user can change about how the app looks (docs/06-design-system.md#the-look-mix). */
export type LookMix = {
  pal: keyof typeof palettes;
  font: keyof typeof fonts;
  shape: keyof typeof shapes;
  surf: keyof typeof surfaces;
  glass: keyof typeof glassTints;
  gblur: keyof typeof glassBlurs;
  art: keyof typeof collectionLooks;
  motion: keyof typeof motions;
  trans: keyof typeof transitions;
  layout: keyof typeof layouts;
  bar: keyof typeof bars;
  nav: keyof typeof navStyles;
};

const OPTIONS: { [K in keyof LookMix]: Record<LookMix[K], unknown> } = {
  pal: palettes, font: fonts, shape: shapes, surf: surfaces, glass: glassTints, gblur: glassBlurs,
  art: collectionLooks, motion: motions, trans: transitions, layout: layouts, bar: bars, nav: navStyles,
};

/** The owner's saved mix from the style lab (2026-10-23). */
export const DEFAULT_LOOK: LookMix = {
  pal: 'night', font: 'jakarta', shape: 'soft', surf: 'glass', glass: 'match', gblur: 'medium',
  art: 'glass', motion: 'springy', trans: 'slide', layout: 'dock', bar: 'thin', nav: 'float',
};

/** Accepts anything (e.g. JSON from an older app version) and returns a valid mix, field by field. */
export function normalizeLook(input: unknown): LookMix {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_LOOK } as Record<keyof LookMix, string>;
  for (const key of Object.keys(OPTIONS) as (keyof LookMix)[]) {
    const v = src[key];
    if (typeof v === 'string' && Object.hasOwn(OPTIONS[key], v)) out[key] = v;
  }
  return out as LookMix;
}
