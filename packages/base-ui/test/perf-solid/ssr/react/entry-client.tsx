import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
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
  hydrateRoot(
    document.getElementById('root')!,
    <Committed onCommit={() => resolveCommitted(performance.now() - start)}>
      <Fixture />
    </Committed>,
    { onRecoverableError: (error) => console.error('[hydration-mismatch]', String(error)) },
  );
  return { syncMs: performance.now() - start, committed };
};
