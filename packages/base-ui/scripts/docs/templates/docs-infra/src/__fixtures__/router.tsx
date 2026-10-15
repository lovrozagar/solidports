import { createRouter, memoryHistory } from '@solidjs/router';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';

/** `Page` at `path` inside the docs' router, the same on the server and the client. */
export function createPageFixture(path: string, Page: Component): () => JSX.Element {
  const Router = createRouter({
    routes: [{ path: '*', component: Page }],
    history: memoryHistory(path),
  });
  return () => <Router url={path}>{(props) => props.children}</Router>;
}
