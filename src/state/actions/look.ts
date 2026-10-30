import { getSetting, setSetting } from '../../data/repos/settings';
import { normalizeFavourites, recordFavourite, setPinned, type LookFavourite } from '../../theme/favourites';
import { normalizeLook, type LookMix } from '../../theme/look';
import { useLookStore } from '../../theme/ThemeProvider';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { newId } from '../ids';
import { bump } from '../store';

const LOOK_KEY = 'look';

/** Applies and saves a change to the look mix; unknown keys and values are dropped (normalizeLook). */
export function saveLook(patch: Partial<LookMix>): void {
  const next = normalizeLook({ ...useLookStore.getState().look, ...patch });
  setSetting(getDb(), LOOK_KEY, next, now());
  useLookStore.setState({ look: next });
  bump('settings');
}

/** Startup: puts the saved look in the store (absent or corrupt -> default, field by field). */
export function loadLook(): void {
  useLookStore.setState({ look: normalizeLook(getSetting(getDb(), LOOK_KEY)) });
}

const FAVOURITES_KEY = 'lookFavourites';

function readFavourites() {
  return normalizeFavourites(getSetting(getDb(), FAVOURITES_KEY));
}

function writeFavourites(list: LookFavourite[]): void {
  setSetting(getDb(), FAVOURITES_KEY, list, now());
  bump('settings');
}

/** Saves the change (saveLook) and remembers the resulting look as a favourite (moved to the top if already there). */
export function confirmLook(patch: Partial<LookMix>): void {
  saveLook(patch);
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
