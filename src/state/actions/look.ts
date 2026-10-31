import { getSetting, setSetting } from '../../data/repos/settings';
import { normalizeFavourites, recordFavourite, setPinned, type LookFavourite } from '../../theme/favourites';
import { DEFAULT_LOOK, normalizeLook, type LookMix } from '../../theme/look';
import { useLookStore } from '../../theme/ThemeProvider';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';

const LOOK_KEY = 'look';
const BLUR_CHOSEN_KEY = 'gblurChosen';

type SaveOpts = {
  /** The user explicitly confirmed a blur level (Profile > Color & glass): counts as a choice even when the level is unchanged. */
  chooseBlur?: boolean;
};

/** Applies and saves a change to the look mix; unknown keys and values are dropped (normalizeLook). */
export function saveLook(patch: Partial<LookMix>, opts: SaveOpts = {}): void {
  const { look, blurChosen } = useLookStore.getState();
  const next = normalizeLook({ ...look, ...patch });
  // "Chosen" = an explicit blur confirm, or the blur level actually changed by this save (a favourite that keeps the same level does not count).
  const chosen = blurChosen || !!opts.chooseBlur || next.gblur !== look.gblur;
  setSetting(getDb(), LOOK_KEY, next, now());
  if (chosen && !blurChosen) setSetting(getDb(), BLUR_CHOSEN_KEY, true, now());
  useLookStore.setState({ look: next, blurChosen: chosen });
  bump('settings');
}

/** Startup: puts the saved look in the store (absent or corrupt -> default, field by field). */
export function loadLook(): void {
  const look = normalizeLook(getSetting(getDb(), LOOK_KEY));
  // A saved level other than the default can only have come from the user, even if the flag is missing.
  const blurChosen = getSetting(getDb(), BLUR_CHOSEN_KEY) === true || look.gblur !== DEFAULT_LOOK.gblur;
  useLookStore.setState({ look, blurChosen });
}

const FAVOURITES_KEY = 'lookFavourites';

function readFavourites() {
  return normalizeFavourites(getSetting(getDb(), FAVOURITES_KEY));
}

function writeFavourites(list: LookFavourite[]): void {
  setSetting(getDb(), FAVOURITES_KEY, list, now());
  bump('settings');
}

/** Saves the change (saveLook) and remembers the resulting look as a favourite (moved to the top if already there).
 *  `chooseBlur`: the user confirmed a blur level, which turns off the low-end default even if the level is unchanged. */
export function confirmLook(patch: Partial<LookMix>, opts: SaveOpts = {}): void {
  saveLook(patch, opts);
  writeFavourites(recordFavourite(readFavourites(), useLookStore.getState().look, now(), newId));
}

/** Applies a favourite's whole look; it moves to the top. Unknown id: nothing happens. */
export function applyFavourite(id: string): void {
  const fav = readFavourites().find(f => f.id === id);
  if (!fav) return;
  saveLook(fav.mix);
  writeFavourites(recordFavourite(readFavourites(), useLookStore.getState().look, now(), newId));
}

export function setFavouritePinned(id: string, pinned: boolean): void {
  writeFavourites(setPinned(readFavourites(), id, pinned));
}
