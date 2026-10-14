import { createEffect, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDirection } from '../direction-provider/DirectionContext';
import { DEFAULT_FIELD_ROOT_CONTEXT, useFieldRootContext } from '../field/root/FieldRootContext';
import {
  DEFAULT_LABELABLE_CONTEXT,
  useLabelableContext,
} from '../internals/labelable-provider/LabelableContext';
import { makeEventPreventable } from '../merge-props';
import type { BaseUIEvent, BaseUIComponentProps, HTMLProps } from '../utils/types';
import {
  canRenderNative,
  createNativeElement,
  fieldAttributes,
  fieldOwnedKeys,
  fieldStateAttributes,
  renderCompositeRoot,
  renderNativeElement,
  runConsumerHandler,
  stateAttr,
} from '../utils/native';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { fieldValidityMapping } from '../field/utils/constants';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { contains } from '../floating-ui-solid/utils';
import { useFormContext } from '../form/FormContext';
import { SHIFT } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { useValueChanged } from '../internals/useValueChanged';
import { splitComponentProps } from '../solid-helpers';
import type { ReactLikeRef } from '../solid-helpers';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import type { REASONS } from '../utils/reasons';
import { useBaseUiId } from '../utils/useBaseUiId';
import { useControlled } from '../utils/useControlled';
import { withCaptureListeners } from '../utils/withCaptureListeners';
import { RadioGroupContext } from './RadioGroupContext';
import { mergeProps as solidMergeProps } from '../solid-1-compat';

const MODIFIER_KEYS = [SHIFT];

/**
 * Provides shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio-group)
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

  const fieldRootContext = useFieldRootContext();
  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    registerDirtySource,
    registerFilledSource,
    setDirty,
    validityData,
  } = fieldRootContext;
  const labelableContext = useLabelableContext();
  const { labelId } = labelableContext;
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
  let appliedInputRef: RadioGroup.Props<Value>['inputRef'];
  let appliedCleanup: (() => void) | undefined;

  function detachConsumerRef() {
    const previous = appliedInputRef;
    const cleanup = appliedCleanup;
    appliedInputRef = undefined;
    appliedCleanup = undefined;
    if (cleanup) {
      cleanup();
      return;
    }
    if (typeof previous === 'function') {
      void previous(null);
    } else if (previous) {
      previous.current = null;
    }
  }

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null) {
    // Called from child effects and ref callbacks: read the latest prop without subscribing.
    const inputRefProp = untrack(() => local.inputRef);
    if (groupInputRef === hiddenInput && appliedInputRef === inputRefProp) {
      return;
    }

    detachConsumerRef();
    groupInputRef = hiddenInput;

    if (hiddenInput == null || inputRefProp == null) {
      return;
    }

    if (typeof inputRefProp === 'function') {
      const result = inputRefProp(hiddenInput);
      if (typeof result === 'function') {
        appliedCleanup = result;
      }
    } else {
      inputRefProp.current = hiddenInput;
    }
    appliedInputRef = inputRefProp;
  }

  // Re-apply when the consumer ref changes while the same input stays forwarded.
  createEffect(
    () => local.inputRef,
    () => {
      setInputRef(groupInputRef);
    },
  );

  const registerInputRef = (input: HTMLInputElement | null) => {
    if (!input) {
      return undefined;
    }

    if (!input.disabled) {
      if (!firstEnabledInputRef) {
        firstEnabledInputRef = input;
      }

      const currentInput = groupInputRef;
      if (input.checked || currentInput == null || currentInput.disabled) {
        setInputRef(input);
      }
    }

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInputRef === input) {
        firstEnabledInputRef = null;
      }
      if (groupInputRef === input) {
        setInputRef(null);
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
  // React sets `filled` when the value changes; the field derives it from this source.
  registerFilledSource(() => checkedValue() != null);

  useValueChanged(checkedValue, () => {
    const value = untrack(checkedValue);
    clearErrors(untrack(name));

    setDirty(value !== validityData.initialValue);

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

  // Solid-native fast path (plan 8): the `<div role="radiogroup">` rendered directly as a
  // composite root (roving focus) with the Field wiring inlined.
  if (canRenderNative(componentProps)) {
    const model: NativeRadioGroup = {
      props: componentProps as RadioGroup.Props<unknown>,
      field: fieldRootContext,
      checkedValue,
      setTouched,
    };
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return (
      <RadioGroupContext value={contextValue}>
        {NativeRadioGroupElement(
          model,
          state,
          labelableContext,
          ariaLabelledby,
          disabled,
          required,
          readOnly,
        )}
      </RadioGroupContext>
    );
  }

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
    // Solid: React's `onBlur` bubbles from the radios (`focusout`). The focused state itself is set
    // by the focused radio.
    onFocusOut(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        setTouched(false);
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

const OWN_KEYS: readonly string[] = [
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
];
const OWN_KEYS_SET: ReadonlySet<string> = new Set(OWN_KEYS);

interface NativeRadioGroup {
  props: RadioGroup.Props<unknown>;
  field: ReturnType<typeof useFieldRootContext>;
  checkedValue: () => unknown;
  setTouched: (value: boolean) => void;
}

type GroupEvent<T extends Event> = BaseUIEvent<T>;

const GROUP_ATTRIBUTES = { role: 'radiogroup' };

// The group's own handlers (after the consumer's, as React's `mergeProps`).
function groupFocus(m: NativeRadioGroup, event: FocusEvent) {
  makeEventPreventable(event as GroupEvent<FocusEvent>);
  runConsumerHandler(m.props, 'onFocus', event as GroupEvent<FocusEvent>);
}
function groupBlur(m: NativeRadioGroup, event: FocusEvent) {
  makeEventPreventable(event as GroupEvent<FocusEvent>);
  runConsumerHandler(m.props, 'onBlur', event as GroupEvent<FocusEvent>);
}

function NativeRadioGroupElement(
  m: NativeRadioGroup,
  state: RadioGroupState,
  labelableContext: ReturnType<typeof useLabelableContext>,
  ariaLabelledby: () => string | undefined,
  disabled: () => boolean | undefined,
  required: () => boolean | undefined,
  readOnly: () => boolean | undefined,
): JSX.Element {
  const { props, field } = m;
  const inField = field !== DEFAULT_FIELD_ROOT_CONTEXT;
  const inLabelable = labelableContext !== DEFAULT_LABELABLE_CONTEXT;
  const fieldKeys = fieldOwnedKeys(labelableContext, field);
  const own = fieldKeys.length ? new Set([...OWN_KEYS, ...fieldKeys]) : OWN_KEYS_SET;
  const direction = useDirection();
  return renderCompositeRoot(
    { enableHomeAndEndKeys: false, modifierKeys: MODIFIER_KEYS, direction },
    (root) => {
      const el = createNativeElement('div', GROUP_ATTRIBUTES);
      // Solid: capture-phase listeners attach through a ref in the slow path.
      el.addEventListener(
        'keydown',
        (event) => {
          if (event.key.startsWith('Arrow')) {
            m.setTouched(true);
          }
        },
        true,
      );
      // React's `onBlur` bubbles: focus leaving the group from any radio is observed on `focusout`.
      // The focused state itself is set by the focused radio.
      el.addEventListener('focusout', (event) => {
        if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
          m.setTouched(false);
          field.setTouched(true);
          field.setFocused(false);

          if (untrack(field.validationMode) === 'onBlur') {
            field.validation.commit(untrack(m.checkedValue));
          }
        }
      });
      return renderNativeElement({
        el,
        props,
        own,
        state,
        dynamic(target, set) {
          set('id', props.id);
          const isDisabled = disabled() ?? false;
          const isRequired = required() ?? false;
          const isReadOnly = readOnly() ?? false;
          set('aria-required', isRequired ? 'true' : undefined);
          set('aria-disabled', isDisabled ? 'true' : undefined);
          set('aria-readonly', isReadOnly ? 'true' : undefined);
          set('aria-labelledby', ariaLabelledby());
          set('data-disabled', stateAttr(isDisabled));
          if (inField) {
            fieldStateAttributes(state, target);
          }
          set('data-readonly', stateAttr(isReadOnly));
          set('data-required', stateAttr(isRequired));
          if (inField || inLabelable) {
            fieldAttributes(
              labelableContext,
              field,
              isDisabled,
              props as Record<string, unknown>,
              target,
            );
          }
        },
        handlers: {
          ...root.handlers,
          onFocus: [groupFocus, m],
          onBlur: [groupBlur, m],
        },
        partRefs: [root.setRootRef],
      });
    },
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
