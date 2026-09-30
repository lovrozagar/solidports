/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import {
  batch,
  createEffect,
  on,
  onMount,
  mergeProps as solidMergeProps,
  type JSX,
} from 'solid-js';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useField } from '../../field/useField';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { mergeProps } from '../../merge-props';
import { splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../types';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { SwitchRootContext } from './SwitchRootContext';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchRoot(componentProps: SwitchRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'checked',
    'defaultChecked',
    'aria-labelledby',
    'form',
    'id',
    'inputRef',
    'name',
    'nativeButton',
    'onCheckedChange',
    'readOnly',
    'required',
    'disabled',
    'uncheckedValue',
    'value',
  ]);
  const checkedProp = () => local.checked;
  const idProp = () => local.id;
  const nameProp = () => local.name;
  const formProp = () => local.form;
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const nativeButton = () => local.nativeButton ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const disabledProp = () => local.disabled ?? false;

  const { clearErrors } = useFormContext();
  const {
    state: fieldState,
    setTouched,
    setDirty,
    validityData,
    setFilled,
    setFocused,
    shouldValidateOnChange,
    validationMode,
    disabled: fieldDisabled,
    name: fieldName,
    validation,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  const disabled = () => fieldDisabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();

  const onCheckedChange: Exclude<typeof local.onCheckedChange, undefined> = (checked, event) => {
    local.onCheckedChange?.(checked, event);
  };

  let inputRef = null as HTMLInputElement | null | undefined;
  let lastClickEvent: PointerEvent | undefined;
  let switchRef = null as HTMLButtonElement | null | undefined;

  const id = useBaseUiId();

  const controlId = useLabelableId({
    controlRef: switchRef,
    id: idProp,
    implicit: false,
  });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, () => inputRef, !nativeButton(), hiddenInputId);

  const [checked, setCheckedState] = useControlled({
    controlled: checkedProp,
    default: () => Boolean(local.defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  useField({
    commit: validation.commit,
    controlRef: () => switchRef,
    getValue: checked,
    id,
    name,
    value: checked,
  });

  onMount(() => {
    if (inputRef) {
      setFilled(inputRef.checked);
    }
  });

  createEffect(
    on(
      checked,
      (checkedValue) => {
        clearErrors(name());
        setDirty(checkedValue !== validityData.initialValue);
        setFilled(checkedValue);

        if (shouldValidateOnChange()) {
          validation.commit(checkedValue);
        } else {
          validation.commit(checkedValue, true);
        }
      },
      { defer: true },
    ),
  );

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const rootProps: JSX.HTMLAttributes<HTMLSpanElement> = {
    get 'aria-checked'() {
      return checked();
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-required'() {
      return required() || undefined;
    },
    get id() {
      return nativeButton() ? controlId() : id();
    },
    onBlur() {
      if (!inputRef || disabled()) {
        return;
      }

      batch(() => {
        setTouched(true);
        setFocused(false);

        if (validationMode() === 'onBlur') {
          validation.commit(inputRef?.checked);
        }
      });
    },
    onClick(event) {
      if (readOnly() || disabled()) {
        return;
      }

      event.preventDefault();

      const clickEvent = new PointerEvent('click', {
        bubbles: true,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
      lastClickEvent = clickEvent;
      inputRef?.dispatchEvent(clickEvent);
    },
    onFocus() {
      if (!disabled()) {
        setFocused(true);
      }
    },
    role: 'switch',
  };

  const inputProps = mergeProps<'input'>(
    {
      'aria-hidden': true,
      get checked() {
        return checked();
      },
      get disabled() {
        return disabled();
      },
      get form() {
        return formProp();
      },
      get id() {
        return hiddenInputId();
      },
      get name() {
        return name();
      },
      onChange(event) {
        // Workaround for https://github.com/facebook/react/issues/9023
        if (event.defaultPrevented) {
          return;
        }

        batch(() => {
          const nextChecked = event.target.checked;

          const eventDetails = createChangeEventDetails(REASONS.none, lastClickEvent ?? event);
          lastClickEvent = undefined;

          onCheckedChange?.(nextChecked, eventDetails);

          if (eventDetails.isCanceled) {
            return;
          }

          setCheckedState(nextChecked);
        });
      },
      onFocus() {
        switchRef?.focus();
      },
      ref: (el) => {
        inputRef = el;
        validation.inputRef.current = el;
        if (local.inputRef) {
          local.inputRef.current = el;
        }
      },
      get required() {
        return required();
      },
      get style() {
        return name() ? visuallyHiddenInput : visuallyHidden;
      },
      tabIndex: -1,
      type: 'checkbox',
    },
    validation.getInputValidationProps,
    {
      get value() {
        return local.value !== undefined ? local.value : undefined;
      },
    },
  );

  const state: SwitchRoot.State = solidMergeProps(fieldState, {
    get checked() {
      return checked();
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
  });

  const context: SwitchRootContext = {
    checked,
    dirty: () => fieldState.dirty,
    disabled,
    filled: () => fieldState.filled,
    focused: () => fieldState.focused,
    readOnly,
    required,
    touched: () => fieldState.touched,
    valid: () => fieldState.valid,
  };

  const element = useRenderElement('span', componentProps, {
    props: [rootProps, validation.getValidationProps, elementProps, getButtonProps],
    ref: (el) => {
      switchRef = el as any;
      buttonRef(el);
    },
    state,
    stateAttributesMapping,
  });

  return (
    <SwitchRootContext.Provider value={context}>
      {element()}
      {!checked() && name() && local.uncheckedValue !== undefined && (
        <input type="hidden" form={formProp()} name={name()} value={local.uncheckedValue} />
      )}
      <input {...(inputProps as any)} />
    </SwitchRootContext.Provider>
  );
}

export interface SwitchRootState extends FieldRoot.State {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRoot.State>, 'onChange'> {
  /**
   * The id of the switch element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: ReactLikeRef<HTMLInputElement | null | undefined> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
