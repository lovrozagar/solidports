/** @vitest-environment node */
/*
 * Server rendering from a production build, as an app ships it: the library source bundled with
 * Solid's SSR transform, and `solid-js`, `@solidjs/web` and `@solidjs/signals` left external. A
 * plain Node process renders the bundle, so Node resolves the production builds of those packages
 * (the test runner resolves their dev builds, whose unminified internals can hide bugs).
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
// Inside the package, so Node resolves the bundle's external packages.
const cache = join(pkg, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const outDir = mkdtempSync(join(cache, 'ssr-production-'));
let rendered: { signalsUrl: string; closed: string; open: string };

beforeAll(async () => {
  await build({
    configFile: false,
    logLevel: 'silent',
    mode: 'production',
    root: pkg,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
    ssr: { noExternal: [/@solidports/] },
    build: {
      ssr: resolve(here, 'production.fixture.tsx'),
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'fixture.mjs' } },
    },
  });
  const bundle = pathToFileURL(join(outDir, 'fixture.mjs')).href;
  const script = `const m = await import(${JSON.stringify(bundle)});
const render = (open) => {
  try {
    return m.renderCollapsible(open);
  } catch (error) {
    return String(error);
  }
};
process.stdout.write(JSON.stringify({
  signalsUrl: m.signalsUrl,
  closed: render(false),
  open: render(true),
}));`;
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.NODE_OPTIONS;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: outDir,
    encoding: 'utf8',
    env,
  });
  rendered = JSON.parse(stdout);
}, 120_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('production server build', () => {
  it('runs on the production reactive core', () => {
    expect(rendered.signalsUrl).toMatch(/\/dist\/prod\//);
  });

  it.each(['closed', 'open'] as const)('renders a native %s Collapsible', (key) => {
    const html = rendered[key];
    expect(html).toMatch(/<button[^>]*aria-expanded="(true|false)"[^>]*>Toggle<\/button>/);
    expect(html.includes('>Content</div>')).toBe(key === 'open');
  });
});
