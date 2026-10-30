import {
  BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_800ExtraBold,
} from '@expo-google-fonts/fraunces';
import {
  IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import type { LookMix } from './look';

/** Passed to useFonts() once at startup. The keys become the fontFamily names. */
export const FONT_ASSETS = {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
  Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_800ExtraBold,
  BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
  IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
};

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
export type FontSet = Record<Weight, string>;

// On Android a custom font ignores fontWeight, so each weight is its own family name.
const set = (prefix: string, extrabold = '800ExtraBold'): FontSet => ({
  regular: `${prefix}_400Regular`, medium: `${prefix}_500Medium`, semibold: `${prefix}_600SemiBold`,
  bold: `${prefix}_700Bold`, extrabold: `${prefix}_${extrabold}`,
});

export const FONT_SETS: Record<LookMix['font'], FontSet> = {
  jakarta: set('PlusJakartaSans'),
  nunito: set('Nunito'),
  fraunces: set('Fraunces'),
  bricolage: set('BricolageGrotesque'),
  plex: set('IBMPlexMono', '700Bold'), // Plex Mono has no 800
};
