/** @vitest-environment node */
/*
 * Server rendering from a production build, as an app ships it: the library source bundled with
 * Solid's SSR transform, and `solid-js`, `@solidjs/web` and `@solidjs/signals` left external. A
 * plain Node process renders the bundle, so Node resolves the production builds of those packages
 * (the test runner resolves their dev builds, whose unminified internals can hide bugs). Every
 * fixture of the families on the native server path (`production.fixture.tsx`) must render, as a
 * string and as streams, the markup the dev build renders. Hydration keys and generated ids are
 * compared by first appearance, not by value: the dev builds create id-consuming owners the
 * production builds do not, so the values differ while each build matches its own client. The SSR bench (`test/perf-solid/ssr/run.mjs`)
 * hydrates the production builds in Chromium and fails on a mismatch.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderSsrFixtures } from '../hydration/serverRender';

type Renders = Record<string, string | { error: string }>;

/**
 * A render with each hydration key and generated id replaced by its order of first appearance, so
 * the relations between them (`aria-controls` to `id`) still compare.
 */
function markup(html: string | { error: string } | undefined) {
  if (typeof html !== 'string') {
    return html;
  }
  const seen = new Map<string, number>();
  return html.replace(/(?<= _hk=)[^\s>]*|base-ui-[0-9a-z]+/g, (match) => {
    let index = seen.get(match);
    if (index === undefined) {
      index = seen.size;
      seen.set(match, index);
    }
    return `#${index}`;
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
// Inside the package, so Node resolves the bundle's external packages.
const cache = join(pkg, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const outDir = mkdtempSync(join(cache, 'ssr-production-'));
let production: { signalsUrl: string; fixtures: Renders };
let dev: Renders;

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
process.stdout.write(JSON.stringify({ signalsUrl: m.signalsUrl, fixtures: await m.renderFixtures() }));`;
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.NODE_OPTIONS;
  production = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: outDir,
      encoding: 'utf8',
      env,
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const files = new Set(Object.keys(production.fixtures).map((key) => key.split('#')[0]));
  // eslint-disable-next-line testing-library/no-render-in-lifecycle -- a server render of fixture modules, not a mount
  dev = await renderSsrFixtures([...files].sort().map((file) => resolve(pkg, 'src', file)));
}, 180_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('production server build', () => {
  it('runs on the production reactive core', () => {
    expect(production.signalsUrl).toMatch(/\/dist\/prod\//);
  });

  it('renders every native-family fixture, as strings and streams', () => {
    expect(Object.keys(production.fixtures).length).toBeGreaterThan(0);
    const errors = Object.entries(production.fixtures).flatMap(([key, html]) =>
      typeof html === 'string' ? [] : [`${key}: ${html.error.split('\n')[0]}`],
    );
    expect(errors).toEqual([]);
  });

  it('renders the same markup as the dev build', () => {
    expect(Object.keys(dev).sort()).toEqual(Object.keys(production.fixtures).sort());
    const differences = Object.keys(dev).flatMap((key) => {
      const expected = markup(dev[key]);
      const actual = markup(production.fixtures[key]);
      if (JSON.stringify(expected) === JSON.stringify(actual)) {
        return [];
      }
      if (typeof expected !== 'string' || typeof actual !== 'string') {
        return [`${key}: dev ${typeof expected}, production ${typeof actual}`];
      }
      let at = 0;
      while (expected[at] === actual[at]) {
        at += 1;
      }
      return [
        `${key} at ${at}: dev …${expected.slice(at, at + 80)}… production …${actual.slice(at, at + 80)}…`,
      ];
    });
    expect(differences).toEqual([]);
  });
});
