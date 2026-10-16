/** @vitest-environment node */
/*
 * Accordion's server budget against its hand-written floor: the same number of hydration keys in
 * the server HTML (no id-consuming element beyond the floor's). Server render and hydration time are
 * judged on production builds by `bun run bench:component accordion` (the exit bar: within 1.25x of
 * the floor and below React), not here on the dev builds.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;
let fixture: {
  renderPart: (open: boolean) => string;
  renderFloor: (open: boolean) => string;
};

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
  fixture = (await server.ssrLoadModule(resolve(here, 'accordion-budget.fixture.tsx'))) as never;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

const keys = (html: string) => html.match(/ _hk=/g)?.length ?? 0;

describe('accordion server budget', () => {
  // The native path guesses each item's index from its creation order, as the hydrating client
  // does; the slow path renders -1 until the client registers the items.
  it('renders the item indexes on the server, as the native parts do', () => {
    const view = fixture.renderPart(false);
    expect(view.match(/<div[^>]* data-index="(\d+)"/g)?.length).toBe(2);
    expect(view).toContain('data-index="0"');
    expect(view).toContain('data-index="1"');
  });

  it.each([false, true])('renders no more hydration keys than the floor (open: %s)', (open) => {
    const part = keys(fixture.renderPart(open));
    const floor = keys(fixture.renderFloor(open));
    expect(part, `part ${part} keys, floor ${floor}`).toBeLessThanOrEqual(floor);
  });
});
