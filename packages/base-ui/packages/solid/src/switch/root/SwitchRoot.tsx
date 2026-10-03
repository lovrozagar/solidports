import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useFormContext } from '../../form/FormContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useButton } from '../../internals/use-button';
import { useValueChanged } from '../../internals/useValueChanged';
import { mergeProps } from '../../merge-props';
import { splitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../types';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { SwitchRootContext } from './SwitchRootContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

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
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const form = () => local.form;
  const idProp = () => local.id;
  const nameProp = () => local.name;
  const nativeButton = () => local.nativeButton ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const disabledProp = () => local.disabled ?? false;

  const { clearErrors } = useFormContext();
  const {
    state: fieldState,
    setTouched,
    registerDirtySource,
    setDirty,
    validityData,
    registerFilledSource,
    setFocused,
    validationMode,
    disabled: fieldDisabled,
    name: fieldName,
    validation,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  const disabled = () => Boolean(fieldDisabled() || disabledProp());
  const name = () => fieldName() ?? nameProp();

  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  // Solid: the label fallback below reads the input reactively, as React re-runs it every commit.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null, {
    ownedWrite: true,
  });
  const handleInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
    setInputElement(element);
    validation.inputRef.current = element;
    const externalInputRef = untrack(() => local.inputRef);
    if (externalInputRef) {
      externalInputRef.current = element;
    }
  };

  const switchRef = useRef<HTMLElement | null | undefined>(null);

  const id = useBaseUiId();

  const controlId = useLabelableId({ id: idProp });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const [checked, setCheckedState] = useControlled({
    controlled: checkedProp,
    default: () => Boolean(local.defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  useRegisterFieldControl(switchRef, id, checked, undefined, () => !disabled(), nameProp);

  // React sets `filled` from a layout effect; the field derives it from this source.
  registerFilledSource(checked);

  // React sets `dirty` from a layout effect when the value changes; the field derives it.
  registerDirtySource(() => checked() !== validityData.initialValue);

  useValueChanged(checked, () => {
    const value = untrack(checked);
    clearErrors(untrack(name));
    setDirty(value !== validityData.initialValue);

    validation.change(value);
  });

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputElement,
    !untrack(nativeButton),
    hiddenInputId,
  );

  const rootProps: JSX.HTMLAttributes<HTMLSpanElement> = {
    get id() {
      return nativeButton() ? controlId() : id();
    },
    role: 'switch',
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    onFocus() {
      if (!disabled()) {
        setFocused(true);
      }
    },
    onBlur() {
      const element = inputRef.current;
      if (!element || disabled()) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(element.checked);
      }
    },
    onClick(event) {
      if (readOnly() || disabled()) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
  };

  // Rebuilt when its sources change, as React merges these props every render.
  const inputProps = createMemo(() =>
    mergeProps<'input'>(validation.getValidationProps(disabled()), {
      get checked() {
        return checked();
      },
      get disabled() {
        return disabled();
      },
      get form() {
        return form();
      },
      get id() {
        return hiddenInputId();
      },
      get name() {
        return name();
      },
      get required() {
        return required();
      },
      get style() {
        return name() ? visuallyHiddenInput : visuallyHidden;
      },
      tabindex: -1,
      type: 'checkbox',
      'aria-hidden': 'true',
      ref: handleInputRef,
      // Solid: React's checkbox `onChange` runs during the click, so it is handled here, where
      // canceling the click also reverts the native toggle.
      onClick(event) {
        // The click dispatched from the root's `onClick` is an implementation detail
        // and must not reach ancestors, which already receive the original click.
        event.stopPropagation();

        // Workaround for https://github.com/facebook/react/issues/9023
        if (event.defaultPrevented) {
          return;
        }

        if (readOnly()) {
          event.preventDefault();
          return;
        }

        const nextChecked = event.currentTarget.checked;
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        local.onCheckedChange?.(nextChecked, eventDetails);

        if (eventDetails.isCanceled) {
          event.preventDefault();
          return;
        }

        setCheckedState(nextChecked);
      },
      onFocus() {
        switchRef.current?.focus();
      },
      // Only set `value` when defined: Solid writes `undefined` to an input's `value` as ''.
      ...(local.value !== undefined ? { value: local.value } : EMPTY_OBJECT),
    }),
  );

  const state: SwitchRootState = solidMergeProps(fieldState, {
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

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [switchRef, buttonRef],
    get props() {
      return [
        rootProps,
        elementProps,
        getButtonProps,
        (props: HTMLProps) => validation.getValidationProps(disabled(), props),
      ];
    },
    stateAttributesMapping,
  });

  return (
    <SwitchRootContext value={state}>
      {element()}
      {!checked() && name() && local.uncheckedValue !== undefined && (
        <input
          type="hidden"
          form={form()}
          name={name()}
          value={local.uncheckedValue}
          disabled={disabled()}
        />
      )}
      <input {...(inputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)} />
    </SwitchRootContext>
  );
}

export interface SwitchRootState extends FieldRootState {
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
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
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
    ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void) | undefined;
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
