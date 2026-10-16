import type * as HydrationSentinel from '../hydrationSentinel';

// No `vite` or `vitest` import: a production server bundle runs this too
// (`test/ssr/production.test.ts`).

/** A `*.ssr-fixtures.tsx` module, as `defineSsrFixtures` default-exports it. */
export interface SsrFixtureModule {
  default?: { file: string; fixtures: Record<string, () => unknown> };
}

/** The `@solidjs/web` server functions the renders use, from the same instance as the fixtures. */
export interface ServerWeb {
  renderToString: (fn: () => unknown) => string;
  renderToStream: (fn: () => unknown) => PromiseLike<string>;
  createComponent: (component: (props: any) => any, props: object) => unknown;
}

/**
 * Server-renders every fixture of the given modules, keyed by `<path under src>#<name>` plus the
 * `SERVER_RENDERS` suffix of each render. Each fixture renders on its own, so one failing fixture
 * reports its error without hiding the others.
 */
export async function renderFixtureModules(
  web: ServerWeb,
  sentinel: Pick<
    typeof HydrationSentinel,
    'SERVER_RENDERS' | 'WithHydrationSentinel' | 'WithHydrationSentinelInBoundaries'
  >,
  modules: Array<[path: string, module: SsrFixtureModule]>,
): Promise<Record<string, string | { error: string }>> {
  const { SERVER_RENDERS, WithHydrationSentinel, WithHydrationSentinelInBoundaries } = sentinel;
  const result: Record<string, string | { error: string }> = {};
  for (const [path, mod] of modules) {
    if (!mod.default?.fixtures) {
      throw new Error(`${path} must default-export defineSsrFixtures(import.meta.url, { ... })`);
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
  return result;
}
