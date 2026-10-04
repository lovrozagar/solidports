import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');

/** Renders a server entry (`export function render(): string`) with Solid's SSR transform. */
export async function serverRender(entry: string): Promise<string> {
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
    root: pkg,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  try {
    const mod = (await server.ssrLoadModule(resolve(here, entry))) as { render: () => string };
    return mod.render();
  } finally {
    await server.close();
  }
}
