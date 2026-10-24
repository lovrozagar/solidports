import { readdirSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { renderSsrFixtures, serverRender } from './serverRender';
// Types the provided `ssrFixtures` context.
import type {} from '../ssrFixtures';

declare module 'vitest' {
  export interface ProvidedContext {
    /**
     * Server HTML of each `test/hydration/*.server.tsx` entry, keyed by file name, URI-encoded:
     * read it with `serverHtml()` (`test/hydration/serverHtml.ts`).
     */
    serverHtml: Record<string, string>;
  }
}

/*
 * Server-renders the hydration fixtures and every `*.ssr-fixtures.tsx` fixture under `src` in Node before the run, so hydration tests also run in
 * browser mode, where Vite's SSR loader isn't available.
 */
export default async function setup(project: TestProject) {
  const dir = dirname(fileURLToPath(import.meta.url));
  const entries = readdirSync(dir).filter((file) => file.endsWith('.server.tsx'));
  const serverHtml: Record<string, string> = {};
  for (const entry of entries) {
    // URI-encoded, as the SSR fixtures below: browser mode inlines provided values into the
    // orchestrator page's `<script>`, and a fixture's `</script>` (a prehydration script) ended it,
    // failing every browser test file. Read back with `serverHtml()`.
    // eslint-disable-next-line no-await-in-loop -- each entry starts and closes its own Vite server
    serverHtml[entry] = encodeURIComponent(await serverRender(entry));
  }
  project.provide('serverHtml', serverHtml);
  const fixtureFiles: string[] = [];
  for await (const file of glob('src/**/*.ssr-fixtures.tsx', { cwd: resolve(dir, '../..') })) {
    fixtureFiles.push(resolve(dir, '../..', file));
  }
  // URI-encoded: browser mode inlines provided values into the orchestrator page's `<script>`, and
  // server HTML can hold `</script>` (pre-hydration scripts).
  const fixtures = await renderSsrFixtures(fixtureFiles.sort());
  project.provide(
    'ssrFixtures',
    Object.fromEntries(
      Object.entries(fixtures).map(([key, value]) => [
        key,
        typeof value === 'string'
          ? encodeURIComponent(value)
          : { error: encodeURIComponent(value.error) },
      ]),
    ),
  );
}
