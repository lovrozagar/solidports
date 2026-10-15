import { createEffect, createMemo, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { loadSearchSitemap } from './searchSitemap';

// `sitemapImport` must reset its rejected import cache, otherwise the retry
// loop below would keep receiving the same rejected promise.
export function useDeferredSearchSitemap(
  active: Accessor<boolean>,
  _sitemapImport?: Accessor<typeof loadSearchSitemap | undefined>,
) {
  const sitemapImport = createMemo(() => {
    const _sitemapImport2 = _sitemapImport?.();
    return _sitemapImport2 === undefined ? loadSearchSitemap : _sitemapImport2;
  });
  const activeRef = {
    current: untrack(active),
  };
  const sitemapImportRef = {
    current: untrack(sitemapImport),
  };
  const pendingResolversRef: {
    current: Set<() => void>;
  } = {
    current: new Set(),
  };
  activeRef.current = untrack(active);
  sitemapImportRef.current = untrack(sitemapImport);
  createEffect(
    () => [active()],
    () => {
      if (!active()) {
        return undefined;
      }
      const pendingResolvers = pendingResolversRef.current;
      pendingResolvers.forEach((resolve) => resolve());
      pendingResolvers.clear();
      return undefined;
    },
  );
  const waitForActivation = () =>
    new Promise<void>((resolve) => {
      pendingResolversRef.current.add(resolve);
    });
  const _useStableCallback = async () => {
    if (!activeRef.current) {
      await waitForActivation();
    }
    for (;;) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await sitemapImportRef.current();
      } catch {
        // The import failed (e.g. a network error) and its cache was reset.
        // Retry on the next activation instead of leaving search
        // permanently broken, since the caller only invokes this loader once.
        // eslint-disable-next-line no-await-in-loop
        await waitForActivation();
      }
    }
  };
  return createMemo(() => _useStableCallback);
}
