import type { JSX } from '@solidjs/web';

// No `vitest` import: the global setup loads fixture modules through Vite's SSR loader in Node,
// outside the test runner.

export interface SsrFixtures<Names extends string = string> {
  /** The fixture module's path under `src/`, the key prefix the global setup uses. */
  file: string;
  fixtures: Record<Names, () => JSX.Element>;
}

/**
 * Declares server-rendered test fixtures. The global setup (`test/hydration/globalSetup.ts`)
 * renders each fixture with Solid's SSR transform in Node before the run; `renderServer` puts
 * that HTML in the document and hydrates it with the client build of the same fixture.
 *
 * @example
 * // SelectRoot.ssr-fixtures.tsx
 * export default defineSsrFixtures(import.meta.url, { label: () => <Select.Root>…</Select.Root> });
 */
export function defineSsrFixtures<Names extends string>(
  url: string,
  fixtures: Record<Names, () => JSX.Element>,
): SsrFixtures<Names> {
  const file = decodeURIComponent(url)
    .split('/src/')
    .pop()!
    .replace(/[?#].*$/, '');
  return { file, fixtures };
}
