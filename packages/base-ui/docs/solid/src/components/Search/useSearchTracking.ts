import { createEffect, createMemo, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useTimeout } from '@base-ui/utils/useTimeout';
import type { SearchResult } from '@mui/internal-docs-infra/useSearch/types';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';

interface UseSearchTrackingOptions {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}
export function useSearchTracking(_params?: Accessor<UseSearchTrackingOptions | undefined>) {
  const _value = createMemo(() => {
    const _params2 = _params?.();
    const { open, onOpen, onClose } = _params2 === undefined ? {} : _params2;
    return {
      open,
      onOpen,
      onClose,
    };
  });
  const ga = useGoogleAnalytics();
  const searchQueryRef = {
    current: '',
  };
  const resultCountRef = {
    current: 0,
  };
  const attemptRef = {
    current: 0,
  };
  const selectedResultRef: {
    current: SearchResult | null;
  } = {
    current: null,
  };
  const lastTrackedQueryRef = {
    current: '',
  };
  const wasOpenRef = {
    current: untrack(_value).open ?? false,
  };
  const queryDebounceTimeout = useTimeout();
  const handleOpen = () => {
    searchQueryRef.current = '';
    resultCountRef.current = 0;
    attemptRef.current = 0;
    selectedResultRef.current = null;
    lastTrackedQueryRef.current = '';
    queryDebounceTimeout().clear();
    ga()?.trackEvent({
      category: 'search',
      action: 'open',
    });
  };
  const handleClose = () => {
    queryDebounceTimeout().clear();
    if (searchQueryRef.current) {
      const selected = selectedResultRef.current;
      ga()?.trackEvent({
        category: 'search',
        action: selected ? 'select' : 'dismiss',
        label: searchQueryRef.current,
        params: {
          search_term: searchQueryRef.current,
          result_count: resultCountRef.current,
          attempt: attemptRef.current,
          ...(selected
            ? {
                selected_result: selected.title || selected.slug,
                selected_type: selected.type || '',
              }
            : {
                failed: searchQueryRef.current,
              }),
        },
      });
      lastTrackedQueryRef.current = searchQueryRef.current;
    }
  };
  const handleSearchValueChange = (value: string) => {
    queryDebounceTimeout().clear();
    const previousLength = searchQueryRef.current.length;
    searchQueryRef.current = value;
    if (!value) {
      return;
    }
    if (previousLength === 0) {
      attemptRef.current += 1;
    }
    queryDebounceTimeout().start(1500, () => {
      if (searchQueryRef.current && searchQueryRef.current !== lastTrackedQueryRef.current) {
        ga()?.trackEvent({
          category: 'search',
          action: 'query',
          label: searchQueryRef.current,
          params: {
            search_term: searchQueryRef.current,
            result_count: resultCountRef.current,
            attempt: attemptRef.current,
          },
        });
        lastTrackedQueryRef.current = searchQueryRef.current;
      }
    });
  };
  const setResultCount = (resultCount: number) => {
    resultCountRef.current = resultCount;
  };
  const setSelectedResult = (result: SearchResult | null) => {
    selectedResultRef.current = result;
  };
  const handleTrackedOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      _value().onOpen?.();
      handleOpen();
    } else {
      handleClose();
      _value().onClose?.();
    }
  };
  createEffect(
    () => [handleTrackedOpenChange, _value().open],
    () => {
      const _open = _value().open;
      if (_open === undefined) {
        return;
      }
      if (_open !== wasOpenRef.current) {
        handleTrackedOpenChange(_open);
      }
      wasOpenRef.current = _open;
    },
  );
  return createMemo(() => ({
    handleSearchValueChange,
    setResultCount,
    setSelectedResult,
  }));
}
