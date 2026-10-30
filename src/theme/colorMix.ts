// React Native has no CSS color-mix(), so the theme pre-computes every mixed color with these helpers.
// All math is in sRGB, matching `color-mix(in srgb, ...)` in the prototype.

type RGBA = { r: number; g: number; b: number; a: number };

export function parseColor(color: string): RGBA {
  if (color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map(s => s.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`Unsupported color: ${color}`);
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
}

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

export function formatColor({ r, g, b, a }: RGBA): string {
  if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`;
}

/** `color-mix(in srgb, a pct%, b)`: pct is 0–100, the share of `a`. Alpha is premultiplied like CSS. */
export function colorMix(a: string, pct: number, b: string): string {
  const p = Math.min(100, Math.max(0, pct)) / 100;
  const ca = parseColor(a), cb = parseColor(b);
  const alpha = ca.a * p + cb.a * (1 - p);
  if (alpha === 0) return 'transparent';
  const ch = (x: number, y: number) => (x * ca.a * p + y * cb.a * (1 - p)) / alpha;
  return formatColor({ r: ch(ca.r, cb.r), g: ch(ca.g, cb.g), b: ch(ca.b, cb.b), a: alpha });
}

export const withAlpha = (color: string, alpha: number) => colorMix(color, alpha * 100, 'transparent');

/** Relative luminance (WCAG), 0 = black, 1 = white. */
export function luminance(color: string): number {
  const { r, g, b } = parseColor(color);
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
