/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable typescript/no-explicit-any -- generic Value defaults to `any` to mirror upstream React combobox API; tightening to `unknown` breaks consumer ergonomics for unspecified-Value usage */
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useField } from '../../field/useField';
import {
  ElementProps,
  getOverflowAncestors,
  useClick,
  useDismiss,
  useFloatingRootContext,
  useInteractions,
  useListNavigation,
} from '../../floating-ui-solid';
import { contains, getTarget } from '../../floating-ui-solid/utils';
import { gridNavigation } from '../../floating-ui-solid/hooks/gridNavigation';
import { useFormContext } from '../../form/FormContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { mergeProps } from '../../merge-props';
import { type ReactLikeRef, useRef } from '../../solid-helpers';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../utils/constants';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  type BaseUIChangeEventDetails,
  type BaseUIGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  findSelectionIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../../utils/itemEquality';
import { NOOP } from '../../utils/noop';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import {
  flattenLeafItems,
  Group,
  isGroupedItems,
  stringifyAsLabel,
  stringifyAsValue,
} from '../../utils/resolveValueLabel';
import { isScrollableY } from '../../utils/scrollable';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import type { BaseUIEvent, HTMLProps } from '../../utils/types';
import { useControlled } from '../../utils/useControlled';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useOpenInteractionType } from '../../utils/useOpenInteractionType';
import { useTransitionStatus } from '../../utils/useTransitionStatus';
import { useValueChanged } from '../../internals/useValueChanged';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { selectors, type ComboboxStoreContext, type State as StoreState } from '../store';
import {
  findCollectionItem,
  type ComboboxItemCollection,
  type ItemCollection,
} from '../items/itemCollection';
import {
  ComboboxDerivedItemsContext,
  ComboboxFloatingContext,
  ComboboxHasItemsContext,
  ComboboxInputValueContext,
  ComboboxRootContext,
} from './ComboboxRootContext';
import { createCollatorItemFilter, type FilterItemToString } from './utils';
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from './utils/constants';
import { useCoreFilter } from './utils/useFilter';
import { on } from '../../solid-1-compat';

type InternalAriaComboboxProps<Value, Mode extends SelectionMode, Item = Value> = AriaComboboxProps<
  Value,
  Mode,
  Item
> & {
  filterQuery?: string | undefined;
};

/**
 * @internal
 *
 * Single signature instead of overloads — vite-plugin-solid's oxc TS stripper
 * rejects function overload syntax with "Identifier already declared".
 */
export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', Item = Value>(
  props: InternalAriaComboboxProps<Value, Mode, Item>,
): JSX.Element {
  const idProp = () => props.id;
  const defaultSelectedValue = () => props.defaultSelectedValue ?? null;
  const selectedValueProp = () => props.selectedValue;
  const inputValueProp = () => props.inputValue;
  const defaultInputValue = () => props.defaultInputValue;
  const selectionMode = () => props.selectionMode ?? 'none';
  const nameProp = () => props.name;
  const form = () => props.form;
  const disabledProp = () => props.disabled ?? false;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const grid = () => props.grid ?? false;
  const filteredItemsProp = () => props.filteredItems;
  const openOnInputClick = () => props.openOnInputClick ?? true;
  const autoHighlight = () => props.autoHighlight ?? false;
  const keepHighlight = () => props.keepHighlight ?? false;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const loopFocus = () => props.loopFocus ?? true;
  const isItemEqualToValue = (): ((itemValue: any, selectedValue: any) => boolean) =>
    props.isItemEqualToValue ?? defaultItemEquality;
  const virtualized = () => props.virtualized ?? false;
  const inlineProp = () => props.inline ?? false;
  const fillInputOnItemPress = () => props.fillInputOnItemPress ?? true;
  const modal = () => props.modal ?? false;
  const limit = () => props.limit ?? -1;
  const autoComplete = () => props.autoComplete ?? 'list';
  const submitOnItemClick = () => props.submitOnItemClick ?? false;

  const { clearErrors } = useFormContext();
  const {
    setDirty,
    validityData,
    shouldValidateOnChange,
    setFilled,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
  } = useFieldRootContext();

  const direction = useDirection();
  const id = useLabelableId({ id: idProp });
  // React re-resolves the cached filter every render, so a new `locale` takes effect.
  const collatorFilter = createMemo(() => useCoreFilter({ locale: props.locale }));

  // Plain items are arrays; normalized `createItems()` collections are objects.
  const resolveCollection = (itemsProp: unknown) => {
    const resolved = Array.isArray(itemsProp)
      ? null
      : (itemsProp as unknown as ItemCollection<Item, Value> | undefined);

    if (resolved && typeof resolved.label !== 'function') {
      throw new Error(
        'Base UI: the `items` prop received an object that is not a collection, ' +
          'so its items cannot be read. Pass an array of items, an array of groups with items, ' +
          'or the result of `createItems()`. ' +
          'See https://base-ui.com/react/components/combobox#createitems',
      );
    }

    return resolved ?? null;
  };

  // Solid: React throws from render; validate once during setup so the error surfaces
  // synchronously instead of being captured by the memo below.
  untrack(() => resolveCollection(props.items));

  const collection = createMemo(() => resolveCollection(props.items));

  const items = createMemo(
    () =>
      (collection() ? collection()!.data : props.items) as
        readonly Item[] | readonly Group<Item>[] | undefined,
  );
  const itemToValue = () => collection()?.value;

  // A projected collection's items live in the source domain, not the selection-value domain the
  // store matches against, so they are withheld from the store.
  const storeItems = () => (itemToValue() ? undefined : items());

  // The externally filtered items projected to their selection values, with a lookup back to the
  // source items. Declared before `itemToStringLabel`, which resolves labels from it on the
  // first render (initial input value).
  const externalWindow = createMemo(() => {
    const filtered = filteredItemsProp();
    const toValue = itemToValue();
    if (!filtered || !toValue) {
      return undefined;
    }
    const flat = flattenLeafItems(filtered);
    const values = flat.map(toValue);
    let valueToItem: Map<any, any> | undefined;

    return {
      values,
      findItem(itemValue: any, isEqual: (item: any, value: any) => boolean) {
        if (!valueToItem) {
          valueToItem = new Map();
          for (let i = 0; i < values.length; i += 1) {
            if (!valueToItem.has(values[i])) {
              valueToItem.set(values[i], flat[i]);
            }
          }
        }

        return findCollectionItem(valueToItem, itemValue, isEqual);
      },
    };
  });

  // Labels selection values from current props only: collection data first, then the current
  // external window, then the prop. Nothing from a past window is remembered — keeping a value
  // resolvable over time means keeping its item in the collection's data.
  const itemToStringLabel = createMemo(() => {
    const col = collection();
    const itemToStringLabelProp = props.itemToStringLabel;
    if (!col) {
      return itemToStringLabelProp;
    }
    const isEqual = isItemEqualToValue();
    const window = externalWindow();
    return (itemValue: Value) => {
      return col.label(itemValue, isEqual, (unresolvedValue: any) => {
        const externalItem = window?.findItem(unresolvedValue, isEqual);
        if (externalItem != null) {
          return col.itemLabel(externalItem);
        }
        return stringifyAsLabel(unresolvedValue, itemToStringLabelProp);
      });
    };
  });

  const filterItemToString = createMemo<FilterItemToString | undefined>(() => {
    const col = collection();
    if (!col) {
      return props.itemToStringLabel;
    }

    const labelOf = itemToStringLabel();
    return Object.assign((item: any) => col.itemLabel(item), {
      selected: (value: any) => stringifyAsLabel(value, labelOf),
    });
  });

  function stringifyValueLabel(item: any) {
    return stringifyAsLabel(item, itemToStringLabel());
  }

  const [queryChangedAfterOpen, setQueryChangedAfterOpen] = createSignal(false);
  const [closeQuery, setCloseQuery] = createSignal<string | null>(null);
  const previousCloseQueryRef = useRef(untrack(closeQuery));

  const listRef = useRef<Array<HTMLElement | null | undefined>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  const popupRef = useRef<HTMLDivElement | null | undefined>(null);
  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  const startDismissRef = useRef<HTMLSpanElement | null | undefined>(null);
  const endDismissRef = useRef<HTMLSpanElement | null | undefined>(null);
  const emptyRef = useRef<HTMLDivElement | null | undefined>(null);
  const keyboardActiveRef = useRef(true);
  const hadInputClearRef = useRef(false);
  const chipsContainerRef = useRef<HTMLDivElement | null | undefined>(null);
  const clearRef = useRef<HTMLButtonElement | null | undefined>(null);
  const selectionEventRef = useRef<MouseEvent | PointerEvent | KeyboardEvent | null>(null);
  const lastHighlightRef = useRef(INITIAL_LAST_HIGHLIGHT);
  const pendingQueryHighlightRef = useRef<null | {
    hasQuery: boolean;
    selection?: boolean | undefined;
    // The value a selection-driven clear just added, so the restore can keep it
    // highlighted instead of returning to the open anchor.
    toggledValue?: any;
  }>(null);

  /**
   * Contains the currently visible list of item values post-filtering.
   */
  const valuesRef = useRef<any[]>([]);
  /**
   * The item element that received the last `pointerdown`, used to detect whether a
   * `mouseup` on an item belongs to a drag-select gesture that started elsewhere.
   */
  const pointerDownItemRef = useRef<Element | null>(null);

  const disabled = () => fieldDisabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();
  const multiple = () => selectionMode() === 'multiple';
  const single = () => selectionMode() === 'single';
  const hasInputValue = () => inputValueProp() !== undefined || defaultInputValue() !== undefined;
  const hasItems = () => items() !== undefined;
  const hasFilteredItemsProp = () => filteredItemsProp() !== undefined;

  const autoHighlightMode = createMemo<false | 'input-change' | 'always'>(() => {
    const autoHighlightValue = autoHighlight();
    if (autoHighlightValue === 'always') {
      return 'always';
    }
    return autoHighlightValue ? 'input-change' : false;
  });

  const [selectedValue, setSelectedValueUnwrapped] = useControlled<any>({
    controlled: selectedValueProp,
    default: () => (multiple() ? (defaultSelectedValue() ?? EMPTY_ARRAY) : defaultSelectedValue()),
    name: 'Combobox',
    state: 'selectedValue',
  });

  const filter = createMemo(() => {
    const filterProp = props.filter;
    if (filterProp === null) {
      return () => true;
    }
    if (filterProp !== undefined) {
      return filterProp;
    }
    // `shouldBypassFiltering` already empties the query whenever a single selection's label
    // matches it exactly, so the filter never needs a selection-aware variant here.
    return createCollatorItemFilter(collatorFilter(), filterItemToString());
  });

  // If neither inputValue nor defaultInputValue are provided, derive it from the
  // selected value for single mode so the input reflects the selection on mount.
  const initialDefaultInputValue = untrack(() => {
    if (hasInputValue()) {
      return defaultInputValue() ?? '';
    }
    if (single()) {
      return stringifyValueLabel(selectedValue());
    }
    return '';
  });

  const [inputValue, setInputValueUnwrapped] = useControlled({
    controlled: inputValueProp,
    default: initialDefaultInputValue,
    name: 'Combobox',
    state: 'inputValue',
  });

  const [open, setOpenUnwrapped] = useControlled({
    controlled: () => props.open,
    default: () => props.defaultOpen ?? false,
    name: 'Combobox',
    state: 'open',
  });

  const isGrouped = createMemo(() => isGroupedItems(items()));
  const query = createMemo(() => {
    const frozenQuery = closeQuery();
    return !open() && frozenQuery !== null ? frozenQuery : String(inputValue()).trim();
  });

  const selectedLabelString = createMemo(() =>
    single() ? stringifyValueLabel(selectedValue()) : '',
  );

  const shouldBypassFiltering = createMemo(
    () =>
      single() &&
      !queryChangedAfterOpen() &&
      query() !== '' &&
      selectedLabelString().length === query().length &&
      collatorFilter().contains(selectedLabelString(), query()),
  );

  const filterQuery = createMemo(() =>
    shouldBypassFiltering() ? '' : (props.filterQuery ?? query()),
  );
  const shouldIgnoreExternalFiltering = createMemo(() => {
    const col = collection();
    return (
      hasItems() &&
      hasFilteredItemsProp() &&
      shouldBypassFiltering() &&
      (!col || col.hasValue(selectedValue(), isItemEqualToValue()))
    );
  });

  const flatItems = createMemo<readonly Item[]>(() => {
    const resolvedItems = items();
    return resolvedItems ? flattenLeafItems<Item>(resolvedItems) : EMPTY_ARRAY;
  });

  const filteredItems = createMemo<Item[] | Group<Item>[]>(() => {
    const filteredItemsPropValue = filteredItemsProp();
    if (filteredItemsPropValue && !shouldIgnoreExternalFiltering()) {
      return filteredItemsPropValue as Item[] | Group<Item>[];
    }

    const resolvedItems = items();
    if (!resolvedItems) {
      return EMPTY_ARRAY as Item[];
    }

    const filterQueryValue = filterQuery();
    const filterFn = filter();
    const itemToString = filterItemToString();
    const limitValue = limit();

    if (isGrouped()) {
      const groupedItems = resolvedItems as readonly Group<Item>[];
      const resultingGroups: Group<Item>[] = [];
      let currentCount = 0;

      for (const group of groupedItems) {
        if (limitValue > -1 && currentCount >= limitValue) {
          break;
        }

        const remainingLimit = limitValue > -1 ? limitValue - currentCount : Infinity;
        const itemsToTake = filterQueryValue === '' ? group.items.slice(0, remainingLimit) : [];

        if (filterQueryValue !== '') {
          for (const item of group.items) {
            if (itemsToTake.length >= remainingLimit) {
              break;
            }
            if (filterFn(item, filterQueryValue, itemToString)) {
              itemsToTake.push(item);
            }
          }
        }

        if (itemsToTake.length > 0) {
          const newGroup = { ...group, items: itemsToTake };
          resultingGroups.push(newGroup);
          currentCount += itemsToTake.length;
        }
      }

      return resultingGroups;
    }

    const flatItemsValue = flatItems();
    if (filterQueryValue === '') {
      return limitValue > -1
        ? flatItemsValue.slice(0, limitValue)
        : // The cast here is done as `flatItems` is readonly.
          // valuesRef.current, a mutable ref, can be set to `flatFilteredValues`, which may
          // reference this exact readonly value, creating a mutation risk.
          // However, <Combobox.Item> can never mutate this value as the mutating effect
          // bails early when `items` is provided, and this is only ever returned
          // when `items` is provided due to the early return at the top of this hook.
          (flatItemsValue as Item[]);
    }

    const limitedItems: Item[] = [];
    for (const item of flatItemsValue) {
      if (limitValue > -1 && limitedItems.length >= limitValue) {
        break;
      }
      if (filterFn(item, filterQueryValue, itemToString)) {
        limitedItems.push(item);
      }
    }

    return limitedItems;
  });

  /**
   * The filtered items flattened across groups and projected to their selection values.
   */
  const flatFilteredValues = createMemo<any[]>(() => {
    const filtered = filteredItems();
    const window = externalWindow();
    if (window && filtered === filteredItemsProp()) {
      return window.values;
    }
    const flat = flattenLeafItems<Item>(filtered as readonly Item[] | readonly Group<Item>[]);
    const toValue = itemToValue();
    return toValue ? flat.map((item) => toValue(item)) : (flat as any[]);
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);
  const { openMethod, triggerProps } = useOpenInteractionType(open);

  // An inline list open on the first render never gets a closed pass of the closed-state
  // sync effect below, and `items`-prop lists don't self-register their index the way
  // individually rendered `<Combobox.Item>`s do, so the selected item was never highlighted.
  // Seeding the index here lets list navigation highlight and scroll to the selection on
  // mount. Computed once by construction, so a selection or list that resolves after mount
  // doesn't move an existing highlight or scroll the list away.
  const initialSelectedIndex = untrack(() => {
    if (inlineProp() && open() && hasItems() && selectionMode() !== 'none') {
      return findSelectionIndex(
        flatFilteredValues(),
        selectedValue(),
        isItemEqualToValue(),
        multiple(),
      );
    }
    return null;
  });

  // Solid: values React synchronizes into the store from a layout effect are live getters, so
  // the parts never observe a stale snapshot. Writes to getter keys are ignored by the store.
  const store = SolidStore<StoreState, ComboboxStoreContext, typeof selectors>(
    {
      get id() {
        return id();
      },
      labelId: undefined,
      get selectedValue() {
        return selectedValue();
      },
      get open() {
        return open();
      },
      get items() {
        return storeItems() as readonly any[] | undefined;
      },
      get selectionMode() {
        return selectionMode();
      },
      get name() {
        return name();
      },
      get form() {
        return form();
      },
      get disabled() {
        return disabled();
      },
      get readOnly() {
        return readOnly();
      },
      get required() {
        return required();
      },
      get grid() {
        return grid();
      },
      get virtualized() {
        return virtualized();
      },
      get openOnInputClick() {
        return openOnInputClick();
      },
      get itemToStringLabel() {
        return itemToStringLabel() as ((item: any) => string) | undefined;
      },
      get isItemEqualToValue() {
        return isItemEqualToValue();
      },
      get modal() {
        return modal();
      },
      get autoHighlight() {
        return autoHighlightMode();
      },
      get submitOnItemClick() {
        return submitOnItemClick();
      },
      get hasInputValue() {
        return hasInputValue();
      },
      get mounted() {
        return mounted();
      },
      forceMounted: false,
      get transitionStatus() {
        return transitionStatus();
      },
      get inline() {
        return inlineProp();
      },
      activeIndex: null,
      selectedIndex: initialSelectedIndex,
      popupProps: EMPTY_OBJECT as HTMLProps,
      listProps: EMPTY_OBJECT as HTMLProps,
      inputProps: EMPTY_OBJECT as HTMLProps,
      triggerProps: EMPTY_OBJECT as HTMLProps,
      itemProps: EMPTY_OBJECT as HTMLProps,
      positionerElement: null,
      listElement: null,
      listId: undefined,
      popupId: undefined,
      triggerElement: null,
      inputElement: null,
      inputGroupElement: null,
      popupSide: null,
      get openMethod() {
        return openMethod();
      },
      inputInsidePopup: true,
      // `ComboboxInput` writes `inputInsidePopup` from its ref; ownership is derived from it in
      // the same read, so subscribers never observe an intermediate snapshot.
      get inputOwnsFormValue(): boolean {
        return (
          selectionMode() === 'none' && (inlineProp() || !(this as StoreState).inputInsidePopup)
        );
      },
    },
    {
      // Placeholder callbacks replaced during setup
      onOpenChangeComplete: NOOP,
      setOpen: NOOP,
      setInputValue: NOOP,
      setSelectedValue: NOOP,
      setIndices: NOOP,
      handleSelection: NOOP,
      forceMount: NOOP,
      requestSubmit: NOOP,
      listRef,
      labelsRef,
      popupRef,
      emptyRef,
      inputRef,
      startDismissRef,
      endDismissRef,
      keyboardActiveRef,
      chipsContainerRef,
      clearRef,
      valuesRef,
      pointerDownItemRef,
      selectionEventRef,
    },
    selectors,
  );

  const fieldRawValue = createMemo(() =>
    selectionMode() === 'none' ? inputValue() : selectedValue(),
  );
  const fieldStringValue = createMemo(() => {
    if (selectionMode() === 'none') {
      return fieldRawValue();
    }
    const selectedValueResolved = selectedValue();
    if (Array.isArray(selectedValueResolved)) {
      return selectedValueResolved.map((value) => stringifyAsValue(value, props.itemToStringValue));
    }
    return stringifyAsValue(selectedValueResolved, props.itemToStringValue);
  });

  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const positionerElement = store.useState('positionerElement');
  const listId = store.useState('listId');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const inputGroupElement = store.useState('inputGroupElement');
  const inline = store.useState('inline');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const inputOwnsFormValue = store.useState('inputOwnsFormValue');
  const inputMatchesSelectedValue = () =>
    single() && !inputInsidePopup() && inputValue() === selectedLabelString();

  useField({
    commit: validation.commit,
    controlRef: () => (inputInsidePopup() ? triggerElement() : inputRef.current),
    enabled: () => !disabled(),
    getValue: () => fieldStringValue(),
    id,
    // Solid: `useField` has no field-name fallback (React's registration falls back), so the
    // resolved name is passed.
    name,
    value: fieldRawValue,
  });

  const forceMount = () => {
    if (items()) {
      // Ensure typeahead works on a closed list.
      // Solid: `CompositeList` holds the array itself, so it is refilled in place.
      const labels = flatFilteredValues().map(stringifyValueLabel);
      labelsRef.current.splice(0, labelsRef.current.length, ...labels);
    } else {
      store.set('forceMounted', true);
    }
  };

  /**
   * Emits `onItemHighlighted` for the item at `index`, or clears the highlight when `index` is `-1`
   * (a no-op if nothing was highlighted). Keeps `lastHighlightRef` in sync with what was emitted.
   */
  const emitHighlight = (value: any, index: number, type: AriaCombobox.HighlightEventReason) => {
    if (index === -1) {
      if (lastHighlightRef.current === INITIAL_LAST_HIGHLIGHT) {
        return;
      }
      lastHighlightRef.current = INITIAL_LAST_HIGHLIGHT;
    } else {
      lastHighlightRef.current = { value, index };
    }

    props.onItemHighlighted?.(value, createGenericEventDetails(type, undefined, { index }));
  };

  const setIndices = (options: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
  }) => {
    const update = {} as Pick<StoreState, 'activeIndex' | 'selectedIndex'>;

    if (options.activeIndex !== undefined) {
      update.activeIndex = options.activeIndex;
    }

    if (options.selectedIndex !== undefined) {
      update.selectedIndex = options.selectedIndex;
    }

    store.update(update);

    const activeIndexOption = options.activeIndex;
    if (activeIndexOption === undefined) {
      return;
    }

    const type: AriaCombobox.HighlightEventReason = options.type || REASONS.none;

    if (activeIndexOption === null) {
      emitHighlight(undefined, -1, type);
    } else {
      emitHighlight(valuesRef.current[activeIndexOption], activeIndexOption, type);
    }
  };

  const setInputValue = (next: string, eventDetails: AriaCombobox.ChangeEventDetails) => {
    props.onInputValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    // A canceled selection clear must not suppress close-completion cleanup.
    hadInputClearRef.current = eventDetails.reason === REASONS.inputClear;

    // If user is typing, ensure we don't auto-highlight on open due to a race
    // with the post-open effect that sets this flag.
    if (eventDetails.reason === REASONS.inputChange) {
      // A controlled popup may ignore a close request. Resuming input proves the popup
      // is remaining open, so release the query captured for an exit animation.
      if (open() && closeQuery() !== null) {
        setCloseQuery(null);
      }

      const event = eventDetails.event as Event;
      const inputType = (event as InputEvent).inputType;
      // Treat composition commits as typed input; autofill may omit `inputType` or
      // report `insertReplacementText`.
      const isTypedInput =
        event.type === 'compositionend' ||
        (inputType != null && inputType !== '' && inputType !== 'insertReplacementText');
      if (isTypedInput) {
        const hasQuery = next.trim() !== '';
        if (hasQuery) {
          setQueryChangedAfterOpen(true);
        }
        // Defer index updates until after the filtered items have been derived to ensure
        // `onItemHighlighted` receives the latest item.
        pendingQueryHighlightRef.current = { hasQuery };

        // Virtualized lists own their scroller. Reset regular lists directly so a stale
        // composite registry cannot select a reordered item and scrolling cannot escape
        // the popup.
        const list = store.state.listElement;
        if (!store.state.virtualized && list) {
          const popup = popupRef.current;
          for (const ancestor of getOverflowAncestors(list.firstElementChild ?? list)) {
            if (
              !isHTMLElement(ancestor) ||
              (popup ? !contains(popup, ancestor) : ancestor.getAttribute('role') === 'dialog')
            ) {
              break;
            }

            if (isScrollableY(ancestor)) {
              ancestor.scrollTop = 0;
              break;
            }
          }
        }

        if (
          hasQuery &&
          autoHighlightMode() &&
          store.state.activeIndex == null &&
          (open() || inline())
        ) {
          store.set('activeIndex', 0);
        }
      }
    } else if (
      eventDetails.reason === REASONS.inputClear &&
      next === '' &&
      store.state.inputInsidePopup
    ) {
      // A programmatic clear of an active query (e.g. after selecting an item with the
      // input inside the popup): restore the highlight to the selected item.
      pendingQueryHighlightRef.current = { hasQuery: false, selection: true };
    }

    setInputValueUnwrapped(next);
  };

  const handleInterruptedReopen = (isInputChange: boolean) => {
    const currentInputValue = inputValue();
    // Preserve values supplied with the reopen rather than owned by the interrupted close.
    const clearsPendingInput =
      !isInputChange &&
      inputInsidePopup() &&
      !inline() &&
      currentInputValue !== '' &&
      (String(currentInputValue).trim() === closeQuery() ||
        currentInputValue === selectedLabelString());

    // Keep the flag while a visible filter survives so the `items` sync cannot overwrite it.
    if (
      !isInputChange &&
      (clearsPendingInput || currentInputValue === '' || inputMatchesSelectedValue())
    ) {
      setQueryChangedAfterOpen(false);
    }

    setCloseQuery(null);

    if (clearsPendingInput) {
      // Cleanup clears omit the selection flag and reopening gesture.
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }
  };

  const setOpen = (nextOpen: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => {
    if (open() === nextOpen) {
      return;
    }

    // If the `Empty` component is not used, the positioner or popup should be hidden
    // with CSS. In this case, allow the Escape key to bubble to close a parent popup
    // if there are no items to show.
    if (
      eventDetails.reason === REASONS.escapeKey &&
      hasItems() &&
      flatFilteredValues().length === 0 &&
      !emptyRef.current
    ) {
      eventDetails.allowPropagation();
    }

    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen && closeQuery() !== null) {
      // `ComboboxInput` calls `setInputValue` before `setOpen`, so on an input-change reopen
      // `inputValue` is still the pre-keystroke value and the typed filter always survives.
      handleInterruptedReopen(eventDetails.reason === REASONS.inputChange);
    }

    if (!nextOpen && queryChangedAfterOpen()) {
      if (single()) {
        if (!inline()) {
          setCloseQuery(query());
        }
        // Avoid a flicker when closing the popup with an empty query.
        if (query() === '') {
          setQueryChangedAfterOpen(false);
        }
      } else if (multiple()) {
        if (!inline()) {
          // Freeze the current query so filtering remains stable while exiting.
          setCloseQuery(query());
        }

        if (inputInsidePopup()) {
          setIndices({ activeIndex: null });
        }

        // Clear the input immediately on close while retaining filtering via closeQuery for exit animations
        // if the input is outside the popup. When the input is inside the popup, defer the clear until
        // unmount so the filtered list doesn't flash to unfiltered during the exit animation.
        if (!inputInsidePopup() || inline()) {
          setInputValue(
            '',
            createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
              isItemPress: eventDetails.reason === REASONS.itemPress,
            }),
          );
        }
      }
    }

    setOpenUnwrapped(nextOpen);

    if (
      !nextOpen &&
      inputInsidePopup() &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      setTouched(true);
      setFocused(false);

      if (validationMode() === 'onBlur') {
        const valueToValidate = selectionMode() === 'none' ? inputValue() : selectedValue();
        validation.commit(valueToValidate);
      }
    }
  };

  const setSelectedValue = (
    nextValue: Value | Value[] | null,
    eventDetails: AriaCombobox.ChangeEventDetails,
  ) => {
    // Cast to `any` due to conditional value type (single vs. multiple).
    // The runtime implementation already ensures the correct value shape.
    props.onSelectedValueChange?.(nextValue as any, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setSelectedValueUnwrapped(nextValue);

    const shouldFillInput =
      (selectionMode() === 'none' && popupRef.current && fillInputOnItemPress()) ||
      (single() && !store.state.inputInsidePopup);

    if (shouldFillInput) {
      setInputValue(
        stringifyValueLabel(nextValue),
        createChangeEventDetails(eventDetails.reason, eventDetails.event),
      );
    }
  };

  const handleSelection = (event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) => {
    const targetEl = getTarget(event) as HTMLElement | null;
    const overrideEvent = selectionEventRef.current ?? event;
    selectionEventRef.current = null;
    const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);

    // Let the link handle the click.
    const href = targetEl?.closest('a')?.getAttribute('href');
    if (href) {
      if (href.startsWith('#')) {
        setOpen(false, eventDetails);
      }
      return;
    }

    if (multiple()) {
      const currentValue = selectedValue();
      const currentSelectedValue = Array.isArray(currentValue) ? currentValue : [];
      const isCurrentlySelected = selectedValueIncludes(
        currentSelectedValue,
        itemValue,
        isItemEqualToValue(),
      );
      const nextValue = isCurrentlySelected
        ? removeItem(currentSelectedValue, itemValue, isItemEqualToValue())
        : [...currentSelectedValue, itemValue];

      setSelectedValue(nextValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      const wasFiltering = inputRef.current ? inputRef.current.value.trim() !== '' : false;
      if (!wasFiltering) {
        return;
      }

      if (store.state.inputInsidePopup) {
        setInputValue(
          '',
          createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
            isItemPress: true,
          }),
        );
        // A newly selected item stays highlighted through the clear; a deselection
        // falls back to the standard selection anchor.
        const pendingHighlight = pendingQueryHighlightRef.current;
        if (pendingHighlight && !isCurrentlySelected) {
          pendingHighlight.toggledValue = itemValue;
        }
      } else {
        setOpen(false, eventDetails);
      }
    } else {
      setSelectedValue(itemValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      setOpen(false, eventDetails);
    }
  };

  const requestSubmit = () => {
    const formElement = validation.inputRef.current?.form ?? store.state.inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  };

  const handleUnmount = () => {
    setMounted(false);
    props.onOpenChangeComplete?.(false);
    setQueryChangedAfterOpen(false);
    setCloseQuery(null);

    if (selectionMode() === 'none') {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }

    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (
      multiple() &&
      inputRef.current &&
      inputRef.current.value !== '' &&
      !hadInputClearRef.current
    ) {
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }

    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (single()) {
      if (store.state.inputInsidePopup) {
        if (inputRef.current && inputRef.current.value !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyValueLabel(selectedValue());
        if (inputRef.current && inputRef.current.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === '' ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  };

  // Support composing the Dialog component around an inline combobox.
  // `[role="dialog"]` is more interoperable than using a context, e.g. it can work
  // with third-party modal libraries, though the limitation is that the closest
  // `role=dialog` part must be the animated element.
  const resolvedPopupRef = createMemo<HTMLElement | null | undefined>(() => {
    const positionerEl = positionerElement();
    if (inline() && positionerEl) {
      return positionerEl.closest('[role="dialog"]') as HTMLElement | null;
    }
    return popupRef.current;
  });

  useOpenChangeComplete({
    enabled: () => !props.actionsRef,
    open,
    // Solid: `popupRef` is a plain ref, so it is re-read when the open state settles.
    ref: () => (inline() ? resolvedPopupRef() : popupRef.current),
    onComplete() {
      if (!open()) {
        handleUnmount();
      }
    },
  });

  onSettled(() => {
    if (props.actionsRef) {
      props.actionsRef.current = { unmount: handleUnmount };
    }
  });

  createRenderEffect(
    ...on(
      [
        open,
        closeQuery,
        selectedValue,
        selectionMode,
        multiple,
        hasItems,
        flatFilteredValues,
        isItemEqualToValue,
      ],
      function syncSelectedIndex() {
        const currentCloseQuery = closeQuery();
        const closeQueryReleased =
          previousCloseQueryRef.current !== null && currentCloseQuery === null;
        previousCloseQueryRef.current = currentCloseQuery;

        // Closing indexes against the frozen filtered list. Reopening releases that query, so its
        // rendered coordinates must be synchronized again even though the popup is already open.
        if (open() && (!closeQueryReleased || !hasItems())) {
          return;
        }

        // State-driven (not tied to the internal event path) so controlled closes
        // also clear a pointerdown that never received a matching item mouseup.
        if (!open()) {
          pointerDownItemRef.current = null;
        }

        if (selectionMode() === 'none') {
          return;
        }

        // Without `items`, look the selection up in the live registry of mounted item
        // values (the list stays mounted while closed when closed-state features need
        // it — trigger interaction and rendered-label autofill force-mount it). Mounted
        // items re-assert the index themselves when their registration moves; when
        // nothing is mounted the lookup resolves to `null` and each item re-registers
        // the index on the next open.
        // Keep the selected index in the coordinates of the list that is actually rendered.
        const registry: readonly any[] = hasItems() ? flatFilteredValues() : valuesRef.current;

        setIndices({
          selectedIndex: findSelectionIndex(
            registry,
            selectedValue(),
            isItemEqualToValue(),
            multiple(),
          ),
        });
      },
    ),
  );

  createRenderEffect(
    ...on([items, flatFilteredValues], () => {
      if (items()) {
        valuesRef.current = flatFilteredValues();
        listRef.current.length = flatFilteredValues().length;
      }
    }),
  );

  // Solid: a user effect, since emitting a highlight runs user callbacks that may write signals.
  createEffect(
    ...on(
      [
        activeIndex,
        autoHighlightMode,
        hasFilteredItemsProp,
        hasItems,
        flatFilteredValues,
        inline,
        open,
        // Reruns the effect when the query changes without affecting the deps above, such as
        // clearing the input when no items are filtered out (individually rendered items).
        inputValue,
      ],
      () => {
        const pendingHighlight = pendingQueryHighlightRef.current;
        if (pendingHighlight) {
          // A directly rendered list remains visible when the popup state is closed, while a
          // kept-mounted Positioner is hidden and should stay inert.
          const listIsNavigable =
            open() || inline() || store.state.positionerElement?.hidden === false;
          if (pendingHighlight.hasQuery) {
            if (autoHighlightMode() && listIsNavigable) {
              store.set('activeIndex', 0);
            }
            pendingQueryHighlightRef.current = null;
          } else if (String(inputValue()).trim() === '') {
            // Only handle the clear once it has committed (a controlled input may reject it),
            // so a restore cannot fire while a query is still active.
            pendingQueryHighlightRef.current = null;
            if (listIsNavigable) {
              const clearedBySelection = pendingHighlight.selection;
              if (
                autoHighlightMode() === 'always' &&
                !clearedBySelection &&
                store.state.selectionMode === 'none'
              ) {
                // There is no selection to restore in Autocomplete. Keep the first-item reset
                // synchronous so list navigation sees it before a directly rendered list closes.
                store.set('activeIndex', 0);
              }

              // Items re-mounted by the clear publish their composite indices in a follow-up
              // commit, so the item registries are mid-update here. Defer past the cascade.
              queueMicrotask(() => {
                if (
                  (!store.state.open && !store.state.inline) ||
                  (inputRef.current && inputRef.current.value.trim() !== '')
                ) {
                  return;
                }

                // Return the highlight to the selected item, the same anchor the popup uses
                // when it first opens. Read the selection through the store so consumers can
                // pass an inline `isItemEqualToValue` or a fresh `selectedValue` array without
                // re-running this effect on every render.
                const currentSelectedValue = store.state.selectedValue;
                const isMultiple = store.state.selectionMode === 'multiple';
                const hasSelection =
                  isMultiple && Array.isArray(currentSelectedValue)
                    ? currentSelectedValue.length > 0
                    : store.state.selectionMode !== 'none' && currentSelectedValue != null;

                if (hasSelection) {
                  const registry =
                    hasItems() || hasFilteredItemsProp() ? flatFilteredValues() : valuesRef.current;
                  // A selection-driven clear keeps the just-selected item highlighted;
                  // otherwise return to the open anchor. A selection that is no longer in
                  // the list drops the highlight rather than leaving it on whichever item
                  // now occupies that index.
                  // `findItemIndex` resolves to -1 when no value was toggled.
                  const toggledIndex = findItemIndex(
                    registry,
                    pendingHighlight.toggledValue,
                    store.state.isItemEqualToValue,
                  );
                  store.set(
                    'activeIndex',
                    toggledIndex !== -1
                      ? toggledIndex
                      : findSelectionIndex(
                          registry,
                          currentSelectedValue,
                          store.state.isItemEqualToValue,
                          isMultiple,
                        ),
                  );
                } else if (clearedBySelection) {
                  store.set('activeIndex', null);
                } else if (autoHighlightMode() === 'always') {
                  store.set('activeIndex', 0);
                }
              });
            }
          }
        }

        if (!open() && !inline()) {
          return;
        }

        const shouldUseFlatFilteredValues = hasItems() || hasFilteredItemsProp();
        const candidateItems = shouldUseFlatFilteredValues
          ? flatFilteredValues()
          : valuesRef.current;
        const storeActiveIndex = store.state.activeIndex;

        if (storeActiveIndex == null) {
          if (autoHighlightMode() === 'always' && candidateItems.length > 0) {
            store.set('activeIndex', 0);
            return;
          }
          emitHighlight(undefined, -1, REASONS.none);
          return;
        }

        if (storeActiveIndex >= candidateItems.length) {
          emitHighlight(undefined, -1, REASONS.none);
          store.set('activeIndex', null);
          return;
        }

        const itemValue = candidateItems[storeActiveIndex];
        const previouslyHighlightedItemValue = lastHighlightRef.current.value;
        const isSameItem =
          previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
          compareItemEquality(
            itemValue,
            previouslyHighlightedItemValue,
            store.state.isItemEqualToValue,
          );

        if (lastHighlightRef.current.index !== storeActiveIndex || !isSameItem) {
          emitHighlight(itemValue, storeActiveIndex, REASONS.none);
        }
      },
    ),
  );

  // Solid: a user effect, since `setFilled` writes a signal (render effects may not on mount).
  createEffect(
    ...on([selectionMode, inputValue, selectedValue, multiple], () => {
      if (selectionMode() === 'none') {
        setFilled(String(inputValue()) !== '');
        return;
      }
      const currentValue = selectedValue();
      setFilled(
        multiple() ? Array.isArray(currentValue) && currentValue.length > 0 : currentValue != null,
      );
    }),
  );

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  createEffect(
    ...on([hasItems, autoHighlightMode, () => flatFilteredValues().length], () => {
      if (hasItems() && autoHighlightMode() && flatFilteredValues().length === 0) {
        setIndices({ activeIndex: null });
      }
    }),
  );

  function handleQueryChanged() {
    if (
      open() &&
      query() !== '' &&
      query() !== String(initialDefaultInputValue) &&
      !inputMatchesSelectedValue()
    ) {
      setQueryChangedAfterOpen(true);
    }
  }

  function handleOpenChanged() {
    // A controlled `open` prop can interrupt the close without calling `setOpen`.
    if (open() && closeQuery() !== null) {
      handleInterruptedReopen(false);
    }
  }

  // These sync triggers can run in the same flush while still seeing the pre-flush `inputValue`.
  // This flush-scoped flag prevents duplicate callbacks and resets so canceled writes can retry.
  let syncedSelectedLabel = false;

  // Solid: React scopes the flag to a render; a render effect on the same triggers resets it at
  // the start of each flush, before the user effects below that run the syncs.
  createRenderEffect(
    () => [selectedValue(), selectedLabelString(), items()],
    () => {
      syncedSelectedLabel = false;
    },
  );

  function syncInputToSelectedLabel() {
    if (!syncedSelectedLabel && inputValue() !== selectedLabelString()) {
      syncedSelectedLabel = true;
      setInputValue(selectedLabelString(), createChangeEventDetails(REASONS.none));
    }
  }

  function commitFieldValue(value: unknown) {
    // Solid: the field validation hook predates `validation.change`; this is its equivalent.
    if (shouldValidateOnChange()) {
      validation.commit(value);
    } else {
      validation.commit(value, true);
    }
  }

  function handleSelectedValueChanged() {
    if (selectionMode() === 'none') {
      return;
    }

    clearErrors(name());
    setDirty(
      isSelectedValueDirty(selectedValue(), validityData.initialValue, isItemEqualToValue()),
    );

    commitFieldValue(selectedValue());

    if (single() && !hasInputValue() && !inputInsidePopup()) {
      syncInputToSelectedLabel();
    }
  }

  // The label catches accessor changes while the items identity restores the selected label after
  // a one-step input clear followed by a data reload. The shared sync prevents duplicate writes
  // when both change in the same flush.
  function syncInputAfterItemsOrLabelChange() {
    if (single() && !hasInputValue() && !inputInsidePopup() && !queryChangedAfterOpen()) {
      syncInputToSelectedLabel();
    }
  }

  function handleInputValueChanged() {
    if (selectionMode() !== 'none') {
      return;
    }

    clearErrors(name());
    setDirty(inputValue() !== validityData.initialValue);

    commitFieldValue(inputValue());
  }

  // Solid: effects run by dependency height rather than creation order, so a separate watcher on
  // the `query` memo would run after the `open` watcher. Watch both in one effect to keep React's
  // order (query handler first) when a reopen changes both in the same flush.
  let previousQuery = untrack(query);
  let previousOpen = untrack(open);
  createRenderEffect(
    () => [query(), open()] as const,
    ([currentQuery, currentOpen]) => {
      const queryChanged = currentQuery !== previousQuery;
      const openChanged = currentOpen !== previousOpen;
      previousQuery = currentQuery;
      previousOpen = currentOpen;

      if (queryChanged) {
        untrack(handleQueryChanged);
      }
      if (openChanged) {
        untrack(handleOpenChanged);
      }
    },
  );
  useValueChanged(selectedLabelString, () => untrack(syncInputAfterItemsOrLabelChange));
  useValueChanged(items, () => untrack(syncInputAfterItemsOrLabelChange));

  // Solid: field validation reads the hidden input's DOM value, which its spread props write in
  // the user-effect phase. React validates after the DOM commit, so the two validating handlers
  // run as user effects created after the hidden input (effects run in creation order).
  function ValueChangeEffects() {
    createEffect(...on(selectedValue, () => handleSelectedValueChanged(), { defer: true }));
    createEffect(...on(inputValue, () => handleInputValueChanged(), { defer: true }));
    return null;
  }

  const floatingRootContext = useFloatingRootContext({
    get open() {
      return inline() ? true : open();
    },
    onOpenChange(nextOpen, eventDetails) {
      setOpen(nextOpen, eventDetails as AriaCombobox.ChangeEventDetails);
    },
    elements: {
      get reference() {
        return inputInsidePopup() ? triggerElement() : inputElement();
      },
      get floating() {
        return positionerElement();
      },
    },
  });

  const ariaHasPopup = () => (grid() ? 'grid' : 'listbox');
  // An inline list isn't gated on `open`: it renders for as long as it's in the tree, so the
  // combobox is permanently expanded even while the internal open state is `false`.
  const expanded = () => open() || inline();
  const ariaExpanded = () => (expanded() ? 'true' : 'false');

  const role: ElementProps = {
    get reference() {
      const isPlainInput = inputElement()?.tagName === 'INPUT';
      // Before the input ref is available, assume an input-like control so combobox ARIA
      // attributes are present.
      const shouldTreatAsInput = inputElement() == null || isPlainInput;
      // A non-input control only takes on combobox semantics while the list is exposed, which for
      // an inline list is the whole time.
      const shouldApplyAria = shouldTreatAsInput || expanded();

      // Solid: the generic `HTMLAttributes` lacks input-only keys such as `autocomplete`.
      const reference: HTMLProps & Record<string, unknown> = shouldTreatAsInput
        ? {
            autocomplete: 'off',
            spellcheck: 'false',
            autocorrect: 'off',
            autocapitalize: 'none',
          }
        : {};

      if (shouldApplyAria) {
        reference.role = 'combobox';
        reference['aria-expanded'] = ariaExpanded();
        reference['aria-haspopup'] = ariaHasPopup();
        // Solid: the list id is reactive store state (see `State.listId`).
        reference['aria-controls'] = expanded() ? listId() : undefined;
        // `readOnly` accepts no input, so no completion of any kind is offered.
        reference['aria-autocomplete'] = readOnly() ? 'none' : autoComplete();
      }

      return reference;
    },
    floating: { role: 'presentation' },
  };

  // `readOnly` locks the value, not the interaction: the popup opens and can be browsed.
  // Value changes stay blocked in `ComboboxItem`, `ComboboxInput`'s keydown, `ComboboxTrigger`'s
  // typeahead, the clear/remove parts, and the hidden input's autofill handler.
  const click = useClick({
    get context() {
      return floatingRootContext;
    },
    props: {
      get enabled() {
        return !disabled() && openOnInputClick();
      },
      event: 'mousedown-only',
      toggle: false,
      // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
      // This avoids top-bottom flip flickers if the preferred position is "top" when first tapping.
      get touchOpenDelay() {
        return inputInsidePopup() ? 0 : 100;
      },
      reason: REASONS.inputPress,
    },
  });

  const dismiss = useDismiss({
    get context() {
      return floatingRootContext;
    },
    props: {
      get enabled() {
        return !disabled() && !inline();
      },
      outsidePressEvent: {
        mouse: 'sloppy',
        // The visual viewport (affected by the mobile software keyboard) can be
        // somewhat small. The user may want to scroll the screen to see more of
        // the popup.
        touch: 'intentional',
      },
      // Without a popup, let the Escape key bubble the event up to other popups' handlers.
      get bubbles() {
        return inline() ? true : undefined;
      },
      outsidePress(event) {
        const target = getTarget(event) as Element | null;
        return (
          !contains(triggerElement(), target) &&
          !contains(clearRef.current, target) &&
          !contains(chipsContainerRef.current, target) &&
          !contains(inputGroupElement(), target)
        );
      },
    },
  });

  const listNavigation = useListNavigation({
    get context() {
      return floatingRootContext;
    },
    props: {
      get enabled() {
        return !disabled();
      },
      get id() {
        return id();
      },
      get listRef() {
        return listRef.current;
      },
      get activeIndex() {
        return activeIndex();
      },
      get selectedIndex() {
        return selectedIndex();
      },
      virtual: true,
      get loopFocus() {
        return loopFocus();
      },
      get allowEscape() {
        return loopFocus() && !autoHighlightMode();
      },
      get focusItemOnOpen() {
        return queryChangedAfterOpen() || (selectionMode() === 'none' && !autoHighlightMode())
          ? false
          : 'auto';
      },
      get focusItemOnHover() {
        return highlightItemOnHover();
      },
      get resetOnPointerLeave() {
        return !keepHighlight();
      },
      get orientation() {
        return grid() ? 'horizontal' : undefined;
      },
      get rtl() {
        return direction() === 'rtl';
      },
      disabledIndices: EMPTY_ARRAY as number[],
      get grid() {
        return grid() ? gridNavigation : undefined;
      },
      onNavigate(nextActiveIndex, event) {
        // Retain the highlight only while actually transitioning out or closed.
        if ((!event && !open()) || transitionStatus() === 'ending') {
          return;
        }

        if (!event) {
          setIndices({
            activeIndex: nextActiveIndex,
          });
        } else {
          setIndices({
            activeIndex: nextActiveIndex,
            type: keyboardActiveRef.current ? REASONS.keyboard : REASONS.pointer,
          });
        }
      },
    },
  });

  // Solid: the interaction getters return live views, so each is created once. The hooks are
  // merged in the order React's `mergeProps` runs their handlers (rightmost first).
  const referenceProps = useInteractions([
    role,
    click,
    dismiss,
    listNavigation,
  ]).getReferenceProps();
  const dismissFloatingProps = useInteractions([dismiss]).getFloatingProps();

  const inputProps = createMemo(
    () =>
      mergeProps(referenceProps, {
        onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
          // In grid mode the navigation hook treats ArrowLeft/ArrowRight as horizontal
          // grid movement. When the input has focus and no item is highlighted the user
          // is still editing the query, so let the input keep its native caret behavior.
          if (
            grid() &&
            store.state.activeIndex == null &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
          ) {
            event.preventBaseUIHandler();
          }
        },
      }) as HTMLProps,
  );

  const popupProps = createMemo(
    () => mergeProps(FOCUSABLE_POPUP_PROPS, dismissFloatingProps) as HTMLProps,
  );

  const listProps = useInteractions([role, listNavigation]).getFloatingProps() as HTMLProps;

  // Combobox keeps focus on the input; item focus would incorrectly sync
  // list navigation state from DOM focus.
  const itemProps: HTMLProps = (() => {
    const listNavigationItemProps = listNavigation.item as HTMLProps | undefined;
    if (!listNavigationItemProps) {
      return EMPTY_OBJECT as HTMLProps;
    }
    const { onFocus: _onFocus, ...rest } = listNavigationItemProps as HTMLProps & {
      onFocus?: unknown;
    };
    return rest;
  })();

  // The prop bags must be in the store before the parts render: they read them with `useState`.
  store.update({
    popupProps: untrack(popupProps),
    listProps,
    inputProps: untrack(inputProps),
    triggerProps,
    itemProps,
  });

  createRenderEffect(
    () => ({ popupProps: popupProps(), inputProps: inputProps() }),
    (bags) => {
      store.update(bags);
    },
  );

  store.useContextCallback('setOpen', setOpen);
  store.useContextCallback('setInputValue', setInputValue);
  store.useContextCallback('setSelectedValue', setSelectedValue);
  store.useContextCallback('setIndices', setIndices);
  store.useContextCallback('handleSelection', handleSelection);
  store.useContextCallback('forceMount', forceMount);
  store.useContextCallback('requestSubmit', requestSubmit);
  store.useContextCallback('onOpenChangeComplete', (nextOpen: boolean) =>
    props.onOpenChangeComplete?.(nextOpen),
  );

  const itemsContextValue: ComboboxDerivedItemsContext = {
    query,
    hasItems,
    filteredItems: filteredItems as () => any[],
    flatFilteredValues,
  };

  const serializedValue = createMemo(() => {
    const rawValue = fieldRawValue();
    if (Array.isArray(rawValue)) {
      return '';
    }
    return stringifyAsValue(rawValue, props.itemToStringValue);
  });

  const hasMultipleSelection = () => {
    const currentValue = selectedValue();
    return multiple() && Array.isArray(currentValue) && currentValue.length > 0;
  };
  const hiddenInputName = () =>
    multiple() || (selectionMode() === 'none' && inputOwnsFormValue()) ? undefined : name();

  const hiddenInputs = createMemo(() => {
    const currentValue = selectedValue();
    if (!multiple() || !Array.isArray(currentValue) || !name()) {
      return null;
    }

    return currentValue.map((value: Value) => {
      const currentSerializedValue = () => stringifyAsValue(value, props.itemToStringValue);
      return (
        <input
          type="hidden"
          form={form()}
          name={name()}
          value={currentSerializedValue()}
          disabled={disabled()}
        />
      );
    });
  });

  return (
    <ComboboxRootContext value={store}>
      <ComboboxFloatingContext value={floatingRootContext}>
        <ComboboxHasItemsContext value={hasItems}>
          <ComboboxDerivedItemsContext value={itemsContextValue}>
            <ComboboxInputValueContext value={inputValue}>
              {props.children}
              <input
                {...(validation.getValidationProps(disabled(), {
                  // Move focus when the hidden input is focused.
                  onFocus() {
                    const triggerEl = triggerElement();
                    if (inputInsidePopup()) {
                      triggerEl?.focus();
                      return;
                    }

                    (inputRef.current || triggerEl)?.focus();
                  },
                  // Handle browser autofill.
                  onInput(event: InputEvent) {
                    // Workaround for https://github.com/facebook/react/issues/9023
                    if (event.defaultPrevented || disabled() || readOnly()) {
                      // Solid: inputs are not controlled, so restore the value React's controlled
                      // hidden input keeps when the change is ignored.
                      (event.currentTarget as HTMLInputElement).value = serializedValue();
                      return;
                    }

                    const nextValue = (event.currentTarget as HTMLInputElement).value;
                    const nextValueLower = nextValue.toLowerCase();
                    const details = createChangeEventDetails(REASONS.none, event);

                    const findSerializedMatchIndex = () =>
                      valuesRef.current.findIndex(
                        (candidate) =>
                          stringifyAsValue(candidate, props.itemToStringValue).toLowerCase() ===
                            nextValueLower ||
                          stringifyValueLabel(candidate).toLowerCase() === nextValueLower,
                      );

                    function handleChange() {
                      // Browser autofill only writes a single scalar value.
                      if (multiple()) {
                        return;
                      }

                      if (selectionMode() === 'none') {
                        setInputValue(nextValue, details);
                        return;
                      }

                      // Preserve the original serialized matching, then fall back to rendered text,
                      // which browsers can autofill for primitive values like `value="US">United States`.
                      let matchingIndex = findSerializedMatchIndex();

                      if (matchingIndex === -1) {
                        matchingIndex = valuesRef.current.findIndex((_, index) => {
                          const renderedLabel = labelsRef.current[index];
                          return (
                            renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower
                          );
                        });
                      }

                      const matchingValue =
                        matchingIndex === -1 ? undefined : valuesRef.current[matchingIndex];
                      if (matchingValue != null) {
                        // `setSelectedValue` may be canceled by `onValueChange`; rely on
                        // `useValueChanged` to mark the field dirty and run validation only
                        // when the value actually changes.
                        setSelectedValue(matchingValue, details);
                      }
                    }

                    // Only single-selection autofill matches against the registered values/labels.
                    // `multiple` ignores autofill and `none` just writes the input value, so avoid the
                    // sticky `forceMounted` mount (which never resets) for those modes.
                    if (single()) {
                      forceMount();
                      if (items() && findSerializedMatchIndex() === -1) {
                        // `forceMount` only refreshes the derived labels for the `items` prop. When
                        // serialized matching misses, also mount the list so rendered labels (which can
                        // differ from the serialized values) are registered for autofill matching.
                        store.set('forceMounted', true);
                      }
                    }
                    queueMicrotask(handleChange);
                  },
                }) as HTMLProps<HTMLInputElement>)}
                id={id() && hiddenInputName() == null ? `${id()}-hidden-input` : undefined}
                form={form()}
                name={hiddenInputName()}
                autocomplete={props.formAutoComplete}
                disabled={disabled()}
                required={required() && !hasMultipleSelection()}
                readonly={readOnly()}
                value={serializedValue()}
                ref={(el) => {
                  if (props.inputRef) {
                    props.inputRef.current = el;
                  }
                  validation.inputRef.current = el;
                }}
                style={hiddenInputName() ? visuallyHiddenInput : visuallyHidden}
                tabindex={-1}
                aria-hidden="true"
              />
              {hiddenInputs()}
              <ValueChangeEffects />
            </ComboboxInputValueContext>
          </ComboboxDerivedItemsContext>
        </ComboboxHasItemsContext>
      </ComboboxFloatingContext>
    </ComboboxRootContext>
  );
}

type SelectionMode = 'single' | 'multiple' | 'none';

type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends 'multiple'
  ? ItemValue[]
  : ItemValue;

interface ComboboxRootProps<ItemValue, Item = ItemValue> {
  children?: JSX.Element;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: ComponentProps<'input'>['value'] | undefined;
  /**
   * Callback fired when the input value of the combobox changes.
   */
  onInputValueChange?:
    ((value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: ComponentProps<'input'>['value'] | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the combobox.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: ReactLikeRef<AriaCombobox.Actions | null> | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering.
   * - `'none'`: the highlight changed programmatically.
   */
  onItemHighlighted?:
    | ((itemValue: ItemValue | undefined, eventDetails: AriaCombobox.HighlightEventDetails) => void)
    | undefined;
  /**
   * A ref to the hidden input element.
   */
  inputRef?: ReactLikeRef<HTMLInputElement | null> | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be a flat array of items, an array of groups with items, or a collection created by
   * the `createItems()` function, which derives each item's selection value and label.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?:
    readonly any[] | readonly Group<any>[] | ComboboxItemCollection<Item, ItemValue> | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * With a `createItems()` collection, pass source items rather than derived values.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   * Receives the source item, which is the derived value's item when `items` is a `createItems()`
   * collection, and the item itself otherwise.
   */
  filter?:
    | null
    | ((item: Item, query: string, itemToString?: (item: Item) => string) => boolean)
    | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value, and the collection's
   * `getLabel` takes precedence for values it can resolve.
   */
  itemToStringLabel?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * With a `createItems()` collection, both arguments are derived values.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: ItemValue, value: ItemValue) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   *
   * In a `Combobox.Root` > `Dialog.Root` composition, bind the Combobox's `open` and
   * `onOpenChange` props to the `Dialog`'s `open` and `onOpenChange` state instead so the
   * component resets its transient state (filter query, highlighted item, and input value) when
   * the dialog closes.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

export interface AriaComboboxState {}

export type AriaComboboxProps<
  Value,
  Mode extends SelectionMode = 'none',
  Item = Value,
> = ComboboxRootProps<Value, Item> & {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   * - `none`: Do not remember the selected value.
   */
  selectionMode: Mode;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Callback fired when the selected value of the combobox changes.
   */
  onSelectedValueChange?:
    | ((
        value: ComboboxItemValueType<Value, Mode>,
        eventDetails: AriaCombobox.ChangeEventDetails,
      ) => void)
    | undefined;
};

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = 'none', Item = Value> = AriaComboboxProps<
    Value,
    Mode,
    Item
  >;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
  }

  export type HighlightEventReason =
    typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = BaseUIGenericEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.none;
  export type ChangeEventDetails = BaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}
