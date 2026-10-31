import { colorMix, luminance, parseColor, withAlpha } from './colorMix';
import { compositeOver, contrastRatio } from './contrast';
import type { ColorName } from './buildTheme';
import { glassTints } from './tokens';

/** A palette with plain string colours (the token literals widened, since derived colours are computed). */
export type Colors = { [K in ColorName]: string };
type Tint = (typeof glassTints)[keyof typeof glassTints];

const AA = 4.5;
const SECONDARY = 3;

/**
 * The colour closest to `fg` that holds `min`:1 on every colour in `bgs`: `fg` itself if it already does, otherwise `fg`
 * mixed toward black (`toward: 'dark'`) or white in 1% steps, stopping at the first step that passes (the smallest change).
 * If even the pure extreme fails, the extreme is returned.
 */
export function ensureContrast(
  fg: string, bgs: readonly string[] | ((c: string) => readonly string[]), min: number, toward: 'dark' | 'light',
): string {
  // `bgs` may depend on the colour itself (the selected tint is the accent over the card).
  const ok = (c: string) => (typeof bgs === 'function' ? bgs(c) : bgs).every(b => contrastRatio(c, b) >= min);
  if (ok(fg)) return fg;
  const end = toward === 'dark' ? '#000000' : '#ffffff';
  for (let share = 1; share <= 100; share++) {
    const c = colorMix(end, share, fg);
    if (ok(c)) return c;
  }
  return end;
}

/** Glass tints reference palette colors as "var(--p-tint1)"; this resolves them to hex. */
export function resolve(value: string, p: Colors): string {
  const m = value.match(/^var\(--p-(\w+)\)$/);
  return m ? p[m[1] as ColorName] : value;
}

/** The tint's main colour: the most saturated (largest channel spread) of its tone and blobs. */
export function tintMain(tint: Tint, p: Colors): string {
  const chroma = (c: string) => { const { r, g, b } = parseColor(c); return Math.max(r, g, b) - Math.min(r, g, b); };
  return [tint.tone, ...tint.b].map(c => resolve(c, p)).reduce((best, c) => (chroma(c) > chroma(best) ? c : best));
}

/** How far the page and the cards lean toward the tint, in colorMix %. Night mixes into a dark base so the page stays dark. */
const BG_SHARE = { light: 16, dark: 20 };
const SURFACE_SHARE = { light: 7, dark: 12 };
const LINE_SHARE = 14;

/**
 * The selected tint (float tab, selected calendar day) is the accent at this alpha % over the card or page. It starts at
 * SELECTED_MAX and steps down 1% at a time until the text drawn on it reads at 4.5:1; it never goes below SELECTED_MIN so
 * the selection stays visible (derived tints nudge the accent so that the minimum always passes).
 */
export const SELECTED_MAX = 16;
export const SELECTED_MIN = 6;
/** Text drawn on the selected tint, and what it sits over: the float tab (accent) is on the bar (surface); the selected
 * calendar day (accent for today, ink otherwise) is on the page (bg). Muted and danger keep the chunk-3 rule (over surface). */
const SELECTED_TEXT = [
  { k: 'accent', over: ['surface', 'bg'] },
  { k: 'ink', over: ['surface', 'bg'] },
  { k: 'muted', over: ['surface'] },
  { k: 'danger', over: ['surface'] },
] as const;

/** The accent at `share` % over each of `unders` (opaque). */
const tintedBy = (accent: string, share: number, unders: readonly string[]) =>
  unders.map(u => compositeOver(withAlpha(accent, share / 100), u));

/** The strongest selected-tint alpha % (SELECTED_MAX down to SELECTED_MIN) at which the text on it holds 4.5:1 (SELECTED_TEXT). */
export function selectedShare(c: Colors): number {
  for (let s = SELECTED_MAX; s > SELECTED_MIN; s--) {
    if (SELECTED_TEXT.every(({ k, over }) => tintedBy(c.accent, s, over.map(u => c[u])).every(b => contrastRatio(c[k], b) >= AA))) return s;
  }
  return SELECTED_MIN;
}

/**
 * The palette recoloured from a glass tint (the colour picked in Color & glass). Not for "match the palette", which keeps the
 * palette as it is. Every text colour is nudged only as far as needed to hold WCAG AA on the new page, cards, selected
 * chips and (for the frost) the glass blobs, so `contrast.test.ts` holds for every palette × tint.
 */
export function derivePalette(base: Colors, tint: Tint): Colors {
  const dark = luminance(base.bg) < 0.2;
  const toward = dark ? 'light' : 'dark';
  const k = dark ? 'dark' : 'light';
  const main = tintMain(tint, base);

  const bg = colorMix(main, BG_SHARE[k], base.bg);
  const surface = colorMix(main, SURFACE_SHARE[k], base.surface);
  const line = colorMix(main, LINE_SHARE, base.line);
  const flat = [bg, surface];

  // Accent text must also read on the faintest selected tint (SELECTED_MIN) over the card and the page.
  const accent = ensureContrast(main, a => [...flat, ...tintedBy(a, SELECTED_MIN, flat)], AA, toward);
  // The button label: the palette's own if it reads on the new accent, else white or near-black, whichever reads better.
  const on = [base.on, '#ffffff', '#111111'].find(c => contrastRatio(c, accent) >= AA)
    ?? (contrastRatio('#ffffff', accent) >= contrastRatio('#111111', accent) ? '#ffffff' : '#111111');

  const selected = compositeOver(withAlpha(accent, 0.16), surface);
  const now = { ...base, bg, surface, line, accent, on };
  const blobs = tint.b.map(b => colorMix(resolve(b, now), parseFloat(tint.bs), bg));
  const frost = withAlpha(colorMix(resolve(tint.tone, now), parseFloat(tint.tm), surface), parseFloat(tint.a) / 100);
  const frostPage = compositeOver(frost, bg);
  const frostBlobs = blobs.map(b => compositeOver(frost, b));
  const body = [...flat, selected, frostPage];

  const ink = ensureContrast(ensureContrast(base.ink, body, AA, toward), frostBlobs, AA, toward);
  const muted = ensureContrast(ensureContrast(base.muted, body, AA, toward), frostBlobs, SECONDARY, toward);
  const danger = ensureContrast(ensureContrast(base.danger, body, AA, toward), frostBlobs, SECONDARY, toward);

  return { ...base, bg, surface, line, accent, on, ink, muted, danger };
}

const shareCache = new Map<string, number>();
/** `selectedShare`, remembered per palette × tint (same key as `derivedPalette`; "match" included). */
export function selectedShareFor(palKey: string, tintKey: string, c: Colors): number {
  const key = `${palKey}|${tintKey}`;
  let s = shareCache.get(key);
  if (s === undefined) shareCache.set(key, (s = selectedShare(c)));
  return s;
}

const cache = new Map<string, Colors>();
/** `derivePalette`, remembered per palette × tint (the inputs are constants). */
export function derivedPalette(palKey: string, tintKey: string, base: Colors, tint: Tint): Colors {
  const key = `${palKey}|${tintKey}`;
  let p = cache.get(key);
  if (!p) cache.set(key, (p = derivePalette(base, tint)));
  return p;
}
