import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useItemRegistry } from '../../internals/useItemRegistry';
import {
  createLayoutEffect,
  live,
  provideContext,
  useRef,
  type ReactLikeRef,
} from '../../solid-helpers';
import { getFilter } from '../../internals/filter';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { createFilterDropdownStore } from '../store';
import {
  FilterDropdownItemContext,
  FilterDropdownRootContext,
  FilterDropdownValueContext,
  useFilterDropdownItemContext,
  type FilterDropdownFilter,
  type FilterDropdownItemContext as FilterDropdownItemContextValue,
  type FilterDropdownItemRegistration,
  type FilterDropdownRoot as FilterDropdownRootNamespace,
} from './FilterDropdownRootContext';

/**
 * Holds the filter query, matches it against the registered items, and publishes the result. The
 * host owns list navigation; this root moves the highlight through `setActiveIndex`.
 */
export function FilterDropdownRoot(props: FilterDropdownRoot.Props): JSX.Element {
  const open = () => props.open;
  const disabled = () => props.disabled ?? false;
  const openedByKeyboard = () => props.openedByKeyboard ?? false;
  const value = () => props.value;
  const query = () => props.query;
  const autoHighlight = () => props.autoHighlight ?? false;

  const parentItemContext = useFilterDropdownItemContext(true);

  const [renderedListId, setRenderedListId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [inputFocusVisible, setInputFocusVisible] = createSignal(untrack(openedByKeyboard), {
    ownedWrite: true,
  });
  const [keyboardModality, setKeyboardModality] = createSignal(untrack(openedByKeyboard), {
    ownedWrite: true,
  });

  // Both reset when the host reports a new opening modality.
  createLayoutEffect(openedByKeyboard, (keyboard) => {
    setInputFocusVisible(keyboard);
    setKeyboardModality(keyboard);
  });

  const registry = useItemRegistry<symbol, FilterDropdownItemRegistration>();

  const defaultId = useBaseUiId();
  const store = createFilterDropdownStore();

  // The count is published as items register, not with the next registry snapshot, so an empty
  // state mounting alongside the items never reads a stale zero.
  const registerItem = (id: symbol, item: FilterDropdownItemRegistration) => {
    const unregister = registry.registerItem(id, item);
    store.set('registeredItemCount', registry.liveItems.size);
    return () => {
      unregister();
      store.set('registeredItemCount', registry.liveItems.size);
    };
  };

  const fallbackFocusOwnerRef = useRef<HTMLElement | null>(null);
  let lastFilterQuery: string | null = null;

  const defaultMatchItem = createMemo(() => getFilter({ locale: props.locale }).contains);

  const focusOwnerRef = props.focusOwnerRef ?? fallbackFocusOwnerRef;
  const filterQuery = () => (query() ?? value()).trim();
  // An unused inline filter must not re-run auto-highlighting when the consumer re-renders.
  const matchItem = (): FilterDropdownFilter | null => {
    if (filterQuery() === '' || props.filter === null) {
      return null;
    }
    return props.filter ?? defaultMatchItem();
  };
  const autoHighlightEnabled = () => {
    const mode = autoHighlight();
    return open() && (mode === 'always' || (Boolean(mode) && filterQuery() !== ''));
  };
  const defaultListId = () => `${defaultId()}-list`;
  const listId = () => {
    const id = renderedListId() ?? defaultListId();
    return id || undefined;
  };
  const triggerId = () => props.triggerId || undefined;

  const handleValueChange = (
    nextValue: string,
    eventDetails: FilterDropdownRoot.ChangeEventDetails,
  ) => {
    // A callback, which an effect can call (the close reset): read the prop untracked.
    untrack(() => props.onValueChange)?.(nextValue, eventDetails);
    // Indexes are positional, so a kept highlight would land on whatever fills its slot.
    // With `autoHighlight`, the filtering effect below places the highlight instead.
    if (!eventDetails.isCanceled && !untrack(autoHighlight)) {
      props.setActiveIndex(null);
    }
  };

  const handleItemsChange = (previousItems: readonly (HTMLElement | null)[]) => {
    const items = props.listRef.current;
    const activeIndex = props.getActiveIndex();

    // A positional highlight must not silently move to another item. A change that leaves the
    // highlighted item in place keeps it. A query change already reset the highlight.
    if (
      activeIndex != null &&
      items[activeIndex] != null &&
      items[activeIndex] === previousItems[activeIndex]
    ) {
      return;
    }

    props.setActiveIndex(untrack(autoHighlightEnabled) && items.length > 0 ? 0 : null);
  };

  // Re-runs on the registry snapshot published once every item in the flush has registered,
  // and on the committed query, because a controlled consumer can reject a proposed change.
  createLayoutEffect(
    () => ({
      open: open(),
      queryDefined: query() !== undefined,
      filterQuery: filterQuery(),
      registered: registry.items,
      match: matchItem(),
      auto: autoHighlightEnabled(),
    }),
    (deps) => {
      if (!deps.open && !deps.queryDefined) {
        return;
      }

      const queryChanged = lastFilterQuery !== null && lastFilterQuery !== deps.filterQuery;
      lastFilterQuery = deps.filterQuery;

      // With no query or external filtering, every registered item is visible.
      if (deps.match === null) {
        store.set('visibleItemIds', null);
        if (deps.auto && registry.liveItems.size > 0) {
          if (queryChanged || props.getActiveIndex() == null) {
            props.setActiveIndex(0);
          }
        } else if (deps.filterQuery === '' && queryChanged) {
          props.setActiveIndex(null);
        }
        return;
      }

      const currentIds = store.state.visibleItemIds;
      // The popup's content mounts a flush after the root opens. Publishing an empty result before
      // anything registered would hide every item as it arrives and remount the matches.
      if (currentIds === null && registry.liveItems.size === 0) {
        return;
      }

      const nextIds = new Set<symbol>();
      let hasNewMatch = currentIds === null;
      registry.liveItems.forEach(({ getText }, id) => {
        const text = getText();
        if (text != null && deps.match?.(text, deps.filterQuery)) {
          nextIds.add(id);
          hasNewMatch ||= !currentIds?.has(id);
        }
      });

      if (hasNewMatch || currentIds?.size !== nextIds.size) {
        if (deps.auto && nextIds.size > 0) {
          props.setActiveIndex(0);
        } else if (currentIds !== null || queryChanged) {
          props.setActiveIndex(null);
        }
        store.set('visibleItemIds', nextIds);
      } else if (deps.auto && queryChanged && nextIds.size > 0) {
        props.setActiveIndex(0);
      }
    },
  );

  const readOpen = live(open);
  const readDisabled = live(disabled);
  const readInputFocusVisible = live(inputFocusVisible);
  const readKeyboardModality = live(keyboardModality);
  const readAutoHighlight = live(autoHighlight);
  const readTriggerId = live(triggerId);
  const readDefaultListId = live(defaultListId);
  const readListId = live(listId);
  const readValue = live(() => query() ?? value());

  const rootContext: FilterDropdownRootContext = {
    open: readOpen,
    disabled: readDisabled,
    inputFocusVisible: readInputFocusVisible,
    setInputFocusVisible,
    keyboardModality: readKeyboardModality,
    setKeyboardModality,
    autoHighlight: readAutoHighlight,
    triggerId: readTriggerId,
    defaultListId: readDefaultListId,
    listId: readListId,
    setRenderedListId,
    focusOwnerRef,
    setActiveIndex: (index) => props.setActiveIndex(index),
    onItemsChange: handleItemsChange,
    onValueChange: handleValueChange,
  };

  const itemContext: FilterDropdownItemContextValue = {
    parent: parentItemContext,
    store,
    registerItem,
    listRef: props.listRef,
  };

  return provideContext(FilterDropdownItemContext, itemContext, () =>
    provideContext(FilterDropdownRootContext, rootContext, () =>
      provideContext(FilterDropdownValueContext, readValue, () => props.children),
    ),
  );
}

export interface FilterDropdownRootProps {
  children?: JSX.Element;
  /** Whether the popup is currently open. */
  open: boolean;
  /** Whether the filter controls should be disabled. */
  disabled?: boolean | undefined;
  /** Whether the popup opened from the keyboard, so the input starts with its focus ring. */
  openedByKeyboard?: boolean | undefined;
  /** Locale used for filtering comparisons. */
  locale?: Intl.LocalesArgument | undefined;
  /** The filter input value. */
  value: string;
  /** Query used for filtering when it differs from the input value, such as while closing. */
  query?: string | undefined;
  /** Event handler called when the filter input value changes. */
  onValueChange?:
    | ((value: string, eventDetails: FilterDropdownRootNamespace.ChangeEventDetails) => void)
    | undefined;
  /** Custom filter logic used when filtering items. Pass `null` to turn filtering off. */
  filter?: FilterDropdownFilter | null | undefined;
  /** Whether the first matching item should be highlighted automatically. */
  autoHighlight?: boolean | 'always' | undefined;
  /** ID of a trigger rendered outside this root, which cannot register itself through the context. */
  triggerId?: string | null | undefined;
  /** The host's DOM-ordered list of item elements. */
  listRef: ReactLikeRef<Array<HTMLElement | null>>;
  /** Reads the host's highlighted index. */
  getActiveIndex: () => number | null;
  /** Moves the host's highlight. */
  setActiveIndex: (index: number | null) => void;
  /** The host's ref for the input, which holds real focus while the list is navigated virtually. */
  focusOwnerRef?: ReactLikeRef<HTMLElement | null> | undefined;
}

export namespace FilterDropdownRoot {
  export type Props = FilterDropdownRootProps;
  export type ChangeEventReason = FilterDropdownRootNamespace.ChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootNamespace.ChangeEventDetails;
}
