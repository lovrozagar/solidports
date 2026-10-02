/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, createRenderEffect, createSignal, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  IndexGuessBehavior,
  useCompositeListItem,
} from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { compareItemEquality, findItemIndex, resolveSelectedIndex } from '../../utils/itemEquality';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { flushSync } from '../../utils/flushSync';
import {
  useComboboxDerivedItemsContext,
  useComboboxHasItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import { ComboboxItemContext } from './ComboboxItemContext';

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
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'value',
    'index',
    'disabled',
    'nativeButton',
  ]);

  const itemValue = () => local.value ?? null;
  const indexProp = () => local.index;
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? false;

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
  const matchesSelectedValue = createMemo(() => store.select('isSelected', itemValue));
  const itemProps = store.useState('itemProps');

  // Solid: refs are applied after this component's effects are created, so the element is a
  // signal the registration effect can wait for (React's layout effect runs after refs attach).
  const [itemElement, setItemElement] = createSignal<HTMLDivElement | null | undefined>(null, {
    ownedWrite: true,
  });

  const id = () => (rootId() != null && hasRegistered() ? `${rootId()}-${index()}` : undefined);
  const selected = () => matchesSelectedValue() && selectable();

  createRenderEffect(
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

  createRenderEffect(
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

  createRenderEffect(
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

  const { getButtonProps, buttonRef } = useButton({
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
      return selectable() ? (selected() ? 'true' : 'false') : undefined;
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
    get props() {
      return [itemProps(), defaultProps, elementProps, getButtonProps];
    },
  });

  const contextValue: ComboboxItemContext = {
    selected,
    textRef,
  };

  return <ComboboxItemContext value={contextValue}>{element()}</ComboboxItemContext>;
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
    return <ComboboxItemVirtualizedIndex componentProps={componentProps} />;
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
  children?: JSX.Element;
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
