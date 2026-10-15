import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { getSearchResultCount } from './searchUtils';
import type { GroupedSearchResults } from './searchUtils';

interface UseDeferredEmptySearchResultsParameters<Results extends GroupedSearchResults> {
  active?: boolean;
  defaultResults: Results;
  onResultCountChange?: (resultCount: number) => void;
  // Lets closing surfaces reset their hidden result state after exit animations.
  resetDelay?: number;
  results: Results;
}
export function useDeferredEmptySearchResults<Results extends GroupedSearchResults>(
  _params: Accessor<UseDeferredEmptySearchResultsParameters<Results>>,
) {
  const _params2 = createMemo(() => {
    const {
      active = true,
      defaultResults,
      onResultCountChange,
      resetDelay = 0,
      results,
    } = _params();
    return {
      defaultResults,
      onResultCountChange,
      results,
      active,
      resetDelay,
    };
  });
  const emptyResultsTimeout = useTimeout();
  const [delayedResults, setDelayedResults] = createSignal<Results>(() =>
    untrack(() => initialState(_params2().defaultResults)),
  );
  createEffect(
    () => [
      _params2().active,
      _params2().defaultResults,
      emptyResultsTimeout(),
      _params2().onResultCountChange,
      _params2().resetDelay,
      _params2().results,
    ],
    () => {
      const _emptyResultsTimeout = emptyResultsTimeout();
      const _resetDelay = _params2().resetDelay;
      if (!_params2().active) {
        _emptyResultsTimeout.clear();
        if (_resetDelay > 0) {
          const _defaultResults = _params2().defaultResults;
          _emptyResultsTimeout.start(_resetDelay, () => {
            setDelayedResults(() => _defaultResults);
          });
          return _emptyResultsTimeout.clear;
        }
        setDelayedResults(() => _params2().defaultResults);
        return undefined;
      }
      _params2().onResultCountChange?.(getSearchResultCount(_params2().results));
      const _results = _params2().results;
      const _emptyResultsTimeout2 = emptyResultsTimeout();
      if (_results.results.length === 0) {
        // Avoid flashing "No results" while the user is still typing.
        _emptyResultsTimeout2.start(400, () => {
          setDelayedResults(() => _results);
        });
        return _emptyResultsTimeout2.clear;
      }
      emptyResultsTimeout().clear();
      setDelayedResults(() => _results);
      return undefined;
    },
  );
  return delayedResults;
}
