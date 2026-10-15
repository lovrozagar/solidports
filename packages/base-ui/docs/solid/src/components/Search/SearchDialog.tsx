import { captureRef, element, place } from 'docs/src/adapters/react';
import { createEffect, createMemo, createSignal, merge } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { SearchResult } from '@mui/internal-docs-infra/useSearch/types';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Dialog } from '@solidports/base-ui/dialog';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { CornerDownLeft } from '@lucide/solid';
import { MagnifyingGlassIcon } from 'docs/src/icons/MagnifyingGlassIcon';
import { handleModifiedEnterNavigation, searchResultToString } from './searchUtils';
import { loadSearchSitemap } from './searchSitemap';
import type { SearchSitemapLoader } from './searchSitemap';
import { SearchResultsList } from './SearchResultsList';
import { useDeferredSearchSitemap } from './useDeferredSearchSitemap';
import { useDeferredEmptySearchResults } from './useDeferredEmptySearchResults';
import { useDocsSearch } from './useDocsSearch';
import { useSearchTracking } from './useSearchTracking';
import './Search.css';

const searchResultClasses = {
  group: 'SearchGroup',
  groupLabel: 'SearchGroupLabel',
  item: 'SearchOptionItem',
  breadcrumbPart: 'SearchBreadcrumbPart',
  breadcrumbPartLast: 'last',
  separator: 'SearchBreadcrumbSeparator',
  score: 'SearchScore',
};
export interface SearchDialogProps {
  handle: Dialog.Handle<unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sitemap?: SearchSitemapLoader;
  triggerId: string | null;
}
export function SearchDialog(_props: SearchDialogProps) {
  const props = merge(
    {
      sitemap: loadSearchSitemap,
    },
    _props,
  );
  const [searchValue, setSearchValue] = createSignal('');
  const [searchIndexActive, setSearchIndexActive] = createSignal(false);
  const inputRef: {
    current: HTMLInputElement | null;
  } = {
    current: null,
  };
  const indexWarmupTimeout = useTimeout();

  // Build the search index shortly after mount so the default results are ready
  // before the first open, instead of popping in once the open transition
  // completes. The delay keeps the index build from competing with hydration.
  createEffect(
    () => [indexWarmupTimeout()],
    () => {
      indexWarmupTimeout().start(250, () => {
        setSearchIndexActive(true);
      });
      return indexWarmupTimeout().clear;
    },
  );
  const searchSitemap = useDeferredSearchSitemap(searchIndexActive, () => props.sitemap);
  const _useDocsSearch = useDocsSearch(searchSitemap, searchValue);
  const _useDocsSearch2 = createMemo(() => {
    const {
      results,
      defaultResults,
      buildResultUrl,
      hasQuery,
      isReady,
      isSearchPending,
      performSearch,
    } = _useDocsSearch();
    return {
      results,
      defaultResults,
      buildResultUrl,
      hasQuery,
      isReady,
      isSearchPending,
      performSearch,
    };
  });
  const searchTracking = useSearchTracking(() => ({
    open: props.open,
    onOpen: () => {
      setSearchValue('');
    },
    onClose: () => {
      setSearchValue('');
      // The dialog stays mounted after closing, so reset the results while it's
      // hidden. Otherwise reopening would show the previous query's results.
      void _useDocsSearch2().performSearch('');
    },
  }));
  const searchResults = useDeferredEmptySearchResults(() => ({
    active: props.open && _useDocsSearch2().isReady && !_useDocsSearch2().isSearchPending,
    defaultResults: _useDocsSearch2().defaultResults,
    onResultCountChange: searchTracking().setResultCount,
    resetDelay: 200,
    results: _useDocsSearch2().results,
  }));
  const handleOpenChangeComplete = (nextOpen: boolean) => {
    // Fallback in case the dialog is opened before the warmup timeout fires.
    // Never deactivate: the built index persists and must stay ready for reopens.
    if (nextOpen) {
      setSearchIndexActive(true);
    }
  };
  const handleAutocompleteEscape = (
    open: boolean,
    eventDetails: Autocomplete.Root.ChangeEventDetails,
  ) => {
    if (!open && eventDetails.reason === 'escape-key') {
      props.onOpenChange(false);
    }
  };
  const handleValueChange = async (value: string) => {
    setSearchValue(value);
    searchTracking().handleSearchValueChange(value);
    await _useDocsSearch2().performSearch(value);
  };
  const highlightedResultRef: {
    current: SearchResult | undefined;
  } = {
    current: undefined,
  };
  const handleItemClick = () => {
    searchTracking().setSelectedResult(highlightedResultRef.current ?? null);
    props.onOpenChange(false);
  };
  const handleItemHighlighted = (item: SearchResult | undefined) => {
    highlightedResultRef.current = item;
  };
  const handleKeyDownCapture = (
    event: KeyboardEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    handleModifiedEnterNavigation(
      event,
      highlightedResultRef.current,
      _useDocsSearch2().buildResultUrl,
    );
  };
  const searchInput = element(() => (
    <div class="SearchInputRoot">
      <MagnifyingGlassIcon class="SearchInputIcon" />
      <Autocomplete.Input
        id="search-input"
        aria-label="Search"
        placeholder="Search"
        class="SearchInput"
        ref={captureRef(inputRef, {
          keydown: handleKeyDownCapture,
        })}
      />
    </div>
  ));
  const _render = createMemo(() => {
    let searchResultsContent: JSX.Element = null;
    const _searchResults = searchResults();
    const _isSearchPending = _useDocsSearch2().isSearchPending;
    if (
      _searchResults.results.length === 0 &&
      _useDocsSearch2().hasQuery &&
      _useDocsSearch2().isReady &&
      !_isSearchPending
    ) {
      searchResultsContent = element(() => (
        <Autocomplete.Status class="SearchEmptyState">No results found.</Autocomplete.Status>
      ));
    } else if (_searchResults.results.length > 0 && !_isSearchPending) {
      searchResultsContent = element(() => (
        <SearchResultsList
          buildResultUrl={_useDocsSearch2().buildResultUrl}
          class="SearchList"
          classes={searchResultClasses}
          onResultNavigate={handleItemClick}
          separatorVariant="filled"
        />
      ));
    }
    return (
      <Dialog.Root
        handle={props.handle}
        open={props.open}
        onOpenChange={props.onOpenChange}
        onOpenChangeComplete={handleOpenChangeComplete}
        triggerId={props.triggerId}
      >
        <Dialog.Portal>
          <Dialog.Backdrop class="SearchBackdrop" />
          <Dialog.Viewport class="SearchViewport">
            <Dialog.Popup initialFocus={inputRef} class="SearchPopup">
              <Dialog.Title class="bui-sr-only">Search documentation</Dialog.Title>
              <Autocomplete.Root
                items={_useDocsSearch2().isSearchPending ? [] : searchResults().results}
                onValueChange={handleValueChange}
                onOpenChange={handleAutocompleteEscape}
                onItemHighlighted={handleItemHighlighted}
                open
                inline
                itemToStringValue={searchResultToString}
                filter={null}
                autoHighlight="always"
                keepHighlight
              >
                <div class="SearchHead">{place(searchInput)}</div>
                <div class="SearchBody">
                  <ScrollArea.Root class="SearchScrollAreaRoot">
                    <ScrollArea.Viewport class="SearchScrollAreaViewport">
                      <ScrollArea.Content
                        style={{
                          'min-width': '100%',
                        }}
                      >
                        {searchResultsContent}
                      </ScrollArea.Content>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar class="SearchScrollbar">
                      <ScrollArea.Thumb class="SearchScrollbarThumb" />
                    </ScrollArea.Scrollbar>
                  </ScrollArea.Root>
                </div>
                <div class="SearchFooter">
                  <div class="SearchFooterHint">
                    <kbd aria-label="Enter" class="SearchFooterEnter">
                      <CornerDownLeft size={12} />
                    </kbd>
                    <span>Go to page</span>
                  </div>
                </div>
              </Autocomplete.Root>
              <Dialog.Close class="SearchClose">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    );
  });
  return <>{_render()}</>;
}
