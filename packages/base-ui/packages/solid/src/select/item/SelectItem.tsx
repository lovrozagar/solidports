import {
  createEffect,
  createMemo,
  createRenderEffect,
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
  createDepsRenderEffect,
  omitComponentProps,
  useRef,
  provideContext,
} from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isVirtualClick } from '../../floating-ui-solid/utils/event';
import { compareItemEquality, removeItem, resolveSelectedIndex } from '../../utils/itemEquality';
import { REASONS } from '../../utils/reasons';
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
import { useSelectRootContext } from '../root/SelectRootContext';
import type { SelectRootContext } from '../root/SelectRootContext';
import { SelectItemContext } from './SelectItemContext';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['value', 'label', 'disabled', 'nativeButton']);
const OPTION: Record<string, unknown> = { role: 'option' };
const GUESS_INDEX_OPTIONS = { guessIndex: true } as const;

type ItemEvent<T extends Event> = BaseUIEvent<T>;

/**
 * The item's state, as `class`/`style` functions and its `data-*` attributes read it: prototype
 * getters over the item, each selection read once per write pass (a keyed read registers a release
 * per read, and the attribute write reads them too).
 */
class NativeSelectItemState implements SelectItem.State {
  declare private readonly item: NativeSelectItemModel;
  declare private pass: number;
  declare private cachedHighlighted: boolean;
  declare private cachedSelected: boolean;

  constructor(item: NativeSelectItemModel) {
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

  get highlighted() {
    this.read();
    return this.cachedHighlighted;
  }

  get selected() {
    this.read();
    return this.cachedSelected;
  }
}

/**
 * A native open option: its model, the target of its module-level handlers and attribute write,
 * and the value its item parts read through `SelectItemContext`. One object per item.
 */
class NativeSelectItemModel implements SelectItemContext {
  declare readonly props: SelectItem.Props;
  declare readonly root: SelectRootContext;
  declare readonly index: Accessor<number>;
  declare readonly textRef: { current: HTMLElement | null | undefined };
  declare readonly indexRef: { current: number };
  declare element: HTMLDivElement | null;
  declare pointerType: 'mouse' | 'touch' | 'pen';
  declare allowMouseSelection: boolean;
  /** The `valuesRef` slot this item last wrote, so a move or an unmount clears only its own. */
  declare registeredIndex: number;
  declare registeredValue: unknown;
  declare readonly state: NativeSelectItemState;

  constructor(props: SelectItem.Props, root: SelectRootContext, index: Accessor<number>) {
    this.props = props;
    this.root = root;
    this.index = index;
    this.textRef = { current: null };
    this.indexRef = { current: 0 };
    this.element = null;
    this.pointerType = 'mouse';
    this.allowMouseSelection = false;
    this.registeredIndex = -1;
    this.registeredValue = undefined;
    this.state = new NativeSelectItemState(this);
    this.owner = getOwner();
    this.compared = undefined;
  }

  /**
   * The item's selection: its value's entry in the root's keyed membership, so a selection change
   * re-runs only the items that joined or left it (D32's batch 1 regate: every item re-reading the
   * whole value took select/multiple-1000's toggle 50 from 86 to 188 ms). A custom
   * `isItemEqualToValue` cannot be keyed: the item then compares in a memo of its own.
   */
  readonly selected = (): boolean => {
    const { root } = this;
    if (!root.customItemEquality()) {
      return root.selectedMembership(this.value());
    }
    this.compared ??= runWithOwner(this.owner, () =>
      createMemo(() => root.store.select('isSelected', () => this.value())),
    );
    return this.compared();
  };

  value() {
    return this.props.value ?? null;
  }

  disabled() {
    return this.root.disabled() || Boolean(this.props.disabled);
  }

  readonly hasRegistered = () => this.index() !== -1;

  declare private readonly owner: Owner | null;
  declare private compared: Accessor<boolean> | undefined;

  readonly selectedByFocus = () => this.root.store.select('isSelectedByFocus', this.index);

  highlighted() {
    return this.root.store.select('isActive', this.index);
  }

  /** The values slot and the selected-index claim (React's two layout effects), in that order. */
  register(deps: ItemRegistration) {
    const values = this.root.valuesRef.current;
    if (this.registeredIndex !== -1 && values[this.registeredIndex] === this.registeredValue) {
      delete values[this.registeredIndex];
    }
    this.registeredIndex = -1;
    if (!deps.registered) {
      return;
    }
    values[deps.index] = deps.value;
    this.registeredIndex = deps.index;
    this.registeredValue = deps.value;
    this.indexRef.current = deps.index;

    const { store, selectedItemTextRef, valuesRef } = this.root;
    const selectedValue = store.state.value;
    const currentIndex = store.state.selectedIndex;
    let nextIndex = currentIndex;
    let claims: boolean;
    if (deps.multiple && Array.isArray(selectedValue)) {
      // The claiming item also owns the text ref that aligns the popup.
      nextIndex = resolveSelectedIndex(
        deps.index,
        deps.value,
        valuesRef.current,
        selectedValue,
        deps.isItemEqualToValue,
        currentIndex,
      );
      claims = nextIndex === deps.index;
      if (deps.index === currentIndex && !claims) {
        selectedItemTextRef.current = null;
      }
    } else {
      claims =
        selectedValue !== undefined &&
        compareItemEquality(deps.value, selectedValue, deps.isItemEqualToValue);
      if (claims) {
        nextIndex = deps.index;
      }
    }
    store.set('selectedIndex', nextIndex);
    // Make sure SelectPopup can measure the selected item on first open.
    if (claims && this.textRef.current) {
      selectedItemTextRef.current = this.textRef.current;
    }
  }

  unregister() {
    const values = this.root.valuesRef.current;
    if (this.registeredIndex !== -1 && values[this.registeredIndex] === this.registeredValue) {
      delete values[this.registeredIndex];
    }
    this.registeredIndex = -1;
  }

  commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    const { store, readOnly, multiple, setValue, setOpen } = this.root;
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even when the
    // root is disabled or read-only, so guard the commit here too.
    if (this.root.disabled() || readOnly()) {
      return;
    }
    const selectedValue = store.state.value;
    const isItemEqualToValue = store.state.isItemEqualToValue;
    if (multiple()) {
      const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
      const nextValue = this.selected()
        ? removeItem(currentValue, this.value(), isItemEqualToValue)
        : [...currentValue, this.value()];
      setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
    } else {
      // Set the selected index with the value (the root derives the same one after closing), so
      // readers see both in the same flush.
      store.set('selectedIndex', this.index());
      setValue(this.value(), createChangeEventDetails(REASONS.itemPress, event));
      setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
    }
  }

  keyDown(event: ItemEvent<KeyboardEvent>) {
    this.root.store.set('activeIndex', this.index());
    if (event.key === ' ' && this.root.typingRef.current) {
      // Space activation skips `role="option"` items when the keydown is `defaultPrevented`,
      // keeping typeahead spaces from committing a selection.
      event.preventDefault();
    }
  }

  click(event: ItemEvent<MouseEvent>) {
    const isMouseClick = this.pointerType !== 'touch';
    const clickPointerType = (event as unknown as PointerEvent).pointerType;
    const isVirtualMouseClick =
      isMouseClick &&
      isVirtualClick(event) &&
      // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual clicks that
      // carry browser pointer data, including an empty string from assistive technology, can
      // activate unhighlighted items.
      (clickPointerType !== undefined || untrack(() => this.highlighted()));
    // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse clicks
    // must start on the item, while virtual clicks represent explicit keyboard or assistive
    // technology activation.
    const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !this.allowMouseSelection;
    this.allowMouseSelection = false;
    if (this.disabled() || isInvalidMouseClick) {
      return;
    }
    this.commitSelection(event);
  }

  pointerEnter(event: PointerEvent) {
    this.pointerType = event.pointerType as 'mouse' | 'touch' | 'pen';
  }

  pointerMove(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.buttons === 1) {
      const selection = this.root.selectionRef.current;
      selection.dragY += event.movementY;
      if (selection.dragY ** 2 >= 64) {
        selection.allowUnselectedMouseUp = true;
      }
    }
  }

  pointerDown(event: PointerEvent) {
    this.pointerType = event.pointerType as 'mouse' | 'touch' | 'pen';
    this.allowMouseSelection = true;
    this.root.selectionRef.current.dragY = 0;
  }

  mouseUp() {
    const selectionRef = this.root.selectionRef;
    selectionRef.current.dragY = 0;
    if (this.disabled() || this.pointerType === 'touch') {
      return;
    }
    // Regular clicks are committed by the click event.
    if (this.allowMouseSelection) {
      return;
    }
    const selected = untrack(this.selected);
    const disallowSelectedMouseUp = !selectionRef.current.allowSelectedMouseUp && selected;
    const disallowUnselectedMouseUp = !selectionRef.current.allowUnselectedMouseUp && !selected;
    if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
      return;
    }
    this.allowMouseSelection = true;
    this.element?.click();
    this.allowMouseSelection = false;
  }
}

interface ItemRegistration {
  registered: boolean;
  index: number;
  value: unknown;
  multiple: boolean;
  isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;
}

/** The registration inputs: tracked by the item's one registration effect. */
function readRegistration(item: NativeSelectItemModel): ItemRegistration {
  const index = item.index();
  return {
    registered: index !== -1,
    index,
    value: item.value(),
    multiple: item.root.multiple(),
    isItemEqualToValue: item.root.store.state.isItemEqualToValue,
  };
}

/** The root's list navigation handler for `key` (none until the interactions are created). */
function callListNavigation(item: NativeSelectItemModel, key: string, event: Event) {
  const handler = readHandler(item.root.itemProps, key);
  if (handler) {
    handler(event);
  }
}

/** `useFocusableWhenDisabled`'s keydown: a disabled item keeps Tab and blocks every other key. */
function preventKeysWhileDisabled(item: NativeSelectItemModel, event: KeyboardEvent) {
  if (item.disabled() && event.key !== 'Tab') {
    event.preventDefault();
  }
}

/**
 * `useButton`'s keydown after the lower-priority handlers, for a non-native composite item that
 * is not a link: Space and Enter click the item (Space unless typeahead prevented it).
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
function preventWhileDisabled(item: NativeSelectItemModel, event: Event) {
  if (item.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

/**
 * A native item's handlers, in the slow path's `mergeProps` order (the button's wrappers, then the
 * consumer's, then the item's own, then the root's list navigation), created once.
 */
const ITEM_HANDLERS: Readonly<Record<string, Dispatch<NativeSelectItemModel>>> = {
  onClick: partHandler<NativeSelectItemModel, MouseEvent>(
    'onClick',
    (item, event) => {
      item.click(event);
      callListNavigation(item, 'onClick', event);
    },
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<NativeSelectItemModel, KeyboardEvent>(
    'onKeyDown',
    (item, event) => {
      item.keyDown(event);
      compositeItemKeyDownAfter(event);
    },
    (item, event) => {
      preventKeysWhileDisabled(item, event);
      return !item.disabled();
    },
  ),
  onPointerDown: partHandler<NativeSelectItemModel, PointerEvent>(
    'onPointerDown',
    (item, event) => item.pointerDown(event),
    preventWhileDisabled,
  ),
  onFocus: partHandler<NativeSelectItemModel, FocusEvent>('onFocus', (item, event) =>
    callListNavigation(item, 'onFocus', event),
  ),
  onMouseMove: partHandler<NativeSelectItemModel, MouseEvent>('onMouseMove', (item, event) =>
    callListNavigation(item, 'onMouseMove', event),
  ),
  onPointerLeave: partHandler<NativeSelectItemModel, PointerEvent>(
    'onPointerLeave',
    (item, event) => callListNavigation(item, 'onPointerLeave', event),
  ),
  onPointerEnter: partHandler<NativeSelectItemModel, PointerEvent>(
    'onPointerEnter',
    (item, event) => item.pointerEnter(event),
  ),
  onPointerMove: partHandler<NativeSelectItemModel, PointerEvent>('onPointerMove', (item, event) =>
    item.pointerMove(event),
  ),
  onMouseUp: partHandler<NativeSelectItemModel, MouseEvent>('onMouseUp', (item) => item.mouseUp()),
};

/** Bound only when the consumer passes them: `useButton`'s gates around the consumer's handler. */
const ITEM_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativeSelectItemModel>>> = {
  onKeyUp: partHandler<NativeSelectItemModel>('onKeyUp', undefined, (item) => !item.disabled()),
  onMouseDown: partHandler<NativeSelectItemModel>(
    'onMouseDown',
    undefined,
    (item) => !item.disabled(),
  ),
};

/** The state's `data-*` attributes in the slow path's key order. */
const writeItemState = compileStateWriter(['disabled', 'highlighted', 'selected'], undefined);

/** The option's own attributes below the consumer's: one write per pass. */
function writeItemAttributes(w: SetAttribute, item: NativeSelectItemModel) {
  const state = item.state;
  w.set('aria-selected', state.selected ? 'true' : 'false');
  w.set('tabindex', item.root.store.state.open && state.highlighted ? 0 : -1);
  // `useFocusableWhenDisabled` for a non-native composite item.
  w.set('aria-disabled', state.disabled ? 'true' : undefined);
}

const itemState = (item: NativeSelectItemModel) => item.state;

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem(componentProps: SelectItem.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): the `<div>` option rendered with
  // direct JSX; `useButton`, the composite list item and the merged list navigation props inlined
  // (D32). `nativeButton` asks for a `<button>`, which keeps the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton) !== true
  ) {
    return NativeSelectItem(componentProps);
  }

  const elementProps = omitComponentProps(componentProps, [
    'value',
    'label',
    'disabled',
    'nativeButton',
  ] as const);
  const itemValue = () => componentProps.value ?? null;
  const disabledProp = () => Boolean(componentProps.disabled);
  const nativeButton = () => Boolean(componentProps.nativeButton);

  const textRef = useRef<HTMLDivElement | null | undefined>(null);
  const listItem = useCompositeListItem({
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
    label: () => componentProps.label,
    textRef: () => textRef.current,
  });

  const {
    store,
    itemProps,
    setOpen,
    setValue,
    selectionRef,
    typingRef,
    valuesRef,
    selectedItemTextRef,
    multiple,
    disabled: selectDisabled,
    readOnly,
  } = useSelectRootContext();

  const disabled = () => selectDisabled() || disabledProp();

  const highlighted = store.useState('isActive', listItem.index);
  const selected = store.useState('isSelected', itemValue);
  const selectedByFocus = store.useState('isSelectedByFocus', listItem.index);
  const isItemEqualToValue = store.useState('isItemEqualToValue');

  const index = listItem.index;
  const hasRegistered = () => index() !== -1;

  const indexRef = useRef(0);
  createEffect(index, (currentIndex) => {
    indexRef.current = currentIndex;
  });

  // React registers item values in a layout effect, ahead of the list's map change.
  createDepsRenderEffect(
    () => ({ registered: hasRegistered(), index: index(), value: itemValue() }),
    (deps) => {
      if (!deps.registered) {
        return undefined;
      }

      const values = untrack(() => valuesRef.current);
      values[deps.index] = deps.value;

      return () => {
        // Solid: each effect runs its cleanup next to its own update, so a reordered item may already
        // have taken this slot; React runs every cleanup before the new registrations.
        if (values[deps.index] === deps.value) {
          delete values[deps.index];
        }
      };
    },
  );

  createDepsRenderEffect(
    () => ({
      registered: hasRegistered(),
      index: index(),
      multiple: multiple(),
      isItemEqualToValue: isItemEqualToValue(),
      itemValue: itemValue(),
    }),
    (deps) => {
      if (!deps.registered) {
        return;
      }

      untrack(() => {
        const selectedValue = store.state.value;
        const currentIndex = store.state.selectedIndex;
        let nextIndex = currentIndex;
        let claims: boolean;
        if (deps.multiple && Array.isArray(selectedValue)) {
          // The claiming item also owns the text ref that aligns the popup.
          nextIndex = resolveSelectedIndex(
            deps.index,
            deps.itemValue,
            valuesRef.current,
            selectedValue,
            deps.isItemEqualToValue,
            currentIndex,
          );
          claims = nextIndex === deps.index;
          if (deps.index === currentIndex && !claims) {
            selectedItemTextRef.current = null;
          }
        } else {
          claims =
            selectedValue !== undefined &&
            compareItemEquality(deps.itemValue, selectedValue, deps.isItemEqualToValue);
          if (claims) {
            nextIndex = deps.index;
          }
        }
        store.set('selectedIndex', nextIndex);

        // Make sure SelectPopup can measure the selected item on first open.
        // SelectItemText can still update this ref later when focus moves.
        if (claims && textRef.current) {
          selectedItemTextRef.current = textRef.current;
        }
      });
    },
  );

  const state: SelectItem.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get selected() {
      return selected();
    },
  };

  // React spreads list navigation's item props (focus/hover sync, `onFocus` included) without the
  // item states: the root's one live view, shared by every item.
  const rootProps = itemProps;

  let pointerTypeRef = 'mouse' as 'mouse' | 'touch' | 'pen';
  let allowMouseSelectionRef = false;
  let itemRef = null as HTMLDivElement | null | undefined;

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if (selectDisabled() || readOnly()) {
      return;
    }

    const selectedValue = store.state.value;
    if (multiple()) {
      const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
      const nextValue = selected()
        ? removeItem(currentValue, itemValue(), isItemEqualToValue())
        : [...currentValue, itemValue()];
      setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
    } else {
      // Set the selected index with the value (the root derives the same one after closing), so
      // readers see both in the same flush.
      store.set('selectedIndex', index());
      setValue(itemValue(), createChangeEventDetails(REASONS.itemPress, event));
      setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
    }
  }

  function resetDragMovement() {
    selectionRef.current.dragY = 0;
  }

  const defaultProps: HTMLProps = {
    role: 'option',
    get 'aria-selected'() {
      return selected() ? 'true' : 'false';
    },
    get tabindex() {
      return store.state.open && highlighted() ? 0 : -1;
    },
    onKeyDown(event: KeyboardEvent) {
      store.set('activeIndex', index());

      if (event.key === ' ' && typingRef.current) {
        // `useButton` skips Space activation for `role="option"` items when the keydown
        // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      const isMouseClick = pointerTypeRef !== 'touch';
      const clickPointerType = (event as PointerEvent).pointerType;
      const isVirtualMouseClick =
        isMouseClick &&
        isVirtualClick(event) &&
        // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
        // clicks that carry browser pointer data, including an empty string from assistive
        // technology, can activate unhighlighted items.
        (clickPointerType !== undefined || highlighted());
      // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
      // clicks must start on the item, while virtual clicks represent explicit keyboard or
      // assistive technology activation.
      const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelectionRef;

      allowMouseSelectionRef = false;

      if (disabled() || isInvalidMouseClick) {
        return;
      }

      commitSelection(event);
    },
    onPointerEnter(event: PointerEvent) {
      pointerTypeRef = event.pointerType as 'mouse' | 'touch' | 'pen';
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.buttons === 1) {
        const selection = selectionRef.current;
        selection.dragY += event.movementY;

        if (selection.dragY ** 2 >= 64) {
          selection.allowUnselectedMouseUp = true;
        }
      }
    },
    onPointerDown(event: PointerEvent) {
      pointerTypeRef = event.pointerType as 'mouse' | 'touch' | 'pen';
      allowMouseSelectionRef = true;
      resetDragMovement();
    },
    onMouseUp() {
      resetDragMovement();

      if (disabled() || pointerTypeRef === 'touch') {
        return;
      }

      // Regular clicks are committed by the click event.
      if (allowMouseSelectionRef) {
        return;
      }

      const disallowSelectedMouseUp = !selectionRef.current.allowSelectedMouseUp && selected();
      const disallowUnselectedMouseUp = !selectionRef.current.allowUnselectedMouseUp && !selected();

      if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
        return;
      }

      allowMouseSelectionRef = true;
      itemRef?.click();
      allowMouseSelectionRef = false;
    },
  };

  const element = useRenderElement('div', componentProps, {
    // Built once: the button's attributes below, its handlers above (wrapping).
    props: [
      ...buttonSources.attributes,
      rootProps,
      defaultProps,
      elementProps,
      buttonSources.handlers,
    ],
    ref: (el) => {
      buttonRef(el);
      listItem.setRef(el);
      itemRef = el as HTMLDivElement | null | undefined;
    },
    state,
  });

  const contextValue: SelectItemContext = {
    hasRegistered,
    index,
    indexRef,
    selected,
    selectedByFocus,
    textRef,
  };

  return provideContext(SelectItemContext, contextValue, element);
}

function NativeSelectItem(props: SelectItem.Props): JSX.Element {
  const root = useSelectRootContext();
  let item: NativeSelectItemModel | undefined;
  const listItem = createNativeListItem<null>(null, {
    ...GUESS_INDEX_OPTIONS,
    label: () => props.label,
    textRef: () => item!.textRef.current,
  });
  item = new NativeSelectItemModel(props, root, listItem.index);
  const model = item;
  createRenderEffect(
    () => readRegistration(model),
    (deps) => untrack(() => model.register(deps)),
  );
  void onCleanup(() => model.unregister());

  const el = (<div />) as unknown as HTMLDivElement;
  return provideNativeContext(SelectItemContext, model as SelectItemContext, () =>
    renderNativeElement(el, props, {
      own: OWN_KEYS,
      state: itemState,
      stateWriter: writeItemState,
      stateView: model.state,
      reactive: true,
      literal: OPTION,
      attributes: writeItemAttributes,
      handlers: ITEM_HANDLERS,
      handlersIfPassed: ITEM_HANDLERS_IF_PASSED,
      handlerTarget: model,
      refs: [
        listItem.setRef,
        (node: HTMLDivElement | null) => {
          model.element = node;
        },
      ],
    }),
  ) as unknown as JSX.Element;
}

export interface SelectItemState {
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

export interface SelectItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', SelectItem.State>, 'id'> {
  children?: JSX.Element | undefined;
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props = SelectItemProps;
}
