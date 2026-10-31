import { buildTheme, parseBezier } from '../buildTheme';
import { colorMix, contrastRatio, parseColor, withAlpha } from '../colorMix';
import { DEFAULT_LOOK, normalizeLook } from '../look';
import { glassTints, palettes, presets } from '../tokens';

describe('colorMix', () => {
  it('matches CSS color-mix in sRGB', () => {
    expect(colorMix('#ffffff', 50, '#000000')).toBe('#808080');
    expect(colorMix('#ff0000', 100, '#0000ff')).toBe('#ff0000');
    expect(colorMix('#ff0000', 0, '#0000ff')).toBe('#0000ff');
    expect(colorMix('#8db8e6', 30, '#f4f6f6')).toBe('#d5e3f1'); // Mist study fold
  });
  it('mixes with transparent like CSS (premultiplied)', () => {
    expect(withAlpha('#1c2029', 0.55)).toBe('rgba(28, 32, 41, 0.55)');
    expect(colorMix('transparent', 50, 'transparent')).toBe('transparent');
  });
  it('rejects colors it cannot read instead of guessing', () => {
    expect(() => parseColor('var(--p-tint1)')).toThrow();
  });
});

describe('normalizeLook', () => {
  it('fills missing and invalid fields from the default, field by field', () => {
    expect(normalizeLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(normalizeLook({ pal: 'sunrise', nav: 'nope', extra: 1 })).toEqual({ ...DEFAULT_LOOK, pal: 'sunrise' });
  });
  it('does not accept prototype keys like "toString"', () => {
    expect(normalizeLook({ pal: 'toString' }).pal).toBe(DEFAULT_LOOK.pal);
  });
});

describe('buildTheme', () => {
  const pals = Object.keys(palettes) as (keyof typeof palettes)[];
  const glasses = Object.keys(glassTints) as (keyof typeof glassTints)[];

  it('builds every palette × glass tint without throwing', () => {
    for (const pal of pals) for (const glass of glasses) expect(() => buildTheme({ ...DEFAULT_LOOK, pal, glass })).not.toThrow();
  });
  it('builds every preset', () => {
    for (const p of presets) expect(buildTheme(normalizeLook(p.mix)).look.pal).toBe(p.mix.pal);
  });
  it('only has glass settings when the surface is glass', () => {
    expect(buildTheme(DEFAULT_LOOK).glass).not.toBeNull();
    expect(buildTheme({ ...DEFAULT_LOOK, surf: 'flat' }).glass).toBeNull();
  });
  it('draws the tint blobs and chain on every surface, and a different tint changes them', () => {
    const glassT = buildTheme({ ...DEFAULT_LOOK, surf: 'glass', glass: 'aurora' });
    const flatT = buildTheme({ ...DEFAULT_LOOK, surf: 'flat', glass: 'aurora' });
    expect(glassT.backdrop.blobs).toEqual(glassT.glass?.blobs);
    expect(flatT.backdrop.blobs).toHaveLength(3);
    expect(flatT.backdrop.blobs).not.toEqual(glassT.backdrop.blobs); // calmer without frosted cards
    for (const surf of ['raised', 'outline'] as const) {
      const t = buildTheme({ ...DEFAULT_LOOK, surf, glass: 'aurora' });
      expect(t.backdrop.blobs).toEqual(flatT.backdrop.blobs); // non-glass surfaces share the calm blobs
      expect(t.chain).toEqual(glassT.chain);
    }
    expect(flatT.chain).toEqual(glassT.chain);
    expect(buildTheme({ ...DEFAULT_LOOK, surf: 'flat', glass: 'aurora' }).backdrop.blobs).not.toEqual(buildTheme({ ...DEFAULT_LOOK, surf: 'flat' }).backdrop.blobs);
  });
  it('keeps the frost but skips the blur on a low-end device or under Reduce Transparency', () => {
    expect(buildTheme(DEFAULT_LOOK).glass?.blur).toBe(true);
    const low = buildTheme(DEFAULT_LOOK, { lowEndDevice: true }).glass;
    expect(low?.blur).toBe(false);
    expect(low?.frost).toBe(buildTheme(DEFAULT_LOOK).glass?.frost);
    expect(buildTheme(DEFAULT_LOOK, { lowEndDevice: false }).glass?.blur).toBe(true);
  });
  it('knows Night owl is dark and Mist is light', () => {
    expect(buildTheme(DEFAULT_LOOK).isDark).toBe(true);
    expect(buildTheme({ ...DEFAULT_LOOK, pal: 'mist' }).isDark).toBe(false);
  });
  it('keeps body text readable (WCAG AA 4.5:1) on every palette surface', () => {
    for (const pal of pals) expect(contrastRatio(palettes[pal].ink, palettes[pal].surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('parses easing curves', () => {
    expect(parseBezier('cubic-bezier(.34,1.56,.64,1)')).toEqual([0.34, 1.56, 0.64, 1]);
  });
});
