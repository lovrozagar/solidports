/** @vitest-environment node */
/*
 * Client rendering from a production build, as an app ships it (beside the production server test:
 * this project runs in Node): the library and Solid's browser
 * production runtime bundled together and run in a plain Node process with a DOM. The test runner
 * resolves Solid's dev builds, which keep what the production runtime disposes: `provideContext`
 * once rendered under the provider's lazy children memo, which the production runtime disposed
 * when nothing observed it, freezing the part after its first paint.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
// Inside the package, so Node resolves `jsdom` for the run.
const cache = join(pkg, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const outDir = mkdtempSync(join(cache, 'client-production-'));
let result: { first: string; last: string };

beforeAll(async () => {
  await build({
    configFile: false,
    logLevel: 'silent',
    mode: 'production',
    root: pkg,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [solidPlugin() as never],
    resolve: {
      alias: { '@solidports/base-ui': resolve(pkg, 'src') },
      conditions: ['browser', 'production'],
    },
    build: {
      lib: { entry: resolve(here, 'production-client.fixture.tsx'), formats: ['es'] },
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'fixture.mjs' } },
    },
  });
  const bundle = pathToFileURL(join(outDir, 'fixture.mjs')).href;
  const script = `import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment', 'DocumentFragment', 'MutationObserver', 'navigator']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true });
}
const m = await import(${JSON.stringify(bundle)});
process.stdout.write(JSON.stringify(m.renderLateConsumer()));`;
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.NODE_OPTIONS;
  result = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: outDir,
      encoding: 'utf8',
      env,
    }),
  );
}, 120_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('production client build', () => {
  it('a provided part keeps updating, and a consumer mounted after its first paint reads the value', () => {
    expect(result.first).toBe('<div data-count="0"></div>');
    expect(result.last).toBe('<div data-count="2"><span>provided</span></div>');
  });
});
