import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { ssrFixtures } from './fixtures/index';

/** Calls `onCommit` from the root's layout effect, which React runs once the tree is committed. */
function Committed(props: { onCommit: () => void; children: React.ReactNode }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at the hydration commit
  React.useLayoutEffect(props.onCommit, []);
  return props.children;
}

(
  window as unknown as {
    __hydrate: (key: string) => { syncMs: number; committed: Promise<number> };
  }
).__hydrate = (key) => {
  const Fixture = ssrFixtures[key];
  let resolveCommitted: (ms: number) => void;
  const committed = new Promise<number>((resolve) => {
    resolveCommitted = resolve;
  });
  const start = performance.now();
  // `hydrateRoot` is concurrent: it schedules the work and returns, so the sync time is not the
  // hydration; the commit is.
  ReactDOMClient.hydrateRoot(
    document.getElementById('root')!,
    <Committed onCommit={() => resolveCommitted(performance.now() - start)}>
      <Fixture />
    </Committed>,
    { onRecoverableError: (error) => console.error('[hydration-mismatch]', String(error)) },
  );
  return { syncMs: performance.now() - start, committed };
};

// D29: `?auto=1` hydrates as a page does, once the bundle has run, and records the commit against
// navigation start, for TTI (`ssr/interact.mjs`).
const params = new URLSearchParams(location.search);
if (params.get('auto') === '1') {
  const fixture = params.get('fixture')!;
  const { committed } = (
    window as unknown as { __hydrate: (key: string) => { committed: Promise<number> } }
  ).__hydrate(fixture);
  void committed.then(() => {
    (window as unknown as { __hydratedAt: number }).__hydratedAt = performance.now();
  });
}
