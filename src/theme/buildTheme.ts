import { colorMix, luminance, withAlpha } from './colorMix';
import { FONT_SETS, type FontSet } from './fonts';
import type { LookMix } from './look';
import { glassBlurs, glassTints, motions, palettes, shapes } from './tokens';

export type Palette = Omit<(typeof palettes)[keyof typeof palettes], 'name'>;
export type ColorName = keyof Palette;
export type TopicColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5';
export const TOPIC_COLOR_KEYS: TopicColorKey[] = ['study', 'health', 'home', 'sun', 'c4', 'c5'];

export type Theme = ReturnType<typeof buildTheme>;

/** Glass tints reference palette colors as "var(--p-tint1)"; this resolves them to hex. */
function resolve(value: string, p: Palette): string {
  const m = value.match(/^var\(--p-(\w+)\)$/);
  return m ? p[m[1] as ColorName] : value;
}

const pct = (s: string) => parseFloat(s);

// expo-blur intensity (1–100) that roughly matches the prototype's CSS blur radius.
const blurIntensity = (px: string) => Math.min(100, Math.round(pct(px) * 2.5));

export function buildTheme(look: LookMix) {
  const { name: _name, ...c } = palettes[look.pal];
  const shape = shapes[look.shape];
  const motion = motions[look.motion];
  const g = glassTints[look.glass];

  // Glass: three colored blobs behind the cards, and a frost that keeps the surface's light/dark contrast.
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
    glass: isGlass ? { blobs, frost, intensity: blurIntensity(glassBlurs[look.gblur].px) } : null,
    chain,
    selected: withAlpha(c.accent, 0.16),
    glow: { fill: withAlpha(c.sun, 0.38), ring: withAlpha(c.sun, 0.55) },
  };
}

/** "cubic-bezier(.34,1.56,.64,1)" → [0.34, 1.56, 0.64, 1] for Reanimated's Easing.bezier. */
export function parseBezier(ease: string): [number, number, number, number] {
  const n = ease.match(/-?[\d.]+/g)?.map(Number);
  if (!n || n.length !== 4) throw new Error(`Bad easing: ${ease}`);
  return n as [number, number, number, number];
}
