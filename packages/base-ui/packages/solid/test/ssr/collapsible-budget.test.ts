/** @vitest-environment node */
/*
 * Collapsible's server budgets against its hand-written floor (plan 3 leaf 3.1): the same number of
 * hydration keys in the server HTML (no id-consuming element beyond the floor's), and a server
 * render within 1.5x of the floor's, as medians of interleaved batches.
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
  renderPart: (open: boolean, count?: number) => string;
  renderFloor: (open: boolean, count?: number) => string;
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
  fixture = (await server.ssrLoadModule(resolve(here, 'collapsible-budget.fixture.tsx'))) as never;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

const keys = (html: string) => html.match(/ _hk=/g)?.length ?? 0;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe('collapsible server budget', () => {
  it.each([false, true])('renders no more hydration keys than the floor (open: %s)', (open) => {
    const part = keys(fixture.renderPart(open));
    const floor = keys(fixture.renderFloor(open));
    expect(part, `part ${part} keys, floor ${floor}`).toBeLessThanOrEqual(floor);
  });

  it('renders 300 closed collapsibles within 1.5x of the floor', () => {
    const batch = (render: () => string) => {
      const start = performance.now();
      render();
      return performance.now() - start;
    };
    const { renderPart, renderFloor } = fixture;
    const renderParts = () => renderPart(false, 300);
    const renderFloors = () => renderFloor(false, 300);
    const part: number[] = [];
    const floor: number[] = [];
    for (let run = 0; run < 23; run += 1) {
      const p = batch(renderParts);
      const f = batch(renderFloors);
      if (run >= 3) {
        part.push(p);
        floor.push(f);
      }
    }
    const ratio = median(part) / median(floor);
    expect(
      ratio,
      `part ${median(part).toFixed(2)} ms, floor ${median(floor).toFixed(2)} ms`,
    ).toBeLessThanOrEqual(1.5);
  }, 60_000);
});
