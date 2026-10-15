import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import { useSearch } from '@mui/internal-docs-infra/useSearch';
import type { SearchSitemapLoader } from './searchSitemap';
import { slugifyWithParentContext } from './searchUtils';

const showPrivatePages = process.env.SHOW_PRIVATE_PAGES === 'true';
const SEARCH_OPTIONS = {
  groupBy: {
    properties: ['group'],
    maxResult: 5,
  },
};
export function useDocsSearch(
  sitemap: Accessor<SearchSitemapLoader>,
  searchValue: Accessor<string>,
): Accessor<
  ReturnType<ReturnType<typeof useSearch>> & {
    hasQuery: boolean;
    isSearchPending: boolean;
    performSearch: (value: string) => Promise<void>;
  }
> {
  const searchApi = useSearch(() => ({
    sitemap: sitemap(),
    generateSlug: slugifyWithParentContext,
    tolerance: 0,
    limit: 20,
    enableStemming: true,
    includeCategoryInGroup: true,
    excludeSections: true,
    showPrivatePages,
  }));
  const _searchApi = createMemo(() => {
    const { isReady, results, search } = searchApi();
    return {
      isReady,
      results,
      search,
    };
  });
  const [acceptedResults, setAcceptedResults] = createSignal(() =>
    untrack(() => initialState(_searchApi().results)),
  );
  const [completedSearchId, setCompletedSearchId] = createSignal(0);
  const lastReadySearchValueRef = {
    current: '',
  };
  const latestSearchIdRef = {
    current: 0,
  };
  const hasQuery = createMemo(() => searchValue().trim() !== '');
  createEffect(
    () => [completedSearchId(), _searchApi().results],
    () => {
      if (completedSearchId() === latestSearchIdRef.current) {
        setAcceptedResults(_searchApi().results);
      }
    },
  );
  const performSearch = async (value: string) => {
    const searchId = latestSearchIdRef.current + 1;
    latestSearchIdRef.current = searchId;
    lastReadySearchValueRef.current = _searchApi().isReady && value.trim() ? value : '';
    await _searchApi().search(value, SEARCH_OPTIONS);
    setCompletedSearchId(searchId);
  };

  // The search index is built lazily, so a query typed before it is ready runs
  // against nothing. Replay the latest query once the index becomes ready.
  createEffect(
    () => [hasQuery(), _searchApi().isReady, performSearch, searchValue()],
    () => {
      if (!hasQuery()) {
        lastReadySearchValueRef.current = '';
        return;
      }
      const _searchValue = searchValue();
      if (!_searchApi().isReady || lastReadySearchValueRef.current === _searchValue) {
        return;
      }
      lastReadySearchValueRef.current = _searchValue;
      void performSearch(_searchValue);
    },
  );
  // A query typed before the lazy index is ready is still pending: results have
  // collapsed to the defaults, so treat not-ready-yet the same as in-flight to
  // avoid rendering the default list under a real query.
  const isSearchPending = createMemo(
    () =>
      hasQuery() && (!_searchApi().isReady || completedSearchId() !== latestSearchIdRef.current),
  );
  return createMemo(() => ({
    ...searchApi(),
    results: acceptedResults(),
    hasQuery: hasQuery(),
    isSearchPending: isSearchPending(),
    performSearch,
  }));
}
