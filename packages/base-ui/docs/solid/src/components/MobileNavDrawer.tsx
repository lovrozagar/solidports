import { captureRef, createLayoutEffect, element, reactStyle } from 'docs/src/adapters/react';
import { createEffect, createMemo, createSignal, omit } from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Drawer } from '@solidports/base-ui/drawer';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import type { SearchResult, Sitemap } from '@mui/internal-docs-infra/useSearch/types';
import { MagnifyingGlassIcon } from 'docs/src/icons/MagnifyingGlassIcon';
import { MobileNavContent } from './MobileNavContent';
import { handleModifiedEnterNavigation, searchResultToString } from './Search/searchUtils';
import { loadSearchSitemap } from './Search/searchSitemap';
import type { SearchSitemapLoader } from './Search/searchSitemap';
import { SearchResultsList } from './Search/SearchResultsList';
import { useDeferredSearchSitemap } from './Search/useDeferredSearchSitemap';
import { useDeferredEmptySearchResults } from './Search/useDeferredEmptySearchResults';
import { useDocsSearch } from './Search/useDocsSearch';
import { useSearchTracking } from './Search/useSearchTracking';

const searchResultClasses = {
  group: 'MobileNavSection',
  groupLabel: 'MobileNavHeading',
  item: 'MobileNavSearchOption',
  breadcrumbText: 'MobileNavSearchBreadcrumbText',
  breadcrumbPart: 'MobileNavSearchBreadcrumbPart',
  separator: 'MobileNavSearchBreadcrumbSeparator',
  score: 'MobileNavSearchScore',
};
interface MobileNavDrawerProps extends Omit<Drawer.Root.Props, 'children' | 'handle'> {
  focusSearchOnOpen: boolean;
  handle: Drawer.Handle<unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sitemap?: SearchSitemapLoader;
  triggerId: string | null;
}
export function MobileNavDrawer(props: MobileNavDrawerProps) {
  const rest = omit(
    props,
    'focusSearchOnOpen',
    'handle',
    'onOpenChangeComplete',
    'open',
    'onOpenChange',
    'sitemap',
    'triggerId',
  );
  const searchTracking = useSearchTracking(() => ({
    open: props.open,
  }));
  const onOpenChangeCompleteRef: {
    current: ((open: boolean) => void) | null;
  } = {
    current: null,
  };
  const handleOpenChangeComplete = (nextOpen: boolean) => {
    onOpenChangeCompleteRef.current?.(nextOpen);
  };
  return (
    <Drawer.Root
      swipeDirection="down"
      {...rest}
      handle={props.handle}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
      triggerId={props.triggerId}
    >
      <MobileNavDrawerContent
        focusSearchOnOpen={props.focusSearchOnOpen}
        onOpenChange={props.onOpenChange}
        onOpenChangeComplete={props.onOpenChangeComplete}
        onOpenChangeCompleteRef={onOpenChangeCompleteRef}
        open={props.open}
        searchTracking={searchTracking()}
        sitemap={props.sitemap}
      />
    </Drawer.Root>
  );
}
interface MobileNavDrawerContentProps {
  focusSearchOnOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: Extract<
    Drawer.Root.Props['onOpenChangeComplete'],
    ((...args: never) => unknown) | null | undefined
  >;
  onOpenChangeCompleteRef: {
    current: ((open: boolean) => void) | null;
  };
  open: boolean;
  searchTracking: ReturnType<ReturnType<typeof useSearchTracking>>;
  sitemap: SearchSitemapLoader | undefined;
}
function MobileNavDrawerContent(props: MobileNavDrawerContentProps) {
  const [searchValue, setSearchValue] = createSignal('');
  const [searchIndexActive, setSearchIndexActive] = createSignal(false);
  const [navSitemap, setNavSitemap] = createSignal<Sitemap | null>(null);
  const popupRef: {
    current: HTMLDivElement | null;
  } = {
    current: null,
  };
  const inputRef: {
    current: HTMLInputElement | null;
  } = {
    current: null,
  };

  // These hooks live outside MobileNavPopupImpl so the search index survives
  // the popup unmounting when the drawer closes. Activate the deferred loader
  // after opening completes so indexing doesn't land on the first keystroke or
  // during the drawer transition.
  const sitemapImport = createMemo(() => props.sitemap ?? loadSearchSitemap);
  const searchSitemap = useDeferredSearchSitemap(searchIndexActive, sitemapImport);
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
  const searchResults = useDeferredEmptySearchResults(() => ({
    active:
      _useDocsSearch2().hasQuery && _useDocsSearch2().isReady && !_useDocsSearch2().isSearchPending,
    defaultResults: _useDocsSearch2().defaultResults,
    onResultCountChange: props.searchTracking.setResultCount,
    results: _useDocsSearch2().results,
  }));
  createEffect(
    () => [sitemapImport()],
    () => {
      let ignore = false;
      void sitemapImport()().then(
        ({ sitemap: nextSitemap }) => {
          if (!ignore) {
            setNavSitemap(nextSitemap ?? null);
          }
        },
        () => {
          if (!ignore) {
            setNavSitemap(null);
          }
        },
      );
      return () => {
        ignore = true;
      };
    },
  );
  const handleOpenChangeComplete = (nextOpen: boolean) => {
    setSearchIndexActive(nextOpen);
    if (!nextOpen) {
      setSearchValue('');
      // The search state survives closing, so reset the results once the
      // drawer is hidden. Otherwise the closing animation would swap back to
      // the nav tree and reopening could show the previous query's results.
      void _useDocsSearch2().performSearch('');
    }
    props.onOpenChangeComplete?.(nextOpen);
  };
  createEffect(
    () => [handleOpenChangeComplete, props.onOpenChangeCompleteRef],
    () => {
      props.onOpenChangeCompleteRef.current = handleOpenChangeComplete;
      return () => {
        if (props.onOpenChangeCompleteRef.current === handleOpenChangeComplete) {
          props.onOpenChangeCompleteRef.current = null;
        }
      };
    },
  );
  const handleClose = () => {
    props.onOpenChange(false);
  };

  // `initialFocus` only runs when the drawer opens, so handle the shortcut
  // being pressed while the drawer is already open.
  createEffect(
    () => [props.focusSearchOnOpen, props.open],
    () => {
      if (props.open && props.focusSearchOnOpen) {
        inputRef.current?.focus();
      }
    },
  );
  return (
    <Drawer.VirtualKeyboardProvider>
      <Drawer.Portal>
        <Drawer.Backdrop class="MobileNavBackdrop" />
        <Drawer.Viewport class="MobileNavViewport">
          <Drawer.Popup
            ref={(element) => {
              popupRef.current = element;
            }}
            class="MobileNavPopup"
            initialFocus={() => (props.focusSearchOnOpen ? inputRef.current : popupRef.current)}
          >
            <Drawer.Title class="bui-sr-only">Docs navigation</Drawer.Title>
            <MobileNavPopupImpl
              buildResultUrl={_useDocsSearch2().buildResultUrl}
              hasQuery={_useDocsSearch2().hasQuery}
              inputRef={inputRef}
              isReady={_useDocsSearch2().isReady}
              isSearchPending={_useDocsSearch2().isSearchPending}
              navSitemap={navSitemap()}
              onClose={handleClose}
              performSearch={_useDocsSearch2().performSearch}
              searchResults={searchResults()}
              searchValue={searchValue()}
              onResultSelect={props.searchTracking.setSelectedResult}
              onSearchValueChange={props.searchTracking.handleSearchValueChange}
              setSearchValue={setSearchValue}
            />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.VirtualKeyboardProvider>
  );
}
interface MobileNavPopupImplProps {
  buildResultUrl: (result: SearchResult) => string;
  hasQuery: boolean;
  inputRef: {
    current: HTMLInputElement | null;
  };
  isReady: boolean;
  isSearchPending: boolean;
  navSitemap: Sitemap | null;
  onClose: () => void;
  performSearch: (value: string) => Promise<void>;
  searchResults: ReturnType<ReturnType<typeof useDocsSearch>>['results'];
  searchValue: string;
  onResultSelect: (result: SearchResult | null) => void;
  onSearchValueChange: (value: string) => void;
  setSearchValue: (value: string) => void;
}
function MobileNavPopupImpl(props: MobileNavPopupImplProps) {
  const highlightedResultRef: {
    current: SearchResult | undefined;
  } = {
    current: undefined,
  };
  const scrollAreaViewportRef: {
    current: HTMLDivElement | null;
  } = {
    current: null,
  };
  const hadQueryRef = {
    current: false,
  };
  createLayoutEffect(
    () => [props.hasQuery],
    () => {
      if (hadQueryRef.current !== props.hasQuery) {
        scrollAreaViewportRef.current?.scrollTo({
          top: 0,
          left: 0,
        });
      }
      if (!props.hasQuery) {
        highlightedResultRef.current = undefined;
      }
      hadQueryRef.current = props.hasQuery;
    },
  );
  const handleValueChange = async (value: string) => {
    props.onSearchValueChange(value);
    props.setSearchValue(value);
    await props.performSearch(value);
  };
  const handleItemHighlighted = (item: SearchResult | undefined) => {
    highlightedResultRef.current = item;
  };
  const handleResultNavigate = (result: SearchResult) => {
    props.onResultSelect(result);
    props.onClose();
  };
  const handleAutocompleteOpenChange = (
    open: boolean,
    eventDetails: Autocomplete.Root.ChangeEventDetails,
  ) => {
    if (open || eventDetails.reason !== 'escape-key') {
      return;
    }
    if (props.hasQuery) {
      void handleValueChange('');
    } else {
      props.onClose();
    }
  };
  const handleKeyDownCapture = (
    event: KeyboardEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    // Pressing Escape during IME composition only cancels the composition;
    // it must not clear the committed query. `keyCode === 229` covers
    // Safari, where `isComposing` is unreliable.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === 'Escape' && props.hasQuery) {
      event.preventDefault();
      event.stopPropagation();
      void handleValueChange('');
      return;
    }
    handleModifiedEnterNavigation(event, highlightedResultRef.current, props.buildResultUrl);
  };
  const _render = createMemo(() => {
    let mobileNavContent: JSX.Element = null;
    if (props.hasQuery) {
      let mobileSearchResultsContent: JSX.Element = null;
      if (!props.isSearchPending) {
        mobileSearchResultsContent =
          props.searchResults.results.length === 0 && props.isReady
            ? element(() => (
                <Autocomplete.Status class="MobileNavEmptyState">
                  No results found.
                </Autocomplete.Status>
              ))
            : element(() => (
                <SearchResultsList
                  buildResultUrl={props.buildResultUrl}
                  class="MobileNavSearchList"
                  classes={searchResultClasses}
                  onResultNavigate={handleResultNavigate}
                  separatorVariant="stroked"
                />
              ));
      }
      mobileNavContent = element(() => (
        <div class="MobileNavSearchResults">{mobileSearchResultsContent}</div>
      ));
    } else {
      mobileNavContent = element(() => (
        <nav aria-label="Docs navigation" class="MobileNavPanel">
          <MobileNavContent sitemap={props.navSitemap} />
        </nav>
      ));
    }
    return (
      <Autocomplete.Root
        items={props.isSearchPending ? [] : props.searchResults.results}
        value={props.searchValue}
        onValueChange={handleValueChange}
        onOpenChange={handleAutocompleteOpenChange}
        onItemHighlighted={handleItemHighlighted}
        open={props.hasQuery}
        inline
        itemToStringValue={searchResultToString}
        filter={null}
        autoHighlight={props.hasQuery}
      >
        <div class="MobileNavSearchHeader">
          <div class="MobileNavHandle" />
          <div class="MobileNavSearchInputRoot">
            <MagnifyingGlassIcon class="MobileNavSearchIcon" />
            <Autocomplete.Input
              id="mobile-docs-search-input"
              aria-label="Search"
              placeholder="Search"
              class="MobileNavSearchInput"
              ref={captureRef(props.inputRef, {
                keydown: handleKeyDownCapture,
              })}
            />
            {props.hasQuery && (
              <Autocomplete.Clear aria-label="Clear search" class="MobileNavClearSearch">
                <XIcon />
              </Autocomplete.Clear>
            )}
          </div>
        </div>
        <Drawer.Content class="MobileNavContent">
          <ScrollArea.Root class="MobileNavScrollAreaRoot">
            <ScrollArea.Viewport
              ref={(element) => {
                scrollAreaViewportRef.current = element;
              }}
              class="MobileNavScrollAreaViewport"
            >
              <ScrollArea.Content class="MobileNavScrollAreaContent">
                {mobileNavContent}
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar class="MobileNavScrollbar">
              <ScrollArea.Thumb class="MobileNavScrollbarThumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </Drawer.Content>
      </Autocomplete.Root>
    );
  });
  return <>{_render()}</>;
}
function XIcon(props: ReactProps<ComponentProps<'svg'>>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      {...props}
      style={reactStyle({
        display: 'block',
        ...props.style,
      })}
    >
      <path d="m2.5 2.5 11 11m-11 0 11-11" />
    </svg>
  );
}
