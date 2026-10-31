import { sql } from 'drizzle-orm';

import { getSetting, setSetting } from '../../data/repos/settings';
import { DEFAULT_LOOK } from '../../theme/look';
import { useLookStore } from '../../theme/ThemeProvider';
import { normalizeFavourites } from '../../theme/favourites';
import { applyFavourite, confirmLook, loadLook, saveLook, setFavouritePinned } from '../actions/look';
import { getDb } from '../dbRef';
import { setupState, teardownState } from '../testSupport';

let mockN = 0;
jest.mock('../ids', () => ({ newId: () => `id-${++mockN}` }));

beforeEach(() => {
  setupState(1_000);
  useLookStore.setState({ look: DEFAULT_LOOK });
});
afterEach(() => {
  teardownState();
  useLookStore.setState({ look: DEFAULT_LOOK });
});

describe('saveLook', () => {
  it('merges the patch, saves the whole mix and updates the store', () => {
    saveLook({ pal: 'sunrise', art: 'garden' });
    const want = { ...DEFAULT_LOOK, pal: 'sunrise', art: 'garden' };
    expect(useLookStore.getState().look).toEqual(want);
    expect(getSetting(getDb(), 'look')).toEqual(want);
    saveLook({ nav: 'bar' }); // keeps earlier changes
    expect(getSetting(getDb(), 'look')).toEqual({ ...want, nav: 'bar' });
  });

  it('drops unknown keys and values', () => {
    saveLook({ pal: 'nope', extra: 1 } as never);
    expect(getSetting(getDb(), 'look')).toEqual(DEFAULT_LOOK);
  });
});

describe('loadLook', () => {
  it('uses the default when nothing is saved', () => {
    useLookStore.setState({ look: { ...DEFAULT_LOOK, pal: 'sunrise' } });
    loadLook();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('uses the default for corrupt JSON and non-objects', () => {
    getDb().run(sql`INSERT INTO settings (key, value, createdAt, updatedAt) VALUES ('look', '{oops', 1, 1)`);
    loadLook();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
    setSetting(getDb(), 'look', 'night', 2);
    loadLook();
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('fills a partial mix field by field', () => {
    setSetting(getDb(), 'look', { pal: 'sunrise', nav: 'bogus' }, 2);
    loadLook();
    expect(useLookStore.getState().look).toEqual({ ...DEFAULT_LOOK, pal: 'sunrise' });
  });

  it('loads a full saved mix', () => {
    const full = { ...DEFAULT_LOOK, pal: 'sunrise', font: 'serif', shape: 'sharp', art: 'plant' };
    setSetting(getDb(), 'look', full, 2);
    loadLook();
    expect(useLookStore.getState().look).toEqual(expect.objectContaining({ pal: 'sunrise', art: 'plant' }));
  });
});

describe('favourites', () => {
  const saved = () => getSetting(getDb(), 'lookFavourites') as { id: string; name: string; mix: unknown }[];

  it('confirmLook saves the look and records it at the top of the seeds', () => {
    confirmLook({ art: 'garden' });
    expect(getSetting(getDb(), 'look')).toEqual({ ...DEFAULT_LOOK, art: 'garden' });
    expect(saved()).toHaveLength(5);
    expect(saved()[0]).toMatchObject({ name: 'Night owl · Garden', mix: { ...DEFAULT_LOOK, art: 'garden' } });
  });

  it('confirming a look that is already a favourite moves it to the top', () => {
    confirmLook({ pal: 'mist' });
    confirmLook({ pal: 'night' }); // back to the seed mix
    expect(saved()[0].id).toBe('seed-1');
    expect(saved()).toHaveLength(5);
  });

  it('applyFavourite sets the whole look and moves the favourite to the top', () => {
    applyFavourite('seed-3');
    expect(useLookStore.getState().look).toEqual(normalizeFavourites(undefined)[2].mix);
    expect(saved()[0].id).toBe('seed-3');
    applyFavourite('nope'); // ignored
    expect(saved()[0].id).toBe('seed-3');
  });

  it('setFavouritePinned persists', () => {
    setFavouritePinned('seed-2', true);
    expect(saved().find(f => f.id === 'seed-2')).toMatchObject({ pinned: true });
    setFavouritePinned('seed-2', false);
    expect(saved().find(f => f.id === 'seed-2')).toMatchObject({ pinned: false });
  });
});

describe('blurChosen (low-end default rule)', () => {
  beforeEach(() => useLookStore.setState({ look: DEFAULT_LOOK, blurChosen: false }));
  afterAll(() => useLookStore.setState({ blurChosen: false }));

  it('stays false for other changes, becomes true when the blur level changes, and is saved', () => {
    saveLook({ pal: 'sunrise' });
    expect(useLookStore.getState().blurChosen).toBe(false);
    expect(getSetting(getDb(), 'gblurChosen')).toBeUndefined();
    confirmLook({ gblur: 'heavy' });
    expect(useLookStore.getState().blurChosen).toBe(true);
    expect(getSetting(getDb(), 'gblurChosen')).toBe(true);
    saveLook({ pal: 'night' });
    expect(useLookStore.getState().blurChosen).toBe(true);
  });

  it('an explicit blur confirm counts as a choice even at the same level; a favourite at the same level still does not', () => {
    confirmLook({});
    expect(useLookStore.getState().blurChosen).toBe(false);
    confirmLook({}, { chooseBlur: true });
    expect(useLookStore.getState().blurChosen).toBe(true);
    expect(getSetting(getDb(), 'gblurChosen')).toBe(true);
    expect(useLookStore.getState().look).toEqual(DEFAULT_LOOK);
  });

  it('loadLook restores the flag, and infers it from a non-default saved level', () => {
    loadLook();
    expect(useLookStore.getState().blurChosen).toBe(false);
    setSetting(getDb(), 'gblurChosen', true, 2);
    loadLook();
    expect(useLookStore.getState().blurChosen).toBe(true);
    setSetting(getDb(), 'gblurChosen', false, 3);
    setSetting(getDb(), 'look', { ...DEFAULT_LOOK, gblur: 'heavy' }, 3);
    loadLook();
    expect(useLookStore.getState().blurChosen).toBe(true);
  });
});
