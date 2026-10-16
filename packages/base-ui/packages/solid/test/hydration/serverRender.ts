import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type * as HydrationSentinel from '../hydrationSentinel';
import { renderFixtureModules } from './renderFixtures';
import type { ServerWeb, SsrFixtureModule } from './renderFixtures';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');

function createSsrServer() {
  return createServer({
    appType: 'custom',
    // Its own cache and no client dep discovery: a shared Vite cache would re-optimize the
    // browser test server's deps mid-run.
    cacheDir: join(tmpdir(), 'solidports-ssr-fixtures'),
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true },
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
    root: pkg,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
}

/** Renders a server entry (`export function render(): string`) with Solid's SSR transform. */
export async function serverRender(entry: string): Promise<string> {
  const server = await createSsrServer();
  try {
    const mod = (await server.ssrLoadModule(resolve(here, entry))) as { render: () => string };
    return mod.render();
  } finally {
    await server.close();
  }
}

/**
 * Server-renders every fixture of the given `*.ssr-fixtures.tsx` modules (absolute paths) with the
 * dev builds, through `renderFixtureModules`.
 */
export async function renderSsrFixtures(
  files: string[],
): Promise<Record<string, string | { error: string }>> {
  if (files.length === 0) {
    return {};
  }
  const server = await createSsrServer();
  try {
    const web = (await server.ssrLoadModule('@solidjs/web')) as ServerWeb;
    const sentinel = (await server.ssrLoadModule(
      resolve(here, '../hydrationSentinel.tsx'),
    )) as typeof HydrationSentinel;
    const modules: Array<[string, SsrFixtureModule]> = [];
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop -- one Vite SSR server loads one module at a time
      modules.push([file, (await server.ssrLoadModule(file)) as SsrFixtureModule]);
    }
    return await renderFixtureModules(web, sentinel, modules);
  } finally {
    await server.close();
  }
}
