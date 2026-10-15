// docs-infra's `createSitemap`, kept by hand for Solid: it returns the sitemap docs-infra's loader
// precomputed at build time.
import type { ComponentType } from 'docs/src/adapters/react';
import type { Sitemap } from './types';

type CreateSitemapMeta = {
  name?: string;
  slug?: string;
  displayName?: string;
  precompute?: Sitemap;
  skipPrecompute?: boolean;
  [key: string]: any;
};

/**
 * The sitemap of the given pages, as `loadPrecomputedSitemap` precomputed it.
 * @param sourceUrl Depends on `import.meta.url` to determine the source file location.
 * @param pages Record of page components indexed by path.
 * @param meta Additional meta and the precomputed sitemap.
 */
export function createSitemap(
  sourceUrl: string,
  pages: Record<string, ComponentType<any> | null>,
  meta?: CreateSitemapMeta,
): Sitemap | undefined {
  if (!sourceUrl.startsWith('file:')) {
    throw new Error(
      'Base UI docs: createSitemap() requires the `sourceUrl` argument to be a file URL. Use `import.meta.url` to get the current file URL.',
    );
  }
  if (meta?.precompute || meta?.skipPrecompute) {
    return meta.precompute;
  }
  throw new Error(
    `Base UI docs: createSitemap() got no precomputed sitemap in ${sourceUrl}. ` +
      "Precompute it with docs-infra's `loadPrecomputedSitemap` loader, which runs on " +
      '`app/sitemap/index.ts`.',
  );
}
