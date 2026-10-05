import { createComponent, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, inject } from 'vitest';
import type { SsrFixtures } from './defineSsrFixtures';

export { defineSsrFixtures, type SsrFixtures } from './defineSsrFixtures';

declare module 'vitest' {
  export interface ProvidedContext {
    /**
     * Server HTML of every `*.ssr-fixtures.tsx` fixture (URI-encoded), keyed by
     * `<path under src>#<name>`. A fixture that threw on the server maps to `{ error }` (also URI-encoded).
     */
    ssrFixtures: Record<string, string | { error: string }>;
  }
}

const mounted: Array<{ container: HTMLElement; dispose?: () => void }> = [];

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.dispose?.();
    entry.container.remove();
  }
});

export interface ServerRenderResult {
  /** The container holding the server HTML (and, after `hydrate`, the hydrated tree). */
  container: HTMLElement;
  /** The server HTML as rendered. */
  html: string;
  /** Hydrates the server HTML with the fixture's client build; returns the disposer. */
  hydrate: () => () => void;
}

/** Inserts a fixture's server HTML into the document, ready to hydrate. */
export function renderServer<Names extends string>(
  module: SsrFixtures<Names>,
  name: Names,
): ServerRenderResult {
  const key = `${module.file}#${name}`;
  const rendered = inject('ssrFixtures')[key];
  if (rendered === undefined) {
    throw new Error(
      `No server HTML for ${key}: is the fixture exported from a *.ssr-fixtures.tsx default export?`,
    );
  }
  if (typeof rendered !== 'string') {
    throw new Error(`Server render of ${key} failed: ${decodeURIComponent(rendered.error)}`);
  }
  const html = decodeURIComponent(rendered);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const entry: { container: HTMLElement; dispose?: () => void } = { container };
  mounted.push(entry);
  return {
    container,
    html,
    hydrate() {
      // The hydration script's runtime state, as `<HydrationScript />` sets it up on a page.
      (window as unknown as { _$HY: object })._$HY = {
        completed: new WeakSet(),
        done: false,
        events: [],
        fe() {},
        r: {},
      };
      entry.dispose = hydrate(() => createComponent(module.fixtures[name], {}), container);
      flush();
      return entry.dispose;
    },
  };
}
