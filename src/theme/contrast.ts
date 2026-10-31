import { parseColor, luminance } from './colorMix';

/** Alpha-composites `fg` (hex, rgb() or rgba()) over an opaque `bg`, returning an opaque hex-like rgb triple. */
function over(fg: string, bg: string): { r: number; g: number; b: number } {
  const f = parseColor(fg), b = parseColor(bg);
  const mix = (x: number, y: number) => x * f.a + y * (1 - f.a);
  return { r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) };
}

const hex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')}`;

/** WCAG 2.x contrast ratio (1–21). A translucent `fg` or `bg` is composited over `under` (default white) first. */
export function contrastRatio(fg: string, bg: string, under = '#ffffff'): number {
  const solidBg = hex(over(bg, under));
  const solidFg = hex(over(fg, solidBg));
  const [hi, lo] = [luminance(solidFg), luminance(solidBg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The opaque colour a translucent `color` produces over `under`. */
export const compositeOver = (color: string, under: string): string => hex(over(color, under));
