/** @vitest-environment node */
/*
 * Every `*.ssr-fixtures.tsx` fixture renders the same markup with the native server templates as
 * through `ssrElement`, in each server render (string, stream, stream in boundaries): byte for byte,
 * hydration keys included.
 */
import { glob } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type * as HydrationSentinel from '../hydrationSentinel';
import { renderFixtureModules as markupOfFixtures } from '../hydration/renderFixtures';
import type { ServerWeb, SsrFixtureModule } from '../hydration/renderFixtures';
import { createSsrServer } from '../hydration/serverRender';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;
let templated: Record<string, string | { error: string }>;
let generic: Record<string, string | { error: string }>;

beforeAll(async () => {
  server = await createSsrServer();
  const element = (await server.ssrLoadModule(resolve(pkg, 'src/utils/native/element.ts'))) as {
    setServerTemplates: (enabled: boolean) => void;
  };
  const web = (await server.ssrLoadModule('@solidjs/web')) as ServerWeb;
  const sentinel = (await server.ssrLoadModule(
    resolve(here, '../hydrationSentinel.tsx'),
  )) as typeof HydrationSentinel;
  const modules: Array<[string, SsrFixtureModule]> = [];
  for await (const file of glob('src/**/*.ssr-fixtures.tsx', { cwd: pkg })) {
    modules.push([file, (await server.ssrLoadModule(resolve(pkg, file))) as SsrFixtureModule]);
  }
  modules.sort(([a], [b]) => (a < b ? -1 : 1));
  try {
    element.setServerTemplates(false);
    generic = await markupOfFixtures(web, sentinel, modules);
  } finally {
    element.setServerTemplates(true);
  }
  templated = await markupOfFixtures(web, sentinel, modules);
}, 120_000);

afterAll(async () => {
  await server?.close();
});

it('renders every fixture identically on both paths', () => {
  const keys = Object.keys(generic);
  expect(keys.length).toBeGreaterThan(300);
  expect(Object.keys(templated)).toEqual(keys);
  const differing = keys.filter(
    (key) => JSON.stringify(templated[key]) !== JSON.stringify(generic[key]),
  );
  expect(differing).toEqual([]);
});
