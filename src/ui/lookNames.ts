import { sameLook, type LookFavourite } from '@/theme/favourites';
import type { LookMix } from '@/theme/look';
import { glassTints } from '@/theme/tokens';

// Names for the saved look, used by Profile's row values.

/** The favourite the mix matches exactly, or "Custom". */
export const lookName = (look: LookMix, favourites: readonly LookFavourite[]) =>
  favourites.find(f => sameLook(look, f.mix))?.name ?? 'Custom';

/** Value of the Glass row: the tint name while frosted glass is on, else "Off". */
export const glassValue = (look: LookMix) => (look.surf === 'glass' ? glassTints[look.glass].name : 'Off');
