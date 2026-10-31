import { sameLook, type LookFavourite } from '@/theme/favourites';
import type { LookMix } from '@/theme/look';
import { glassTints, palettes } from '@/theme/tokens';

// Names for the saved look, used by Profile's row values.

/** The favourite the mix matches exactly, or "Custom". */
export const lookName = (look: LookMix, favourites: readonly LookFavourite[]) =>
  favourites.find(f => sameLook(look, f.mix))?.name ?? 'Custom';

/** Value of the Color & glass row: the palette (when the tint matches it) or the tint name, then whether the cards are frosted. */
export const glassValue = (look: LookMix) => `${look.glass === 'match' ? palettes[look.pal].name : glassTints[look.glass].name} · ${look.surf === 'glass' ? 'Frosted' : 'No frost'}`;
