import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type { TestProject } from 'vitest/node';
import { docsAliases } from '../../../vitest.config.mts';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Server HTML of each `docs-infra/src/**\/*.server.tsx` entry, keyed by its path under `src`. */
    docsServerHtml: Record<string, string>;
  }
}

const SRC = resolve(import.meta.dirname, '..');

/**
 * Server-renders the runtime's `*.server.tsx` entries (`export function render(): string`) with
 * Solid's server output before the run: the jsdom project only has Solid's client output.
 */
export default async function setup(project: TestProject) {
  const entries: string[] = [];
  for await (const file of glob('**/*.server.tsx', { cwd: SRC })) {
    entries.push(file);
  }
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true },
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: docsAliases },
    root: resolve(SRC, '../..'),
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  const docsServerHtml: Record<string, string> = {};
  try {
    for (const entry of entries.sort()) {
      // eslint-disable-next-line no-await-in-loop -- one Vite SSR server loads one module at a time
      const mod = (await server.ssrLoadModule(resolve(SRC, entry))) as {
        render: () => string | Promise<string>;
      };
      // eslint-disable-next-line no-await-in-loop -- renders one entry at a time
      docsServerHtml[entry] = await mod.render();
    }
  } finally {
    await server.close();
  }
  project.provide('docsServerHtml', docsServerHtml);
}
