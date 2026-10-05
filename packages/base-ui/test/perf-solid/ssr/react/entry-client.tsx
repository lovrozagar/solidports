import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { ssrFixtures } from './fixtures';

(window as unknown as { __hydrate: (key: string) => number }).__hydrate = (key) => {
  const Fixture = ssrFixtures[key];
  const start = performance.now();
  hydrateRoot(document.getElementById('root')!, <Fixture />, {
    onRecoverableError: (error) => console.error('[hydration-mismatch]', String(error)),
  });
  return performance.now() - start;
};
