/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createMemo, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  IndexGuessBehavior,
  useCompositeListItem,
} from '../../internals/composite/list/useCompositeListItem';
import { createDepsRenderEffect, splitComponentProps, useRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isVirtualClick } from '../../floating-ui-solid/utils/event';
import { isMouseWithinBounds } from '../../utils/isMouseWithinBounds';
import { compareItemEquality, removeItem, resolveSelectedIndex } from '../../utils/itemEquality';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { useSelectRootContext } from '../root/SelectRootContext';
import { SelectItemContext } from './SelectItemContext';

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem(componentProps: SelectItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'value',
    'label',
    'disabled',
    'nativeButton',
  ]);
  const itemValue = () => local.value ?? null;
  const disabledProp = () => Boolean(local.disabled);
  const nativeButton = () => Boolean(local.nativeButton);

  const textRef = useRef<HTMLDivElement | null | undefined>(null);
  const listItem = useCompositeListItem({
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
    label: () => local.label,
    textRef: () => textRef.current,
  });

  const {
    store,
    getItemProps,
    setOpen,
    setValue,
    popupRef,
    selectionRef,
    typingRef,
    valuesRef,
    selectedItemTextRef,
    keyboardActiveRef,
    multiple,
    highlightItemOnHover,
    disabled: selectDisabled,
    readOnly,
  } = useSelectRootContext();

  const highlightTimeout = useTimeout();
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

  const rootProps = createMemo(() => {
    const props = getItemProps({ active: highlighted(), selected: selected() });
    // With our custom `focusItemOnHover` implementation, this interferes with the logic and can
    // cause the index state to be stuck when leaving the select popup.
    props.onFocus = undefined;
    props.id = undefined;
    return props;
  });

  let pointerTypeRef = 'mouse' as 'mouse' | 'touch' | 'pen';
  let allowMouseSelectionRef = false;
  let itemRef = null as HTMLDivElement | null | undefined;

  const { getButtonProps, buttonRef } = useButton({
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
    // Solid: the root's list navigation props do not cover hover highlighting for Select items.
    onFocus() {
      store.set('activeIndex', index());
    },
    onMouseEnter() {
      if (
        !keyboardActiveRef.current &&
        store.state.selectedIndex === null &&
        highlightItemOnHover()
      ) {
        store.set('activeIndex', index());
      }
    },
    onMouseLeave(event: MouseEvent) {
      if (!highlightItemOnHover() || keyboardActiveRef.current || isMouseWithinBounds(event)) {
        return;
      }

      highlightTimeout.start(0, () => {
        if (store.state.activeIndex === index()) {
          store.set('activeIndex', null);
        }
      });
    },
    onMouseMove() {
      if (highlightItemOnHover()) {
        store.set('activeIndex', index());
      }
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
    get props() {
      return [rootProps(), defaultProps, elementProps, getButtonProps];
    },
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

  return <SelectItemContext value={contextValue}>{element()}</SelectItemContext>;
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
  children?: JSX.Element;
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
