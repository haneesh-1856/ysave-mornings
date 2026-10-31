import { readdirSync, readFileSync } from 'fs';
import { join, sep } from 'path';

// A source-level audit (cheaper and broader than rendering nine screens with their data): every touchable and every
// SVG in src/ui, src/screens and src/app must carry what a screen reader needs. Tree-level behaviour (labels that
// actually reach the rendered elements) is covered by each screen's own getByRole(..., { name }) tests.
const ROOT = join(__dirname, '..', '..');
const DIRS = ['ui', 'screens', 'app'];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

/** Every opening tag `<name ...>` in the source (braces balanced so `=>` and `{a > b}` don't end it early). */
function openingTags(src: string, name: RegExp): { tag: string; line: number }[] {
  const out: { tag: string; line: number }[] = [];
  const re = new RegExp(`<(${name.source})(?=[ \t\r\n>/])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0, i = m.index + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push({ tag: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

const all = DIRS.flatMap(d => files(join(ROOT, d))).map(p => ({ f: p.slice(ROOT.length + 1).split(sep).join('/'), src: readFileSync(p, 'utf8') }));
const hidden = (tag: string) => /importantForAccessibility=("no"|"no-hide-descendants"|\{[^}]*no[^}]*\})|accessible=\{false\}/.test(tag);

describe('accessibility audit', () => {
  it('finds the touchables (guards the scan itself)', () => {
    const n = all.reduce((s, { src }) => s + openingTags(src, /Pressable/).length, 0);
    expect(n).toBeGreaterThan(30);
  });

  it('every Pressable has accessibilityRole and accessibilityLabel (or is hidden from the a11y tree)', () => {
    const bad = all.flatMap(({ f, src }) =>
      openingTags(src, /Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight/)
        .filter(({ tag }) => !hidden(tag) && !(/accessibilityRole=/.test(tag) && /accessibilityLabel=/.test(tag)))
        .map(({ line }) => `${f}:${line}`));
    expect(bad).toEqual([]);
  });

  it('every <Svg> is hidden from screen readers or sits inside an accessible, labelled wrapper', () => {
    // Collection art (Jar, kit) draws inside a wrapper View with role=image + label (accessible groups its children; hiding the inner SVG would also hide it from tests). WeekRing's wrapper is hidden or the single labelled node.
    const WRAPPED = ['ui/collection/Jar.tsx', 'ui/collection/kit.tsx', 'ui/WeekRing.tsx'];
    const bad = all.flatMap(({ f, src }) =>
      openingTags(src, /Svg/)
        .filter(({ tag }) => !hidden(tag) && !/accessibilityElementsHidden/.test(tag) && !WRAPPED.includes(f))
        .map(({ line }) => `${f}:${line}`));
    expect(bad).toEqual([]);
  });

  it('no component turns off font scaling', () => {
    const bad = all.filter(({ src }) => /allowFontScaling=\{false\}/.test(src)).map(({ f }) => f);
    expect(bad).toEqual([]);
  });
});
