/** @vitest-environment node */
/*
 * Server rendering: parts that render on the first pass (an app-root toast portal) must not touch
 * `document`. Compiles the fixture with Solid's SSR transform through Vite, as an SSR app does.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
    root: pkg,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe('server rendering', () => {
  it('renders a page with a toast portal without touching document', async () => {
    const fixture = (await server.ssrLoadModule(resolve(here, 'toast-portal.fixture.tsx'))) as {
      render: () => string;
    };
    expect(fixture.render()).toContain('page');
  }, 60_000);

  it('renders uncontrolled defaults as the value attribute', async () => {
    const fixture = (await server.ssrLoadModule(resolve(here, 'default-value.fixture.tsx'))) as {
      render: () => string;
    };
    const html = fixture.render();
    expect(html).toMatch(/<input[^>]*value="ada@acme\.dev"/);
    expect(html).toMatch(/<input[^>]*value="3"/);
    expect(html.toLowerCase()).not.toContain('defaultvalue');
  }, 60_000);
});
