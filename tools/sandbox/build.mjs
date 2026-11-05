// Builds the YSave sandbox: the app's REAL src/ code (domain, data repos, state actions, moments player and scenes)
// bundled for the browser the way Expo web does it (react-native -> react-native-web, Reanimated web, react-native-svg
// web, the worklets Babel plugin on our own source). Only tools/sandbox/*.tsx is sandbox code.
//
// Usage: node tools/sandbox/build.mjs <toolsDir> <outDir>
//   toolsDir: a folder with node_modules/esbuild and node_modules/sql.js (kept out of the app's package.json)
//   outDir:   where index.html, sandbox.js, sql-wasm.wasm and the fonts go
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');
const [toolsDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
if (!toolsDir || !outDir) throw new Error('usage: node build.mjs <toolsDir> <outDir>');

const toolsRequire = createRequire(path.join(toolsDir, 'package.json'));
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const esbuild = toolsRequire('esbuild');
const babel = appRequire('@babel/core');

// Our own source goes through the same worklets Babel plugin Metro uses, so useAnimatedStyle/useDerivedValue get
// their closures exactly as on the phone. TypeScript and JSX are only parsed here; esbuild strips them afterwards.
const worklets = {
  name: 'worklets',
  setup(b) {
    b.onLoad({ filter: /[\\/](src|tools[\\/]sandbox)[\\/].*\.tsx?$/ }, async (args) => {
      const code = await fs.promises.readFile(args.path, 'utf8');
      const isTsx = args.path.endsWith('.tsx');
      const out = await babel.transformAsync(code, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        sourceType: 'module',
        parserOpts: { plugins: [['typescript', { isTSX: isTsx }], ...(isTsx ? ['jsx'] : [])] },
        plugins: [appRequire.resolve('react-native-worklets/plugin')],
        retainLines: true,
      });
      return { contents: out.code, loader: isTsx ? 'tsx' : 'ts', resolveDir: path.dirname(args.path) };
    });
  },
};

// Server-only or native-only modules a web library imports but never calls in the browser.
const STUBS = {
  'node:async_hooks': 'export class AsyncLocalStorage { getStore() { return undefined; } run(_s, fn) { return fn(); } }',
  // sql.js only touches these in Node; in the browser its Node branch never runs.
  fs: 'export default {};',
  path: 'export default {};',
  crypto: 'export default {};',
  '@react-native/assets-registry/registry': 'export function getAssetByID() { return null; } export function registerAsset() { return 0; }',
};
const stubs = {
  name: 'stubs',
  setup(b) {
    const filter = new RegExp(`^(${Object.keys(STUBS).map((k) => k.replace(/[/.]/g, '\\$&')).join('|')})$`);
    b.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'stub' }));
    b.onResolve({ filter: /^expo$/ }, () => ({ path: path.join(here, 'expo-shim.js') }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({ contents: STUBS[args.path], loader: 'js' }));
  },
};

// react-native-svg's WEB shape only applies an animated fill/stroke when it arrives as a packed colour object and drops
// plain strings ('#f7d45e', 'none'), so every 3D face stayed invisible in the browser. On the phone this file is not
// used. The sandbox patches only this browser-side library file; the app's own code is bundled unchanged.
const svgWebColors = {
  name: 'svg-web-colors',
  setup(b) {
    b.onLoad({ filter: /react-native-svg[\\/]lib[\\/]module[\\/]web[\\/]WebShape\.js$/ }, async (args) => {
      let code = await fs.promises.readFile(args.path, 'utf8');
      for (const attr of ['fill', 'stroke']) {
        const before = `case '${attr}':
            if (cleanValue && typeof cleanValue === 'object') {`;
        if (!code.includes(before)) throw new Error(`svg-web-colors: ${attr} case not found; react-native-svg changed`);
        code = code.replace(before, `case '${attr}':
            if (typeof cleanValue === 'string') { current.setAttribute('${attr}', cleanValue); break; }
            if (cleanValue && typeof cleanValue === 'object') {`);
      }
      return { contents: code, loader: 'jsx' };
    });
  },
};

fs.mkdirSync(outDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(here, 'entry.tsx')],
  bundle: true,
  outfile: path.join(outDir, 'sandbox.js'),
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  nodePaths: [path.join(appRoot, 'node_modules'), path.join(toolsDir, 'node_modules')],
  tsconfig: path.join(appRoot, 'tsconfig.json'),
  alias: { 'react-native': path.join(here, 'rn-shim.js'), '@': path.join(appRoot, 'src') },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.mjs', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.jsx', '.json'],
  mainFields: ['browser', 'module', 'main'],
  loader: { '.js': 'jsx', '.ttf': 'file', '.sql': 'text', '.png': 'file', '.wasm': 'file' },
  assetNames: 'assets/[name]-[hash]',
  define: {
    __DEV__: 'false', // release behaviour: no dev 0.25x slowdown (the sandbox has its own speed bar)
    'process.env.NODE_ENV': '"development"',
    'process.env.EXPO_OS': '"web"',
    global: 'globalThis',
  },
  plugins: [stubs, svgWebColors, worklets],
  logLevel: 'warning',
  metafile: true,
  banner: { js: 'globalThis.process = globalThis.process || { env: { NODE_ENV: "development", EXPO_OS: "web" } };' },
});

fs.copyFileSync(toolsRequire.resolve('sql.js/dist/sql-wasm.wasm'), path.join(outDir, 'sql-wasm.wasm'));
fs.writeFileSync(path.join(outDir, '..', 'sandbox-meta.json'), JSON.stringify(result.metafile));
console.log('built', outDir);
