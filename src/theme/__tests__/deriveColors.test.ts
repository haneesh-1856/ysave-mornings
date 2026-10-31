import { buildTheme } from '../buildTheme';
import { colorMix, withAlpha } from '../colorMix';
import { contrastRatio } from '../contrast';
import { derivePalette, ensureContrast, selectedShare, SELECTED_MAX, SELECTED_MIN, tintMain } from '../deriveColors';
import { DEFAULT_LOOK } from '../look';
import { glassTints, palettes } from '../tokens';

describe('ensureContrast', () => {
  it('returns the colour itself when it already passes', () => {
    expect(ensureContrast('#233036', ['#ffffff'], 4.5, 'dark')).toBe('#233036');
  });
  it('darkens by the smallest step that passes on every background', () => {
    const out = ensureContrast('#7bd8c0', ['#ffffff', '#f4f6f6'], 4.5, 'dark');
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out, '#f4f6f6')).toBeGreaterThanOrEqual(4.5);
    // one step lighter would have failed
    const prev = colorMix('#000000', 1, '#7bd8c0');
    expect(out).not.toBe('#7bd8c0');
    expect(prev === out || contrastRatio(prev, '#f4f6f6') < 4.5 || contrastRatio(prev, '#ffffff') < 4.5).toBe(true);
  });
  it('lightens toward white for dark pages', () => {
    const out = ensureContrast('#3a4a66', ['#12151c'], 4.5, 'light');
    expect(contrastRatio(out, '#12151c')).toBeGreaterThanOrEqual(4.5);
  });
  it('falls back to the pure extreme when nothing in between passes', () => {
    expect(ensureContrast('#777777', ['#777777'], 21, 'dark')).toBe('#000000');
  });
});

describe('tintMain', () => {
  it('picks the most saturated colour of the tint', () => {
    expect(tintMain(glassTints.aurora, palettes.mist)).toBe('#7a5cf0');
  });
  it('resolves palette references (the accent tint is the palette accent)', () => {
    expect(tintMain(glassTints.accent, palettes.mist)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('derivePalette', () => {
  it('keeps every colour the tint does not own (topic colours, sun, frame, dangerFill)', () => {
    const d = derivePalette(palettes.mist, glassTints.sea);
    for (const k of ['study', 'health', 'home', 'c4', 'c5', 'sun', 'tint1', 'tint2', 'tint3', 'frame', 'dangerFill'] as const) expect(d[k]).toBe(palettes.mist[k]);
  });
  it('moves bg, surface, line and accent toward the tint', () => {
    const d = derivePalette(palettes.mist, glassTints.sea);
    for (const k of ['bg', 'surface', 'line', 'accent'] as const) expect(d[k]).not.toBe(palettes.mist[k]);
  });
});

describe('buildTheme with a tint', () => {
  const pals = Object.keys(palettes) as (keyof typeof palettes)[];
  const tints = (Object.keys(glassTints) as (keyof typeof glassTints)[]).filter(k => k !== 'match');
  it('"match the palette" is exactly the palette, for every palette', () => {
    for (const pal of pals) {
      const { name: _n, ...expected } = palettes[pal];
      expect(buildTheme({ ...DEFAULT_LOOK, pal, glass: 'match' }).c).toEqual(expected);
    }
  });
  it('any other tint changes accent, page and cards on every palette', () => {
    for (const pal of pals) for (const glass of tints) {
      const t = buildTheme({ ...DEFAULT_LOOK, pal, glass }).c;
      const m = buildTheme({ ...DEFAULT_LOOK, pal, glass: 'match' }).c;
      // clear/milk/smoke are near-neutral, so only demand a change on the colours that move for sure
      expect([t.bg, t.surface, t.accent].some((v, i) => v !== [m.bg, m.surface, m.accent][i])).toBe(true);
    }
    const a = buildTheme({ ...DEFAULT_LOOK, pal: 'mist', glass: 'aurora' }).c;
    const m = palettes.mist;
    expect([a.accent, a.bg, a.surface]).not.toContain(m.accent);
    expect(a.bg).not.toBe(m.bg);
    expect(a.surface).not.toBe(m.surface);
  });
  it('keeps Night dark with every tint, and light palettes light', () => {
    for (const glass of tints) {
      expect(buildTheme({ ...DEFAULT_LOOK, pal: 'night', glass }).isDark).toBe(true);
      expect(buildTheme({ ...DEFAULT_LOOK, pal: 'mist', glass }).isDark).toBe(false);
    }
  });
  it('is fast enough to run on every look change', () => {
    const start = performance.now();
    for (const pal of pals) for (const glass of tints) buildTheme({ ...DEFAULT_LOOK, pal, glass, surf: 'flat' });
    expect((performance.now() - start) / (pals.length * tints.length)).toBeLessThan(25);
  });
});

describe('selectedShare', () => {
  it('keeps 16% where the text already reads, and never goes below the visible minimum', () => {
    expect(selectedShare(palettes.night)).toBe(SELECTED_MAX);
    for (const pal of Object.keys(palettes) as (keyof typeof palettes)[]) for (const tint of Object.values(glassTints)) {
      const s = selectedShare(tint === glassTints.match ? palettes[pal] : derivePalette(palettes[pal], tint));
      expect(s).toBeGreaterThanOrEqual(SELECTED_MIN);
      expect(s).toBeLessThanOrEqual(SELECTED_MAX);
    }
  });
  it('the theme uses it: t.selected is the accent at that alpha', () => {
    const t = buildTheme({ ...DEFAULT_LOOK, pal: 'mist', glass: 'aurora' });
    expect(t.selected).toBe(withAlpha(t.c.accent, selectedShare(t.c) / 100));
  });
});
