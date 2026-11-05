import { transformFileSync } from '@babel/core';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

// Animated styles and props run on the UI thread. A plain JS function they capture crashes there on a phone
// ("Tried to synchronously call a Remote Function"), but jest runs them as ordinary JS, so the other tests can't see
// it. This compiles the moments files with the worklets plugin, as the app bundle does, and checks that every
// function of our own a worklet captures is itself a worklet.

const DIR = path.join(__dirname, '..', 'moments');
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));

function capturedNames(file: string): Set<string> {
  const out = transformFileSync(file, {
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
    plugins: ['@babel/plugin-syntax-jsx', 'react-native-worklets/plugin'],
  });
  const names = new Set<string>();
  for (const m of (out?.code ?? '').matchAll(/const\s*\[([^\]]*)\]\s*=\s*this\.__closure/g)) {
    for (const n of m[1].split(',')) names.add(n.trim());
  }
  return names;
}

/** The module-level function `name` declared in `src`: whether it exists and whether it is a worklet. */
function declaration(src: string, name: string): { found: boolean; worklet: boolean } {
  const re = new RegExp(`^(?:export )?(?:const ${name}\\s*=\\s*\\(|function ${name}\\s*\\()`, 'm');
  const at = src.search(re);
  if (at < 0) return { found: false, worklet: false };
  // The directive is the first statement, so it sits within the declaration's first lines; stop at the next top-level line.
  const [first, ...rest] = src.slice(at).split('\n');
  const head = [first];
  for (const line of rest.slice(0, 3)) {
    if (/^\S/.test(line)) break;
    head.push(line);
  }
  return { found: true, worklet: head.join('\n').includes("'worklet'") };
}

/** Source of the relative module `name` is imported from in `src`, or `src` itself when it isn't imported. */
function sourceOf(file: string, src: string, name: string): string | null {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const names = m[1].split(',').map((s) => s.replace(/^\s*type\s+/, '').split(' as ')[0].trim());
    if (!names.includes(name)) continue;
    if (!m[2].startsWith('.')) return null;
    const base = path.resolve(path.dirname(file), m[2]);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return readFileSync(base + ext, 'utf8');
      } catch {
        // try the next extension
      }
    }
    return null;
  }
  return src;
}

describe('moments worklets', () => {
  it.each(FILES)('%s: every function of ours an animated callback captures is a worklet', (f) => {
    const file = path.join(DIR, f);
    const src = readFileSync(file, 'utf8');
    const remote: string[] = [];
    // A function handed to scheduleOnRN is meant to run back on the JS thread (onIndex, the lab trail): not a worklet.
    const toJs = new Set([...src.matchAll(/scheduleOnRN\(\s*(\w+)/g)].map((m) => m[1]));
    for (const name of capturedNames(file)) {
      if (toJs.has(name)) continue;
      const from = sourceOf(file, src, name);
      if (from === null) continue;
      const d = declaration(from, name);
      if (d.found && !d.worklet) remote.push(name);
    }
    expect(remote).toEqual([]);
  });
});
