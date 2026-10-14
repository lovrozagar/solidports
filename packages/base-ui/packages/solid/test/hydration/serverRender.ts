import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type * as HydrationSentinel from '../hydrationSentinel';

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
 * Server-renders every fixture of the given `*.ssr-fixtures.tsx` modules (absolute paths), keyed
 * by `<path under src>#<name>` plus the `SERVER_RENDERS` suffix of each render. Each fixture renders on its own, so one failing fixture reports
 * its error without hiding the others.
 */
export async function renderSsrFixtures(
  files: string[],
): Promise<Record<string, string | { error: string }>> {
  const result: Record<string, string | { error: string }> = {};
  if (files.length === 0) {
    return result;
  }
  const server = await createSsrServer();
  try {
    const web = (await server.ssrLoadModule('@solidjs/web')) as {
      renderToString: (fn: () => unknown) => string;
      renderToStream: (fn: () => unknown) => PromiseLike<string>;
      createComponent: (component: (props: any) => unknown, props: object) => unknown;
    };
    const { SERVER_RENDERS, WithHydrationSentinel, WithHydrationSentinelInBoundaries } =
      (await server.ssrLoadModule(
        resolve(here, '../hydrationSentinel.tsx'),
      )) as typeof HydrationSentinel;
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop -- one Vite SSR server loads one module at a time
      const mod = (await server.ssrLoadModule(file)) as {
        default?: { file: string; fixtures: Record<string, () => unknown> };
      };
      if (!mod.default?.fixtures) {
        throw new Error(`${file} must default-export defineSsrFixtures(import.meta.url, { ... })`);
      }
      for (const [name, fixture] of Object.entries(mod.default.fixtures)) {
        const key = `${mod.default.file}#${name}`;
        const render = (boundaries: boolean) => () =>
          web.createComponent(
            boundaries ? WithHydrationSentinelInBoundaries : WithHydrationSentinel,
            { fixture },
          );
        try {
          result[key] = web.renderToString(render(false));
        } catch (error) {
          result[key] = { error: String((error as Error)?.stack ?? error) };
        }
        // Streaming SSR, as a server framework renders a page: on its own, and inside the error
        // and loading boundaries a routed page renders in.
        for (const [suffix, boundaries] of [
          [SERVER_RENDERS.stream, false],
          [SERVER_RENDERS.streamBoundaries, true],
        ] as const) {
          try {
            // eslint-disable-next-line no-await-in-loop -- one fixture streams at a time
            result[`${key}${suffix}`] = await web.renderToStream(render(boundaries));
          } catch (error) {
            result[`${key}${suffix}`] = { error: String((error as Error)?.stack ?? error) };
          }
        }
      }
    }
  } finally {
    await server.close();
  }
  return result;
}
