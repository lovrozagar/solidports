import {
  createMemo,
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor, Owner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  IndexGuessBehavior,
  useCompositeListItem,
} from '../../internals/composite/list/useCompositeListItem';
import {
  provideContext,
  omitComponentProps,
  useRef,
  createLayoutEffect,
} from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { compareItemEquality, findItemIndex, resolveSelectedIndex } from '../../utils/itemEquality';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  HTMLProps,
  NonNativeButtonProps,
} from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import {
  compileStateWriter,
  currentWritePass,
  renderNativeElement,
} from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { provideNativeContext } from '../../utils/native/context';
import { createNativeListItem } from '../../utils/native/listItem';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { propsSourceMemo } from '../../utils/propsView';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { flushSync } from '../../utils/flushSync';
import {
  useComboboxDerivedItemsContext,
  useComboboxHasItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import { ComboboxItemContext } from './ComboboxItemContext';
import type { ComboboxStore } from '../store';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton', 'index'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['value', 'index', 'disabled', 'nativeButton']);
const OPTION: Record<string, unknown> = { role: 'option' };
const GRIDCELL: Record<string, unknown> = { role: 'gridcell' };
const GUESS_INDEX = { guessIndex: true } as const;

type ItemEvent<T extends Event> = BaseUIEvent<T>;

/**
 * The item's state, as `class`/`style` functions and its `data-*` attributes read it: prototype
 * getters over the item, each selection read once per write pass (a keyed read registers a
 * release per read, and the attribute write reads them too).
 */
class NativeComboboxItemState implements ComboboxItem.State {
  declare private readonly item: NativeComboboxItemModel;
  declare private pass: number;
  declare private cachedHighlighted: boolean;
  declare private cachedSelected: boolean;

  constructor(item: NativeComboboxItemModel) {
    this.item = item;
    this.pass = -1;
    this.cachedHighlighted = false;
    this.cachedSelected = false;
  }

  private read() {
    const pass = currentWritePass();
    if (this.pass !== pass) {
      this.pass = pass;
      this.cachedHighlighted = this.item.highlighted();
      this.cachedSelected = this.item.selected();
    }
  }

  get disabled() {
    return this.item.disabled();
  }

  get selected() {
    this.read();
    return this.cachedSelected;
  }

  get highlighted() {
    this.read();
    return this.cachedHighlighted;
  }
}

interface ItemRegistration {
  registered: boolean;
  hasItems: boolean;
  index: number;
  value: unknown;
  isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;
}

/**
 * A native open combobox item: its model, the target of its module-level handlers, its capture
 * listener and its attribute write, and the value its item parts read through
 * `ComboboxItemContext`. One object per item.
 */
class NativeComboboxItemModel implements ComboboxItemContext {
  declare readonly props: ComboboxItem.Props;
  declare readonly store: ComboboxStore;
  declare readonly hasItems: Accessor<boolean>;
  declare readonly index: Accessor<number>;
  declare readonly textRef: { current: HTMLElement | null | undefined };
  declare readonly state: NativeComboboxItemState;
  /** The `valuesRef` slot this item last wrote, so a move or an unmount clears only its own. */
  declare registeredIndex: number;
  declare registeredValue: unknown;
  declare private readonly owner: Owner | null;
  declare private compared: Accessor<boolean> | undefined;

  constructor(
    props: ComboboxItem.Props,
    store: ComboboxStore,
    hasItems: Accessor<boolean>,
    index: Accessor<number>,
  ) {
    this.props = props;
    this.store = store;
    this.hasItems = hasItems;
    this.index = index;
    this.textRef = { current: null };
    this.state = new NativeComboboxItemState(this);
    this.registeredIndex = -1;
    this.registeredValue = undefined;
    this.owner = getOwner();
    this.compared = undefined;
  }

  value() {
    return this.props.value ?? null;
  }

  disabled() {
    return this.store.state.disabled || Boolean(this.props.disabled);
  }

  highlighted() {
    return this.store.select('isActive', this.index);
  }

  /**
   * The item's selection: its value's entry in the root's keyed membership, so a selection change
   * re-runs only the items that joined or left it (D32's batch 1 regate: every item re-reading the
   * whole value took combobox/multiple-1000's remove 10 chips from 10.7 to 30.6 ms). A custom
   * `isItemEqualToValue` cannot be keyed: the item then compares in a memo of its own.
   */
  readonly selected = (): boolean => {
    const { store } = this;
    if (store.state.selectionMode === 'none') {
      return false;
    }
    if (!store.context.customItemEquality()) {
      return store.context.selectedMembership(this.value());
    }
    this.compared ??= runWithOwner(this.owner, () =>
      createMemo(() => store.select('isSelected', () => this.value())),
    );
    return this.compared();
  };

  id() {
    const rootId = this.store.state.id;
    const index = this.index();
    return rootId != null && index !== -1 ? `${rootId}-${index}` : undefined;
  }

  private clearSlot() {
    const values = this.store.context.valuesRef.current;
    if (this.registeredIndex !== -1 && values[this.registeredIndex] === this.registeredValue) {
      delete values[this.registeredIndex];
    }
    this.registeredIndex = -1;
  }

  /** The visible-values slot and the selected-index claim (React's two layout effects). */
  register(deps: ItemRegistration) {
    this.clearSlot();
    if (!deps.registered || deps.hasItems) {
      return;
    }
    this.store.context.valuesRef.current[deps.index] = deps.value;
    this.registeredIndex = deps.index;
    this.registeredValue = deps.value;
    // Runs while closed as well (the list can stay mounted via `keepMounted` or a force-mount), so
    // the index tracks the item's composite position, keeping closed-trigger typeahead in sync
    // when the rendered order changes.
    const store = this.store;
    const selectedValue = store.state.selectedValue;
    let nextIndex = store.state.selectedIndex;
    if (store.state.selectionMode === 'multiple' && Array.isArray(selectedValue)) {
      nextIndex = resolveSelectedIndex(
        deps.index,
        deps.value,
        store.context.valuesRef.current,
        selectedValue,
        deps.isItemEqualToValue,
        nextIndex,
      );
    } else if (compareItemEquality(deps.value, selectedValue, deps.isItemEqualToValue)) {
      nextIndex = deps.index;
    }
    store.set('selectedIndex', nextIndex);
  }

  unregister() {
    this.clearSlot();
  }

  /** The capture-phase pointerdown (an `EventListener` object: no closure per item). */
  handleEvent(event: Event) {
    // The compat `mouseup` only fires for the primary pointer, so a non-primary touch must not
    // overwrite the shared ref: a mismatch would make the primary pointer's release read as a
    // drag-select and commit a second time after `click`.
    if ((event as PointerEvent).isPrimary) {
      this.store.context.pointerDownItemRef.current = event.currentTarget as Element;
    }
    event.preventDefault();
  }

  /** The root's list navigation handler for `key` (none until the interactions are created). */
  callListNavigation(key: string, event: Event) {
    const handler = readHandler(this.store.state.itemProps, key);
    if (handler) {
      handler(event);
    }
  }

  commitSelection(nativeEvent: MouseEvent) {
    const store = this.store;
    const selectItem = () => store.context.handleSelection(nativeEvent, this.value());
    if (store.state.submitOnItemClick) {
      flushSync(selectItem);
      store.context.requestSubmit();
    } else {
      selectItem();
    }
  }

  mouseDown(event: MouseEvent) {
    // iOS Safari can emit a synthetic mousedown for touch taps without a preceding pointerdown.
    // Prevent default here too so tapping an item does not blur the input.
    event.preventDefault();
    this.callListNavigation('onMouseDown', event);
  }

  click(event: MouseEvent) {
    if (!this.disabled() && !this.store.state.readOnly) {
      this.commitSelection(event);
    }
    this.callListNavigation('onClick', event);
  }

  mouseUp(event: MouseEvent) {
    const store = this.store;
    const pointerStartedOnItem = store.context.pointerDownItemRef.current === event.currentTarget;
    store.context.pointerDownItemRef.current = null;
    if (
      !this.disabled() &&
      !store.state.readOnly &&
      event.button === 0 &&
      !pointerStartedOnItem &&
      untrack(() => this.highlighted())
    ) {
      this.commitSelection(event);
    }
    this.callListNavigation('onMouseUp', event);
  }
}

/** The registration inputs: tracked by the item's one registration effect. */
function readRegistration(item: NativeComboboxItemModel): ItemRegistration {
  const index = item.index();
  return {
    registered: index !== -1,
    hasItems: item.hasItems(),
    index,
    value: item.value(),
    isItemEqualToValue: item.store.state.isItemEqualToValue,
  };
}

/**
 * `useButton`'s keydown after the lower-priority handlers, for a non-native composite item that is
 * not a link: Space and Enter click the item (Space unless typeahead prevented it).
 */
function compositeItemKeyDownAfter(event: ItemEvent<KeyboardEvent>) {
  if (event.baseUIHandlerPrevented || event.target !== event.currentTarget) {
    return;
  }
  const currentTarget = event.currentTarget as Element;
  if (event.key === ' ') {
    const role = currentTarget.getAttribute('role');
    const isTextNavigationRole =
      role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';
    if (event.defaultPrevented && isTextNavigationRole) {
      return;
    }
    event.preventDefault();
    event.preventBaseUIHandler();
    dispatchClickWithModifiers(currentTarget, event);
    return;
  }
  if (event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  event.preventBaseUIHandler();
  dispatchClickWithModifiers(currentTarget, event);
}

/** A disabled item cancels the event and runs no handler (`useButton`'s click and pointerdown). */
function preventWhileDisabled(item: NativeComboboxItemModel, event: Event) {
  if (item.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

const callListNavigation = (key: string) => (item: NativeComboboxItemModel, event: Event) =>
  item.callListNavigation(key, event);

/**
 * A native item's handlers, in the slow path's `mergeProps` order (the button's wrappers, then the
 * consumer's, then the item's own, then the root's list navigation), created once.
 */
const ITEM_HANDLERS: Readonly<Record<string, Dispatch<NativeComboboxItemModel>>> = {
  onClick: partHandler<NativeComboboxItemModel, MouseEvent>(
    'onClick',
    (item, event) => item.click(event),
    preventWhileDisabled,
  ),
  onMouseDown: partHandler<NativeComboboxItemModel, MouseEvent>(
    'onMouseDown',
    (item, event) => item.mouseDown(event),
    (item) => !item.disabled(),
  ),
  onMouseUp: partHandler<NativeComboboxItemModel, MouseEvent>('onMouseUp', (item, event) =>
    item.mouseUp(event),
  ),
  onKeyDown: partHandler<NativeComboboxItemModel, KeyboardEvent>(
    'onKeyDown',
    (item, event) => {
      item.callListNavigation('onKeyDown', event);
      compositeItemKeyDownAfter(event);
    },
    (item, event) => {
      // `useFocusableWhenDisabled`: a disabled item keeps Tab and blocks every other key.
      if (item.disabled() && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !item.disabled();
    },
  ),
  onFocus: partHandler<NativeComboboxItemModel, FocusEvent>(
    'onFocus',
    callListNavigation('onFocus'),
  ),
  onMouseMove: partHandler<NativeComboboxItemModel, MouseEvent>(
    'onMouseMove',
    callListNavigation('onMouseMove'),
  ),
  onPointerLeave: partHandler<NativeComboboxItemModel, PointerEvent>(
    'onPointerLeave',
    callListNavigation('onPointerLeave'),
  ),
  onPointerDown: partHandler<NativeComboboxItemModel, PointerEvent>(
    'onPointerDown',
    callListNavigation('onPointerDown'),
    preventWhileDisabled,
  ),
};

/** Bound only when the consumer passes them: `useButton`'s gate around the consumer's handler. */
const ITEM_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativeComboboxItemModel>>> = {
  onKeyUp: partHandler<NativeComboboxItemModel>('onKeyUp', undefined, (item) => !item.disabled()),
};

/** The item state's `data-*` attributes in the slow path's key order. */
const writeItemState = compileStateWriter(['disabled', 'selected', 'highlighted'], undefined);

/** The item's own attributes below the consumer's: one write per pass. */
function writeItemAttributes(w: SetAttribute, item: NativeComboboxItemModel) {
  const state = item.state;
  w.set('id', item.id());
  let ariaSelected: 'true' | 'false' | undefined;
  if (item.store.state.selectionMode !== 'none') {
    ariaSelected = state.selected ? 'true' : 'false';
  }
  w.set('aria-selected', ariaSelected);
  // `useFocusableWhenDisabled` for a non-native composite item.
  w.set('aria-disabled', state.disabled ? 'true' : undefined);
}

const itemState = (item: NativeComboboxItemModel) => item.state;

function NativeComboboxItem(props: ComboboxItem.Props, isRow: boolean): JSX.Element {
  const store = useComboboxRootContext();
  const hasItems = useComboboxHasItemsContext();
  let item: NativeComboboxItemModel | undefined;
  const listItem = createNativeListItem<null>(null, {
    ...GUESS_INDEX,
    textRef: () => item!.textRef.current,
  });
  item = new NativeComboboxItemModel(props, store, hasItems, listItem.index);
  const model = item;
  createRenderEffect(
    () => readRegistration(model),
    (deps) => untrack(() => model.register(deps)),
  );
  void onCleanup(() => model.unregister());

  const el = (<div />) as unknown as HTMLDivElement;
  return provideNativeContext(ComboboxItemContext, model as ComboboxItemContext, () =>
    renderNativeElement(el, props, {
      own: OWN_KEYS,
      state: itemState,
      stateWriter: writeItemState,
      stateView: model.state,
      reactive: true,
      literal: isRow ? GRIDCELL : OPTION,
      attributes: writeItemAttributes,
      handlers: ITEM_HANDLERS,
      handlersIfPassed: ITEM_HANDLERS_IF_PASSED,
      handlerTarget: model,
      refs: [
        listItem.setRef,
        (node: HTMLElement | null) => {
          if (node) {
            node.addEventListener('pointerdown', model, true);
          }
        },
      ],
    }),
  ) as unknown as JSX.Element;
}

interface ComboboxItemInnerProps {
  componentProps: ComboboxItem.Props;
  /**
   * Whether the list is externally virtualized. Passed down from the wrapper (which already
   * subscribes to it) so the inner component doesn't re-subscribe to the store.
   */
  virtualized: Accessor<boolean>;
  /**
   * Pre-resolved index for the virtualized fallback (when no `index` prop is provided).
   * `undefined` for the common path, where the index is derived from `index` prop or the
   * composite list registration order.
   */
  indexFromFilter: Accessor<number | undefined>;
}

function ComboboxItemInner(props: ComboboxItemInnerProps) {
  const componentProps = props.componentProps;
  const elementProps = omitComponentProps(componentProps, [
    'value',
    'index',
    'disabled',
    'nativeButton',
  ] as const);

  const itemValue = () => componentProps.value ?? null;
  const indexProp = () => componentProps.index;
  const disabledProp = () => componentProps.disabled ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;

  const textRef = useRef<HTMLElement | null | undefined>(null);
  const listItem = useCompositeListItem({
    index: indexProp,
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
    textRef: () => textRef.current,
  });

  const store = useComboboxRootContext();
  const isRow = useComboboxRowContext();
  const hasItems = useComboboxHasItemsContext();

  const selectionMode = store.useState('selectionMode');
  const rootDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const isItemEqualToValue = store.useState('isItemEqualToValue');

  const disabled = () => rootDisabled() || disabledProp();
  const selectable = () => selectionMode() !== 'none';
  const index = () => indexProp() ?? props.indexFromFilter() ?? listItem.index();
  const hasRegistered = () => index() !== -1;

  const rootId = store.useState('id');
  // Solid: memos keep a highlight or selection change from re-running every item's bindings.
  const highlighted = createMemo(() => store.select('isActive', index));
  // Keyed for the default equality (`NativeComboboxItemModel.selected`); a custom comparer compares
  // in a memo of the item's own, created on its first read.
  const itemOwner = getOwner();
  let compared: Accessor<boolean> | undefined;
  const matchesSelectedValue = () => {
    if (!store.context.customItemEquality()) {
      return store.context.selectedMembership(itemValue());
    }
    compared ??= runWithOwner(itemOwner, () =>
      createMemo(() => store.select('isSelected', itemValue)),
    );
    return compared();
  };
  const itemProps = store.useState('itemProps');

  // Solid: refs are applied after this component's effects are created, so the element is a
  // signal the registration effect can wait for (React's layout effect runs after refs attach).
  const [itemElement, setItemElement] = createSignal<HTMLDivElement | null | undefined>(null, {
    ownedWrite: true,
  });

  const id = () => (rootId() != null && hasRegistered() ? `${rootId()}-${index()}` : undefined);
  const selected = () => matchesSelectedValue() && selectable();

  createLayoutEffect(
    () => ({
      shouldRun: hasRegistered() && (props.virtualized() || indexProp() != null),
      index: index(),
      element: itemElement(),
    }),
    ({ shouldRun, index: currentIndex, element }) => {
      if (!shouldRun) {
        return undefined;
      }

      const list = store.context.listRef.current;
      list[currentIndex] = element;

      return () => {
        // Solid: each effect runs its cleanup next to its own update, so a reordered item may already
        // have taken this slot; React runs every cleanup before the new registrations.
        if (list[currentIndex] === element) {
          delete list[currentIndex];
        }
      };
    },
  );

  createLayoutEffect(
    () => ({
      registered: hasRegistered(),
      hasItems: hasItems(),
      index: index(),
      itemValue: itemValue(),
    }),
    (deps) => {
      if (!deps.registered || deps.hasItems) {
        return undefined;
      }

      const visibleValues = store.context.valuesRef.current;
      visibleValues[deps.index] = deps.itemValue;

      return () => {
        // Solid: each effect runs its cleanup next to its own update, so a reordered item may already
        // have taken this slot; React runs every cleanup before the new registrations.
        if (visibleValues[deps.index] === deps.itemValue) {
          delete visibleValues[deps.index];
        }
      };
    },
  );

  createLayoutEffect(
    () => ({
      registered: hasRegistered(),
      hasItems: hasItems(),
      index: index(),
      itemValue: itemValue(),
      isItemEqualToValue: isItemEqualToValue(),
    }),
    (deps) => {
      if (!deps.registered || deps.hasItems) {
        return;
      }

      // Runs while closed as well (the list can stay mounted via `keepMounted` or a
      // force-mount) so the index tracks the item's composite position, keeping features
      // like closed-trigger typeahead in sync when the rendered order changes.
      const selectedValue = store.state.selectedValue;

      let nextIndex = store.state.selectedIndex;
      if (store.state.selectionMode === 'multiple' && Array.isArray(selectedValue)) {
        nextIndex = resolveSelectedIndex(
          deps.index,
          deps.itemValue,
          store.context.valuesRef.current,
          selectedValue,
          deps.isItemEqualToValue,
          nextIndex,
        );
      } else if (compareItemEquality(deps.itemValue, selectedValue, deps.isItemEqualToValue)) {
        nextIndex = deps.index;
      }
      store.set('selectedIndex', nextIndex);
    },
  );

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  const state: ComboboxItem.State = {
    get disabled() {
      return disabled();
    },
    get selected() {
      return selected();
    },
    get highlighted() {
      return highlighted();
    },
  };

  function commitSelection(nativeEvent: MouseEvent) {
    function selectItem() {
      store.context.handleSelection(nativeEvent, itemValue());
    }

    if (store.state.submitOnItemClick) {
      flushSync(selectItem);
      store.context.requestSubmit();
    } else {
      selectItem();
    }
  }

  const defaultProps: HTMLProps = {
    get id() {
      return id();
    },
    role: isRow ? 'gridcell' : 'option',
    get 'aria-selected'() {
      if (!selectable()) {
        return undefined;
      }
      return selected() ? 'true' : 'false';
    },
    // Focusable items steal focus from the input upon mouseup.
    // Warn if the user renders a natively focusable element like `<button>`,
    // as it should be a `<div>` instead.
    tabindex: undefined,
    // Solid: capture-phase listeners have no JSX prop form.
    ref: withCaptureListeners({
      pointerdown: (event) => {
        // The compat `mouseup` only fires for the primary pointer, so a non-primary
        // touch must not overwrite the shared ref — a mismatch would make the primary
        // pointer's release read as a drag-select and commit a second time after `click`.
        if ((event as PointerEvent).isPrimary) {
          store.context.pointerDownItemRef.current = event.currentTarget as Element;
        }
        event.preventDefault();
      },
    }),
    onMouseDown(event: MouseEvent) {
      // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
      // pointerdown. Prevent default here too so tapping an item does not blur the input.
      event.preventDefault();
    },
    onClick(event: MouseEvent) {
      if (disabled() || readOnly()) {
        return;
      }

      commitSelection(event);
    },
    onMouseUp(event: MouseEvent) {
      const pointerStartedOnItem = store.context.pointerDownItemRef.current === event.currentTarget;
      store.context.pointerDownItemRef.current = null;

      if (
        disabled() ||
        readOnly() ||
        event.button !== 0 ||
        pointerStartedOnItem ||
        !highlighted()
      ) {
        return;
      }

      commitSelection(event);
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: (el) => {
      buttonRef(el);
      listItem.setRef(el);
      setItemElement(el as HTMLDivElement | null | undefined);
    },
    state,
    // Built once: the root's item props as an accessor source, the button's
    // attributes below the part's props and its handlers above them (wrapping, as
    // `getButtonProps` did).
    props: [
      ...buttonSources.attributes,
      propsSourceMemo(itemProps),
      defaultProps,
      elementProps,
      buttonSources.handlers,
    ],
  });

  const contextValue: ComboboxItemContext = {
    selected,
    textRef,
  };

  return provideContext(ComboboxItemContext, contextValue, element);
}

/**
 * Resolves the index from the filtered items for the virtualized fallback (no `index` prop).
 * Isolated here so that the subscription to the derived-items context is only paid by
 * virtualized items.
 */
function ComboboxItemVirtualizedIndex(props: { componentProps: ComboboxItem.Props }) {
  const store = useComboboxRootContext();
  const isItemEqualToValue = store.useState('isItemEqualToValue');
  const { flatFilteredValues } = useComboboxDerivedItemsContext();

  const indexFromFilter = () =>
    findItemIndex(flatFilteredValues(), props.componentProps.value ?? null, isItemEqualToValue());

  // Only reached when `virtualized` is true (see the wrapper below).
  return (
    <ComboboxItemInner
      componentProps={props.componentProps}
      virtualized={() => true}
      indexFromFilter={indexFromFilter}
    />
  );
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItem(componentProps: ComboboxItem.Props) {
  const store = useComboboxRootContext();
  const virtualized = store.useState('virtualized');

  // `virtualized` (and whether an item provides an explicit `index`) must be stable for an
  // item's lifetime: the two branches render different components, as in React.
  if (untrack(() => virtualized() && componentProps.index == null)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return <ComboboxItemVirtualizedIndex componentProps={componentProps} />;
  }

  // Native fast path (`context/architecture/render-pipeline.md`): a listed item (no `index`, not
  // virtualized) renders its option with direct JSX; `useButton` and the composite list item
  // inlined (D32). `nativeButton` asks for a `<button>`, which keeps the slow path.
  if (
    untrack(() => !virtualized() && componentProps.index == null) &&
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton) !== true
  ) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return NativeComboboxItem(componentProps, Boolean(useComboboxRowContext()));
  }

  return (
    <ComboboxItemInner
      componentProps={componentProps}
      virtualized={virtualized}
      indexFromFilter={() => undefined}
    />
  );
}

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface ComboboxItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', ComboboxItem.State>, 'id'> {
  children?: JSX.Element | undefined;
  /**
   * An optional click handler for the item when selected.
   * It fires when clicking the item with the pointer, as well as when pressing `Enter` with the keyboard if the item is highlighted when the `Input` or `List` element has focus.
   */
  onClick?: BaseUIComponentProps<'div', ComboboxItemState>['onClick'] | undefined;
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props = ComboboxItemProps;
}
