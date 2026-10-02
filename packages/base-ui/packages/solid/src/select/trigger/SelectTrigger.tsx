import { createEffect, createMemo, snapshot } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { fieldValidityMapping } from '../../field/utils/constants';
import { contains, getFloatingFocusElement } from '../../floating-ui-solid/utils';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { getPseudoElementBounds } from '../../utils/getPseudoElementBounds';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { ownerDocument } from '../../utils/owner';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { BaseUIComponentProps, NativeButtonProps, type HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { Side } from '../../utils/useAnchorPositioning';
import { SelectTriggerDataAttributes } from './SelectTriggerDataAttributes';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const BOUNDARY_OFFSET = 2;
const SELECTED_DELAY = 400;

const stateAttributesMapping: StateAttributesMapping<SelectTrigger.State> = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [SelectTriggerDataAttributes.popupSide]: side } : null,
  value: () => null,
};

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger(componentProps: SelectTrigger.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'disabled',
    'nativeButton',
  ]);
  const idProp = () => local.id;
  const disabledProp = () => Boolean(local.disabled);
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  const {
    setTouched,
    setFocused,
    validationMode,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const {
    store,
    setOpen,
    selectionRef,
    validation,
    readOnly,
    required,
    alignItemWithTriggerActiveRef,
    triggerPressedRef,
    disabled: selectDisabled,
    keyboardActiveRef,
  } = useSelectRootContext();

  const disabled = () => fieldDisabled() || selectDisabled() || disabledProp();

  const open = store.useState('open');
  const value = store.useState('value');
  const fieldRawValue = () => snapshot(value());
  const triggerProps = store.useState('triggerProps');
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  const rootId = store.useState('id');
  const hasSelectedValue = store.useState('hasSelectedValue');
  const mounted = store.useState('mounted');
  const popupSideValue = store.useState('popupSide');
  const popupSide = () => (mounted() && positionerElement() ? popupSideValue() : null);

  const id = () => idProp() ?? rootId();
  useLabelableId({ id });

  let triggerRef = null as HTMLElement | null | undefined;

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const setTriggerElement = (element: HTMLElement | null | undefined) => {
    store.set('triggerElement', element);
  };

  const timeoutFocus = useTimeout();
  const timeoutMouseDown = useTimeout();
  const selectedDelayTimeout = useTimeout();

  createEffect(open, (isOpen) => {
    if (isOpen) {
      // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
      // disabled briefly so releasing over either the selected item or a neighboring item doesn't
      // commit an accidental selection. SelectItem can still opt into unselected mouseup sooner
      // after a real drag over the item.
      selectedDelayTimeout.start(SELECTED_DELAY, () => {
        selectionRef.current.allowUnselectedMouseUp = true;
        selectionRef.current.allowSelectedMouseUp = true;
      });

      return () => {
        selectedDelayTimeout.clear();
      };
    }

    selectionRef.current = {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    };

    timeoutMouseDown.clear();

    return undefined;
  });

  const listboxId = store.useState('listboxId');
  const ariaControlsId = createMemo(() => {
    return listboxId() ?? listElement()?.id ?? getFloatingFocusElement(positionerElement())?.id;
  });

  const state: SelectTrigger.State = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
    get open() {
      return open();
    },
    get placeholder() {
      return !hasSelectedValue();
    },
    get popupSide() {
      return popupSide();
    },
    get readOnly() {
      return readOnly();
    },
    get value() {
      return value();
    },
  });

  const element = useRenderElement('button', componentProps, {
    get props() {
      return [
        triggerProps(),
        {
          get 'aria-controls'() {
            return open() ? ariaControlsId() : undefined;
          },
          get 'aria-expanded'() {
            return open() ? 'true' : 'false';
          },
          'aria-haspopup': 'listbox' as const,
          get 'aria-labelledby'() {
            return resolveAriaLabelledBy(labelId(), store.state.labelId);
          },
          get 'aria-readonly'() {
            return readOnly() ? 'true' : undefined;
          },
          get 'aria-required'() {
            return required() ? 'true' : undefined;
          },
          get id() {
            return id();
          },
          onBlur(event: FocusEvent) {
            // If focus is moving into the popup, don't count it as a blur.
            if (contains(positionerElement(), event.relatedTarget as Element | null)) {
              return;
            }

            setTouched(true);
            setFocused(false);

            if (validationMode() === 'onBlur') {
              validation.commit(fieldRawValue());
            }
          },
          onFocus(event: FocusEvent) {
            setFocused(true);

            // The popup element shouldn't obscure the focused trigger.
            if (open() && alignItemWithTriggerActiveRef.current) {
              setOpen(false, createChangeEventDetails(REASONS.none, event));
            }

            // Saves a re-render on initial click: `forceMount === true` mounts
            // the items before `open === true`. We could sync those cycles better
            // without a timeout, but this is enough for now.
            //
            // XXX: might be causing `act()` warnings.
            timeoutFocus.start(0, () => {
              store.set('forceMount', true);
            });
          },
          onKeyDown() {
            keyboardActiveRef.current = true;
          },
          onMouseDown(event: MouseEvent) {
            /* short-lived flag so popup/item logic can tell an immediate open came from the trigger, not a stray click inside the list */
            triggerPressedRef.current = true;
            requestAnimationFrame(() => {
              triggerPressedRef.current = false;
            });

            if (open()) {
              return;
            }

            const doc = ownerDocument(event.currentTarget as Element | null);

            function handleMouseUp(mouseEvent: MouseEvent) {
              if (!triggerRef) {
                return;
              }

              const mouseUpTarget = mouseEvent.target as Element | null;

              // Early return if clicked on trigger element or its children
              if (
                contains(triggerRef, mouseUpTarget) ||
                contains(store.state.positionerElement, mouseUpTarget) ||
                mouseUpTarget === triggerRef
              ) {
                return;
              }

              const bounds = getPseudoElementBounds(triggerRef);

              if (
                mouseEvent.clientX >= bounds.left - BOUNDARY_OFFSET &&
                mouseEvent.clientX <= bounds.right + BOUNDARY_OFFSET &&
                mouseEvent.clientY >= bounds.top - BOUNDARY_OFFSET &&
                mouseEvent.clientY <= bounds.bottom + BOUNDARY_OFFSET
              ) {
                return;
              }

              setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
            }

            // Firefox can fire this upon mousedown
            timeoutMouseDown.start(0, () => {
              doc.addEventListener('mouseup', handleMouseUp, { once: true });
            });
          },
          onPointerMove() {
            keyboardActiveRef.current = false;
          },
          role: 'combobox' as const,
          get tabindex() {
            return disabled() ? -1 : 0;
          },
        },
        getButtonProps,
        validation.getValidationProps(disabled(), elementProps as HTMLProps),
        /* prevent nested useButton from overwriting the combobox role, e.g. <Toolbar.Button render={<Select.Trigger />} /> */
        { role: 'combobox' as const },
      ];
    },
    ref: (el) => {
      triggerRef = el;
      buttonRef(el);
      setTriggerElement(el);
    },
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface SelectTriggerState extends FieldRoot.State {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: unknown;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', SelectTrigger.State> {
  children?: JSX.Element;
  /** Whether the component should ignore user interaction. */
  disabled?: boolean | undefined;
}

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props = SelectTriggerProps;
}
