import { buildTheme } from '../buildTheme';
import { withAlpha } from '../colorMix';
import { compositeOver, contrastRatio } from '../contrast';
import { DEFAULT_LOOK } from '../look';
import { glassTints, palettes } from '../tokens';

const pals = Object.keys(palettes) as (keyof typeof palettes)[];
const glasses = Object.keys(glassTints) as (keyof typeof glassTints)[];

// Decisions:
// - T's `sub` (13 px) and `label` (11.5 px) variants use `muted` for real copy (descriptions, dates, hints), so muted
//   is body-size text: 4.5:1 on bg, solid surface, selected tint and every frost card over the page.
// - Glass blobs are blurred decoration that can sit behind any card. Ink must hold 4.5:1 over the palest blob; muted
//   (secondary) holds 3:1 there.
// - `accent` is also used as text (links, tab labels), so it must clear 4.5:1 on bg and surface as well as under `on`.
// - `danger` is error-message text (body copy): 4.5:1 on bg, surface, selected tint and frost over the page. A light red that
//   reads on Night's dark page can't also sit under a white label, so the Button fill is its own `dangerFill` token.
//   Over saturated glass blobs no red reaches 4.5 (only near-black ink does), so danger follows muted there: 3:1.
// - On flat/raised/outline there is no frost card: sub lines, links and error text sit straight on the blobs, so ink,
//   muted, accent and danger all hold 4.5:1 over every blob. The 3:1 allowance is only for text on a frost card.
const AA = 4.5, SECONDARY = 3;
const DANGER_LABEL = '#ffffff'; // Button kind="danger" label
// Known, reported gaps: palette tokens (glass "match") where accent text is under 4.5 on the selected tint at its 6% minimum.
// The palette accent is only ~4.5 on the bare bg, so no visible tint can pass there; fixing it means changing palette tokens.
const MATCH_SELECTED_GAPS: Partial<Record<keyof typeof palettes, ('surface' | 'bg')[]>> = {
  mist: ['bg'], sunrise: ['surface', 'bg'], lagoon: ['bg'], lavender: ['bg'],
};

describe('palette contrast (WCAG AA)', () => {
  it('covers all six palettes', () => expect(pals).toHaveLength(6));

  for (const pal of pals) {
    const c = palettes[pal];
    describe(pal, () => {
      it('ink, muted and danger on bg, solid surface and the selected tint', () => {
        const selected = compositeOver(withAlpha(c.accent, 0.16), c.surface);
        for (const bg of [c.bg, c.surface, selected]) {
          expect(contrastRatio(c.ink, bg)).toBeGreaterThanOrEqual(AA);
          expect(contrastRatio(c.muted, bg)).toBeGreaterThanOrEqual(AA);
          expect(contrastRatio(c.danger, bg)).toBeGreaterThanOrEqual(AA);
        }
      });
      it('danger button label on the danger fill', () => {
        expect(contrastRatio(DANGER_LABEL, c.dangerFill)).toBeGreaterThanOrEqual(AA);
      });
      it('accent text on bg and surface; button label on the accent fill', () => {
        expect(contrastRatio(c.accent, c.bg)).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(c.accent, c.surface)).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(c.on, c.accent)).toBeGreaterThanOrEqual(AA);
      });
      it('every tint on every non-glass surface: derived page text over the blobs, and solid derived cards', () => {
        const failures: string[] = [];
        for (const glass of glasses) {
          for (const surf of ['flat', 'raised', 'outline'] as const) {
            const t = buildTheme({ ...DEFAULT_LOOK, pal, glass, surf });
            const d = t.c;
            if (t.card.backgroundColor !== d.surface) failures.push(`${glass}/${surf} card is not the solid surface`);
            const selected = compositeOver(withAlpha(d.accent, 0.16), d.surface);
            const pages = [d.bg, d.surface, ...t.backdrop.blobs.map(b => compositeOver(b, d.bg))];
            for (const bg of [...pages, selected]) {
              for (const k of ['ink', 'muted', 'danger'] as const) {
                if (contrastRatio(d[k], bg) < AA) failures.push(`${glass}/${surf} ${k}/${bg}`);
              }
            }
            for (const bg of pages) if (contrastRatio(d.accent, bg) < AA) failures.push(`${glass}/${surf} accent/${bg}`);
            if (contrastRatio(d.on, d.accent) < AA) failures.push(`${glass}/${surf} on/accent`);
            if (contrastRatio(DANGER_LABEL, d.dangerFill) < AA) failures.push(`${glass}/${surf} label/dangerFill`);
          }
        }
        expect(failures).toEqual([]);
      });
      it('text on the selected tint (t.selected) for every tint and surface: accent and ink over surface and bg, muted and danger over surface', () => {
        const failures: string[] = [];
        for (const glass of glasses) {
          for (const surf of ['flat', 'raised', 'outline', 'glass'] as const) {
            const t = buildTheme({ ...DEFAULT_LOOK, pal, glass, surf });
            const d = t.c;
            const checks = [['accent', d.surface], ['accent', d.bg], ['ink', d.surface], ['ink', d.bg], ['muted', d.surface], ['danger', d.surface]] as const;
            for (const [k, under] of checks) {
              const r = contrastRatio(d[k], compositeOver(t.selected, under));
              if (r < AA) failures.push(`${glass}/${surf} ${k} on selected over ${under === d.bg ? 'bg' : 'surface'}`);
            }
          }
        }
        // The "match" palettes keep their tokens exactly; on these, accent text misses 4.5 even on the faintest tint (6%).
        const known = MATCH_SELECTED_GAPS[pal] ?? [];
        const expected = (['flat', 'raised', 'outline', 'glass'] as const).flatMap(surf => known.map(g => `match/${surf} accent on selected over ${g}`));
        expect(failures).toEqual(expected);
      });
      it('every glass tint on the glass surface: derived ink and muted on the frost over the page and over the blobs; danger like muted', () => {
        const failures: string[] = [];
        for (const glass of glasses) {
          const t = buildTheme({ ...DEFAULT_LOOK, pal, glass, surf: 'glass' });
          const d = t.c;
          const frostOverPage = compositeOver(t.card.backgroundColor, d.bg);
          for (const k of ['ink', 'muted', 'danger'] as const) {
            if (contrastRatio(d[k], frostOverPage) < AA) failures.push(`${glass} ${k}/page`);
          }
          for (const bg of [d.bg, d.surface]) if (contrastRatio(d.accent, bg) < AA) failures.push(`${glass} accent/${bg}`);
          if (contrastRatio(d.on, d.accent) < AA) failures.push(`${glass} on/accent`);
          for (const blob of t.backdrop.blobs) {
            const card = compositeOver(t.card.backgroundColor, compositeOver(blob, d.bg));
            if (contrastRatio(d.ink, card) < AA) failures.push(`${glass} ink/blob ${blob}`);
            if (contrastRatio(d.muted, card) < SECONDARY) failures.push(`${glass} muted/blob ${blob}`);
            if (contrastRatio(d.danger, card) < SECONDARY) failures.push(`${glass} danger/blob ${blob}`);
          }
        }
        expect(failures).toEqual([]);
      });
    });
  }

  it('contrastRatio matches WCAG reference values and composites alpha', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contrastRatio('rgba(0,0,0,0.5)', '#fff')).toBeCloseTo(contrastRatio('#808080', '#fff'), 1);
  });
});

describe('the neutral No topic colour (ADR-012)', () => {
  it('is the muted ink on the page colour; ink and muted text keep ink and muted text at 4.5:1 for every palette and tint', () => {
    const failures: string[] = [];
    for (const pal of pals) {
      for (const glass of glasses) {
        const t = buildTheme({ ...DEFAULT_LOOK, pal, glass });
        const none = t.topic('none');
        if (none.color !== t.c.muted) failures.push(`${pal}/${glass} colour is not muted`);
        for (const [name, fg] of [['ink', t.c.ink], ['muted', t.c.muted]] as const) {
          if (contrastRatio(fg, none.fold) < AA) failures.push(`${pal}/${glass} ${name} on the No topic fold`);
        }
        if (contrastRatio(none.color, t.c.surface) < 3) failures.push(`${pal}/${glass} dot on surface`);
      }
    }
    expect(failures).toEqual([]);
  });
});
