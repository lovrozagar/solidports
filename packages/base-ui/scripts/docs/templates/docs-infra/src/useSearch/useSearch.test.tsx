/*
 * Search indexes the precomputed sitemap once mounted and returns results shaped as upstream's:
 * grouped default results, ranked hits, and result URLs.
 */
import { render } from '@solidjs/web';
import { waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import type { Sitemap } from '../createSitemap/types';
import fixture from '../__fixtures__/sitemap.json';
import { useSearch } from './useSearch';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mountSearch() {
  let api!: ReturnType<ReturnType<typeof useSearch>>;
  dispose = render(() => {
    api = useSearch(() => ({
      sitemap: async () => ({ sitemap: fixture as unknown as Sitemap }),
      tolerance: 0,
      limit: 20,
      enableStemming: true,
      includeCategoryInGroup: true,
      excludeSections: true,
    }))();
    return null;
  }, document.createElement('div'));
  return api;
}

describe('useSearch', () => {
  it('indexes the sitemap and groups its pages as the default results', async () => {
    const api = mountSearch();
    await waitFor(() => {
      expect(api.isReady).toBe(true);
    });
    const titles = api.defaultResults.results.flatMap((group) =>
      group.items.map((item) => item.title),
    );
    expect(titles).toEqual(expect.arrayContaining(['Quick start', 'Accordion', 'Button']));
    expect(api.results).toEqual(api.defaultResults);
  });

  it('ranks the page a query names first, with its URL', async () => {
    const api = mountSearch();
    await waitFor(() => {
      expect(api.isReady).toBe(true);
    });
    await api.search('accordion');
    const [first] = api.results.results[0].items;
    expect(first.title).toBe('Accordion');
    expect(api.buildResultUrl(first)).toMatch(/\/components\/accordion$/);
  });

  it('goes back to the default results for an empty query', async () => {
    const api = mountSearch();
    await waitFor(() => {
      expect(api.isReady).toBe(true);
    });
    await api.search('button');
    await api.search('  ');
    expect(api.results).toEqual(api.defaultResults);
  });
});
