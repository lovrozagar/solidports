import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { serverRender } from './serverRender';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Server HTML of each `test/hydration/*.server.tsx` entry, keyed by file name. */
    serverHtml: Record<string, string>;
  }
}

/*
 * Server-renders the hydration fixtures in Node before the run, so hydration tests also run in
 * browser mode, where Vite's SSR loader isn't available.
 */
export default async function setup(project: TestProject) {
  const dir = dirname(fileURLToPath(import.meta.url));
  const entries = readdirSync(dir).filter((file) => file.endsWith('.server.tsx'));
  const serverHtml: Record<string, string> = {};
  for (const entry of entries) {
    serverHtml[entry] = await serverRender(entry);
  }
  project.provide('serverHtml', serverHtml);
}
