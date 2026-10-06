/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo } from 'solid-js';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useClick, useTypeahead } from '../../floating-ui-solid';
import { contains, getTarget, stopEvent } from '../../floating-ui-solid/utils';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { BaseUIComponentProps, NativeButtonProps, type HTMLProps } from '../../utils/types';
import type { Side } from '../../utils/useAnchorPositioning';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import {
  useComboboxFloatingContext,
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { getComboboxPopupId } from '../root/utils';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxTrigger(componentProps: ComboboxTrigger.Props) {
  const elementProps = omitComponentProps(componentProps, [
    'nativeButton',
    'disabled',
    'id',
  ] as const);
  const nativeButton = () => componentProps.nativeButton ?? true;
  const disabledProp = () => componentProps.disabled ?? false;
  const idProp = () => componentProps.id;

  const {
    state: fieldState,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useComboboxRootContext();

  const selectionMode = store.useState('selectionMode');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const required = store.useState('required');
  const positionerElement = store.useState('positionerElement');
  const listId = store.useState('listId');
  const storedPopupId = store.useState('popupId');
  const triggerProps = store.useState('triggerProps');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const rootId = store.useState('id');
  const comboboxLabelId = store.useState('labelId');
  const open = store.useState('open');
  const selectedValue = store.useState('selectedValue');
  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const floatingRootContext = useComboboxFloatingContext();
  const inputValue = useComboboxInputValueContext();

  const focusTimeout = useTimeout();

  const disabled = () => fieldDisabled() || comboboxDisabled() || disabledProp();
  const listEmpty = useListEmpty();
  const popupSide = usePopupSide(store);

  useLabelableId({ id: () => (inputInsidePopup() ? idProp() : undefined) });
  const id = () => (inputInsidePopup() ? (idProp() ?? rootId()) : idProp());
  const ariaLabelledBy = () => resolveAriaLabelledBy(fieldLabelId(), comboboxLabelId());

  const ariaControls = () => {
    if (open() && inputInsidePopup()) {
      // Fall back to the default id while the popup registers its own (custom ids are stored once
      // the popup mounts), so `aria-controls` is set as soon as `open` becomes `true`.
      return storedPopupId() ?? getComboboxPopupId(rootId());
    }
    if (open()) {
      // Solid: the list id is reactive store state (see `State.listId`).
      return listId();
    }
    return undefined;
  };

  let currentPointerTypeRef: PointerEvent['pointerType'] = '';

  function trackPointerType(event: PointerEvent) {
    currentPointerTypeRef = event.pointerType;
  }

  const triggerTypeahead = useTypeahead({
    get context() {
      return floatingRootContext;
    },
    props: {
      // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
      // gated on `readOnly`.
      get enabled() {
        return !open() && !readOnly() && !comboboxDisabled() && selectionMode() === 'single';
      },
      get listRef() {
        return store.context.labelsRef.current;
      },
      get activeIndex() {
        return activeIndex();
      },
      get selectedIndex() {
        return selectedIndex();
      },
      onMatch(index) {
        const nextSelectedValue = store.context.valuesRef.current[index];
        if (nextSelectedValue !== undefined) {
          store.context.setSelectedValue(nextSelectedValue, createChangeEventDetails(REASONS.none));
        }
      },
    },
  });

  const triggerClick = useClick({
    get context() {
      return floatingRootContext;
    },
    props: {
      get enabled() {
        return !comboboxDisabled();
      },
      event: 'mousedown',
    },
  });

  const { buttonSources, buttonRef } = useButton({
    native: nativeButton,
    disabled,
  });

  const state: ComboboxTrigger.State = solidMergeProps(fieldState, {
    get readOnly() {
      return readOnly();
    },
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
    get placeholder() {
      return selectionMode() === 'none' ? false : !hasSelectedValue();
    },
  });

  const setTriggerElement = (element: HTMLElement | null | undefined) => {
    store.set('triggerElement', element);
  };

  // Read per key by the element props: a change does not rebuild the props chain.
  const triggerPropsSource = propsSourceAccessor(() => triggerProps());
  const validationPropsSource = propsSourceAccessor(
    createMemo(() => validation.getValidationProps(disabled(), elementProps as HTMLProps)),
  );
  const element = useRenderElement('button', componentProps, {
    ref: (el) => {
      buttonRef(el);
      setTriggerElement(el);
    },
    state,
    props: [
      ...buttonSources.attributes,
      triggerPropsSource,
      propsSourceAccessor(() => triggerClick.reference),
      propsSourceAccessor(() => triggerTypeahead.reference),
      {
        get id() {
          return id();
        },
        get tabindex() {
          return inputInsidePopup() ? 0 : -1;
        },
        get role() {
          return inputInsidePopup() ? 'combobox' : undefined;
        },
        get 'aria-expanded'() {
          return open() ? 'true' : 'false';
        },
        get 'aria-haspopup'() {
          return inputInsidePopup() ? 'dialog' : 'listbox';
        },
        get 'aria-controls'() {
          return ariaControls();
        },
        get 'aria-required'() {
          return inputInsidePopup() && required() ? 'true' : undefined;
        },
        // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
        // the `Combobox.Input` outside the popup already carries `aria-readonly`.
        get 'aria-readonly'() {
          return inputInsidePopup() && readOnly() ? 'true' : undefined;
        },
        get 'aria-labelledby'() {
          return ariaLabelledBy();
        },
        onPointerDown: trackPointerType,
        onPointerEnter: trackPointerType,
        onFocus() {
          setFocused(true);

          if (disabled()) {
            return;
          }

          focusTimeout.start(0, store.context.forceMount);
        },
        onBlur(event: FocusEvent) {
          // If focus is moving into the popup, don't count it as a blur.
          if (contains(positionerElement(), event.relatedTarget as Element | null)) {
            return;
          }

          setTouched(true);
          setFocused(false);

          if (validationMode() === 'onBlur') {
            const valueToValidate = selectionMode() === 'none' ? inputValue() : selectedValue();
            validation.commit(valueToValidate);
          }
        },
        onMouseDown(event: MouseEvent) {
          if (disabled()) {
            return;
          }

          if (!inputInsidePopup()) {
            floatingRootContext.set('domReferenceElement', event.currentTarget as Element);
          }

          // Ensure items are registered for initial selection highlight.
          store.context.forceMount();

          if (currentPointerTypeRef !== 'touch') {
            store.context.inputRef.current?.focus();

            if (!inputInsidePopup()) {
              event.preventDefault();
            }
          }

          if (open()) {
            return;
          }

          const doc = ownerDocument(event.currentTarget as Element | null);

          function handleMouseUp(mouseEvent: MouseEvent) {
            const currentTriggerElement = store.state.triggerElement;
            if (!currentTriggerElement) {
              return;
            }

            const mouseUpTarget = getTarget(mouseEvent) as Element | null;
            const positioner = store.state.positionerElement;
            const list = store.state.listElement;

            if (
              contains(currentTriggerElement, mouseUpTarget) ||
              contains(positioner, mouseUpTarget) ||
              contains(list, mouseUpTarget)
            ) {
              return;
            }

            if (isMouseWithinBounds(mouseEvent, currentTriggerElement)) {
              return;
            }

            store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
          }

          if (inputInsidePopup()) {
            doc.addEventListener('mouseup', handleMouseUp, { once: true });
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            stopEvent(event);
            store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
            store.context.inputRef.current?.focus();
          }
        },
      },
      validationPropsSource,
      buttonSources.handlers,
    ],
    stateAttributesMapping: triggerStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ComboboxTriggerState extends FieldRoot.State {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxTrigger.State> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props = ComboboxTriggerProps;
}
