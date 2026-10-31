import { colorMix, luminance, withAlpha } from './colorMix';
import { contrastRatio } from './contrast';
import { derivedPalette, resolve, selectedShareFor, type Colors } from './deriveColors';
import { FONT_SETS, type FontSet } from './fonts';
import type { LookMix } from './look';
import { glassBlurs, glassTints, motions, palettes, shapes } from './tokens';

type PaletteTokens = Omit<(typeof palettes)[keyof typeof palettes], 'name'>;
export type ColorName = keyof PaletteTokens;
/** Palette colours as plain strings: a tint other than "match" derives them. */
export type Palette = Colors;
export type TopicColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5';
export const TOPIC_COLOR_KEYS: TopicColorKey[] = ['study', 'health', 'home', 'sun', 'c4', 'c5'];

export type Theme = ReturnType<typeof buildTheme>;

/**
 * Without frosted cards the blobs sit directly behind page text, so they are drawn calmer. Each glass blob (already the
 * tint at the tint's own `bs` over the page) is mixed again over a calm base at most this %, so the tint's effective share
 * is at most bs × 0.45.
 */
export const PAGE_BLOB_STRENGTH = 45;

/** Text that sits straight on the page; on non-glass surfaces each must hold WCAG AA 4.5:1 over every blob. */
const PAGE_TEXT = ['ink', 'muted', 'accent', 'danger'] as const;
const PAGE_TEXT_AA = 4.5;

/**
 * A non-glass page blob: the blob mixed over the calm base at the highest strength (≤ PAGE_BLOB_STRENGTH) that keeps
 * every page-text color at 4.5:1. The calm base is whichever of bg and surface sits farther from the ink (the paler one
 * on light palettes, the darker on dark), so the blob keeps its hue while staying at least as light (or dark) as the page.
 */
function calmPageBlob(blob: string, c: Palette): string {
  const base = Math.abs(luminance(c.surface) - luminance(c.ink)) > Math.abs(luminance(c.bg) - luminance(c.ink)) ? c.surface : c.bg;
  for (let s = PAGE_BLOB_STRENGTH; s > 0; s--) {
    const page = colorMix(blob, s, base);
    if (PAGE_TEXT.every(k => contrastRatio(c[k], page) >= PAGE_TEXT_AA)) return page;
  }
  return base;
}

const pct = (s: string) => parseFloat(s);

// expo-blur intensity (1–100) that roughly matches the prototype's CSS blur radius.
const blurIntensity = (px: string) => Math.min(100, Math.round(pct(px) * 2.5));

/** `lowEndDevice`: default the BlurView off (frost colour stays); the caller passes it only while the user has not chosen a blur level. */
export function buildTheme(look: LookMix, opts: { reduceTransparency?: boolean; lowEndDevice?: boolean } = {}) {
  const { name: _name, ...base } = palettes[look.pal];
  const shape = shapes[look.shape];
  const motion = motions[look.motion];
  const g = glassTints[look.glass];
  // Any tint but "match the palette" colours the whole app: accent, page, cards and lines come from the tint.
  const c: Palette = look.glass === 'match' ? base : derivedPalette(look.pal, look.glass, base, g);

  // Color: three blobs behind the page on every surface (the tint is the app's color); glass adds a frost that keeps the surface's light/dark contrast.
  const blobs = g.b.map(b => colorMix(resolve(b, c), pct(g.bs), c.bg));
  const frostBase = colorMix(resolve(g.tone, c), pct(g.tm), c.surface);
  const frost = withAlpha(frostBase, pct(g.a) / 100);
  // Palette-tint glasses have pale blobs, so the chain stays on the accent; the rest borrow the blob colors nudged toward ink.
  const chain = g.b[0].startsWith('var(') ? [c.accent, c.accent, c.accent] : g.b.map(b => colorMix(b, 78, c.ink));

  const isGlass = look.surf === 'glass';
  const card = {
    flat: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
    raised: { backgroundColor: c.surface, shadowColor: '#141e32', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    outline: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.ink },
    glass: { backgroundColor: frost, borderWidth: 1, borderColor: withAlpha(c.surface, 0.7) },
  }[look.surf];

  return {
    look,
    c,
    isDark: luminance(c.bg) < 0.2,
    /** Topic color and its fold background (topic 30% over the page). */
    topic: (key: TopicColorKey) => ({ color: c[key], fold: colorMix(c[key], 30, c.bg) }),
    radius: { r: pct(shape.r), rb: pct(shape.rb) },
    font: FONT_SETS[look.font] as FontSet,
    motion: { duration: motion.dur, bezier: parseBezier(motion.ease) },
    card,
    /** Outline surfaces get a hard 3/3 ink shadow drawn as a second layer. */
    hardShadow: look.surf === 'outline' ? c.ink : null,
    /** The tint's colored blobs behind the page, on every surface (calmer when the cards are not frosted). */
    backdrop: { blobs: isGlass ? blobs : blobs.map(b => calmPageBlob(b, c)) },
    /** Frosted-card settings; only when the surface is glass. */
    glass: isGlass ? { blobs, frost, intensity: blurIntensity(glassBlurs[look.gblur].px), blur: !opts.reduceTransparency && !opts.lowEndDevice } : null,
    /** The low-end default is in effect: blur is off because this phone is low-end and the user has not picked a level. */
    lowEndDefault: !!opts.lowEndDevice,
    chain,
    /** Selected tint: the accent at the strongest alpha (16% down to 6%) where accent, ink, muted and danger read at 4.5:1 on it. */
    selected: withAlpha(c.accent, selectedShareFor(look.pal, look.glass, c) / 100),
    glow: { fill: withAlpha(c.sun, 0.38), ring: withAlpha(c.sun, 0.55) },
  };
}

/** "cubic-bezier(.34,1.56,.64,1)" → [0.34, 1.56, 0.64, 1] for Reanimated's Easing.bezier. */
export function parseBezier(ease: string): [number, number, number, number] {
  const n = ease.match(/-?[\d.]+/g)?.map(Number);
  if (!n || n.length !== 4) throw new Error(`Bad easing: ${ease}`);
  return n as [number, number, number, number];
}
