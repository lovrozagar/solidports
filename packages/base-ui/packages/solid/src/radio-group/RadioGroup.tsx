/* eslint-disable typescript/no-explicit-any -- generic radio Value erased at group level */
import { createSignal, untrack } from 'solid-js';
import type { FieldRootState } from '../field/root/FieldRoot';
import { useFieldRootContext } from '../field/root/FieldRootContext';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { fieldValidityMapping } from '../field/utils/constants';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { contains } from '../floating-ui-solid/utils';
import { useFormContext } from '../form/FormContext';
import { SHIFT } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useValueChanged } from '../internals/useValueChanged';
import { splitComponentProps, type ReactLikeRef } from '../solid-helpers';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import { REASONS } from '../utils/reasons';
import type { BaseUIComponentProps, HTMLProps } from '../utils/types';
import { useBaseUiId } from '../utils/useBaseUiId';
import { useControlled } from '../utils/useControlled';
import { withCaptureListeners } from '../utils/withCaptureListeners';
import { RadioGroupContext } from './RadioGroupContext';
import { mergeProps as solidMergeProps } from '../solid-1-compat';

const MODIFIER_KEYS = [SHIFT];

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio)
 */
export function RadioGroup<Value>(componentProps: RadioGroup.Props<Value>) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'readOnly',
    'required',
    'onValueChange',
    'value',
    'defaultValue',
    'form',
    'name',
    'inputRef',
    'id',
    'children',
  ]);
  const disabledProp = () => local.disabled;
  const readOnly = () => local.readOnly;
  const required = () => local.required;
  const externalValue = () => local.value;
  const form = () => local.form;
  const nameProp = () => local.name;
  const idProp = () => local.id;

  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    registerDirtySource,
    setDirty,
    setFilled,
    validityData,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const { clearErrors, elementRef } = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);

  const disabled = () => fieldDisabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();
  const id = useBaseUiId(idProp);

  const [checkedValue, setCheckedValueUnwrapped] = useControlled({
    controlled: externalValue,
    default: () => local.defaultValue,
    name: 'RadioGroup',
    state: 'value',
  });
  const [touched, setTouched] = createSignal(false);

  const setCheckedValue = (value: Value, eventDetails: RadioGroup.ChangeEventDetails) => {
    local.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(value);
  };

  const getInputControl = validation.getInputControl;
  const controlRef: ReactLikeRef<HTMLElement | null> = {
    get current() {
      return getInputControl();
    },
  };
  let groupInputRef: HTMLInputElement | null = null;
  let firstEnabledInputRef: HTMLInputElement | null = null;

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null) {
    let cleanup: void | (() => void) | undefined = undefined;

    // Called from child effects and ref callbacks: read the latest prop without subscribing.
    const inputRefProp = untrack(() => local.inputRef);
    if (inputRefProp) {
      if (typeof inputRefProp === 'function') {
        cleanup = inputRefProp(hiddenInput);
      } else {
        inputRefProp.current = hiddenInput;
      }
    }

    groupInputRef = hiddenInput;

    return cleanup;
  }

  const registerInputRef = (input: HTMLInputElement | null) => {
    if (!input || input.disabled) {
      return undefined;
    }

    if (!firstEnabledInputRef) {
      firstEnabledInputRef = input;
    }

    const currentInput = groupInputRef;
    const cleanup =
      input.checked || currentInput == null || currentInput.disabled
        ? setInputRef(input)
        : undefined;

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInputRef === input) {
        firstEnabledInputRef = null;
      }
      if (groupInputRef === input) {
        if (cleanup) {
          cleanup();
          groupInputRef = null;
        } else {
          void setInputRef(null);
        }
      } else {
        cleanup?.();
      }
    };
  };

  const getFormValue = () => {
    const formElement = elementRef.current;
    if (!formElement) {
      return untrack(checkedValue) ?? null;
    }

    for (const input of validation.registeredInputs.keys()) {
      if (input.checked && isEligibleInput(input, formElement)) {
        return untrack(checkedValue) ?? null;
      }
    }

    return null;
  };

  useRegisterFieldControl(
    controlRef,
    id,
    () => checkedValue() ?? null,
    getFormValue,
    () => !disabled(),
    nameProp,
  );

  // React sets `dirty` from a layout effect when the value changes; the field derives it.
  // Nullish values compare equal: an unset group starts as `undefined` against a `null` initial value.
  registerDirtySource(() => (checkedValue() ?? null) !== (validityData.initialValue ?? null));

  useValueChanged(checkedValue, () => {
    const value = untrack(checkedValue);
    clearErrors(untrack(name));

    setDirty(value !== validityData.initialValue);
    setFilled(value != null);

    validation.change(value);

    const fallbackInput = firstEnabledInputRef;
    if (value == null && fallbackInput && !fallbackInput.disabled) {
      // Imperative re-point outside the ref lifecycle; the ref cleanup isn't tracked here.
      void setInputRef(fallbackInput);
    }
  });

  const ariaLabelledby = () => labelId() ?? fieldsetContext?.legendId();

  const state: RadioGroupState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled() ?? false;
    },
    get required() {
      return required() ?? false;
    },
    get readOnly() {
      return readOnly() ?? false;
    },
  });

  const contextValue: RadioGroupContext<Value> = {
    checkedValue,
    disabled,
    form,
    validation,
    name,
    readOnly,
    registerInputRef,
    required,
    setCheckedValue,
    setTouched,
    touched,
  };

  // Solid: the consumer's ref is read when applied, as `forwardedRef` is in React.
  const forwardedRef = (element: HTMLElement | null) => {
    const ref = untrack(() => componentProps.ref) as
      ((el: HTMLElement | null) => void) | ReactLikeRef<HTMLElement | null> | undefined;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  const defaultProps: Omit<HTMLProps, 'children'> = {
    get id() {
      return idProp();
    },
    role: 'radiogroup',
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-disabled'() {
      return disabled() ? 'true' : undefined;
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledby();
    },
    onFocus() {
      setFocused(true);
    },
    onBlur(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        setFieldTouched(true);
        setFocused(false);

        if (untrack(validationMode) === 'onBlur') {
          validation.commit(untrack(checkedValue));
        }
      }
    },
    // Solid: capture-phase listeners attach through a ref.
    ref: withCaptureListeners({
      keydown(event) {
        if (event.key.startsWith('Arrow')) {
          setTouched(true);
          setFocused(true);
        }
      },
    }),
  };

  return (
    <RadioGroupContext value={contextValue}>
      <CompositeRoot
        render={renderProps.render}
        class={renderProps.class}
        state={state}
        props={[
          defaultProps,
          elementProps,
          (props: HTMLProps) => validation.getValidationProps(disabled() ?? false, props),
        ]}
        refs={[forwardedRef]}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      >
        {local.children}
      </CompositeRoot>
    </RadioGroupContext>
  );
}

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any> extends Omit<
  BaseUIComponentProps<'div', RadioGroupState>,
  'value'
> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?:
    | ReactLikeRef<HTMLInputElement | null | undefined>
    | ((el: HTMLInputElement | null) => void | (() => void))
    | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = BaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<TValue = any> = RadioGroupProps<TValue>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
