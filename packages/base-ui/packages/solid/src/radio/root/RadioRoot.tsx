/* eslint-disable typescript/no-explicit-any -- generic radio Value erased at root */
import { createTrackedEffect, createMemo, onSettled, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { EMPTY_OBJECT } from '../../utils/empty';
import { NOOP } from '../../utils/noop';
import { REASONS } from '../../utils/reasons';
import { serializeValue } from '../../utils/serializeValue';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { RadioRootContext } from './RadioRootContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioRoot<Value>(componentProps: RadioRoot.Props<Value>) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'readOnly',
    'required',
    'aria-labelledby',
    'value',
    'inputRef',
    'nativeButton',
    'id',
    'children',
  ]);

  const disabledProp = () => Boolean(local.disabled);
  const readOnlyProp = () => local.readOnly ?? false;
  const requiredProp = () => local.required ?? false;
  const nativeButton = () => Boolean(local.nativeButton);
  const idProp = () => local.id;

  const groupContext = useRadioGroupContext();

  const {
    disabled: disabledGroup,
    readOnly: readOnlyGroup,
    required: requiredGroup,
    form: formGroup,
    checkedValue,
    touched,
    validation,
    name,
  } = groupContext ?? {};
  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setTouched = groupContext?.setTouched ?? NOOP;
  const registerControlRef = groupContext?.registerControlRef ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;

  const {
    setDirty,
    validityData,
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = () =>
    fieldDisabled() || fieldItemContext.disabled() || disabledGroup?.() || disabledProp();
  const readOnly = () => readOnlyGroup?.() || readOnlyProp();
  const required = () => requiredGroup?.() || requiredProp();
  const form = () => formGroup?.();

  const checked = () => (groupContext ? checkedValue?.() === local.value : local.value === '');
  const serializedValue = createMemo(() => serializeValue(local.value));

  let radioRef = null as HTMLElement | null | undefined;
  let inputRef = null as HTMLInputElement | null | undefined;
  let lastClickEvent: PointerEvent | MouseEvent | KeyboardEvent | undefined;

  const handleControlRef = (element: HTMLElement | null | undefined) => {
    if (!element) {
      return;
    }

    registerControlRef(element, disabled());
  };

  onSettled(() => {
    if (inputRef?.checked) {
      setFilled(true);
    }
  });

  createTrackedEffect(() => {
    if (!inputRef) {
      return;
    }

    const isDisabled = disabled();
    const isChecked = checked();

    if (isDisabled && isChecked) {
      registerInputRef(null);
      return;
    }

    if (radioRef) {
      registerControlRef(radioRef, isDisabled);
    }

    registerInputRef(inputRef);
  });

  const id = useBaseUiId();
  const inputId = useLabelableId({
    get controlRef() {
      return radioRef;
    },
    id: idProp,
    implicit: false,
  });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
  const ariaLabelledBy = useAriaLabelledBy(
    () => local['aria-labelledby'],
    labelId,
    () => inputRef,
    !nativeButton(),
    hiddenInputId,
  );

  const rootProps: JSX.HTMLAttributes<HTMLButtonElement> = {
    role: 'radio',
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
    },
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM as string]() {
      return checked() ? '' : undefined;
    },
    get id() {
      return nativeButton() ? inputId() : id();
    },
    onKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    },
    onClick(event) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();
      lastClickEvent = event;

      inputRef?.dispatchEvent(
        new PointerEvent('click', {
          altKey: event.altKey,
          bubbles: true,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        }),
      );
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled() || readOnly() || !touched?.()) {
        return;
      }

      inputRef?.click();

      setTouched(false);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const inputProps: JSX.InputHTMLAttributes<HTMLInputElement> = {
    'aria-hidden': 'true',
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
      return name?.();
    },
    onChange(event) {
      // Workaround for https://github.com/facebook/react/issues/9023
      if (event.defaultPrevented) {
        return;
      }

      if (disabled() || readOnly() || local.value === undefined) {
        return;
      }

      const details = createChangeEventDetails(REASONS.none, lastClickEvent ?? event);

      if (details.isCanceled) {
        return;
      }

      {
        setFieldTouched(true);
        setDirty(local.value !== validityData.initialValue);
        setFilled(true);
        setCheckedValue(local.value, details);
      };
    },
    onFocus() {
      radioRef?.focus();
    },
    get readonly() {
      return readOnly();
    },
    ref: (el) => {
      if (local.inputRef) {
        if (typeof local.inputRef === 'function') {
          local.inputRef(el);
        } else {
          local.inputRef.current = el;
        }
      }
      inputRef = el;
      registerInputRef(el);
    },
    get required() {
      return required();
    },
    get style() {
      return name?.() ? visuallyHiddenInput : visuallyHidden;
    },
    tabindex: -1,
    type: 'radio',
    get value() {
      return local.value !== undefined ? serializedValue() : undefined;
    },
  };

  const state: RadioRoot.State = solidMergeProps(fieldState, {
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

  const context: RadioRootContext = {
    checked,
    dirty: () => fieldState.dirty,
    disabled,
    filled: () => fieldState.filled,
    focused: () => fieldState.focused,
    readOnly,
    required,
    touched: () => touched?.() ?? false,
    valid: () => fieldState.valid,
  };

  const isRadioGroup = () => groupContext !== undefined;

  const ref = (el: any) => {
    radioRef = el;
    buttonRef(el);
    handleControlRef(el);
    if (typeof componentProps.ref === 'function') {
      componentProps.ref(el);
    } else {
      // eslint-disable-next-line solid/reactivity
      componentProps.ref = el;
    }
  };

  const props = () => [
    rootProps,
    getDescriptionProps,
    validation?.getValidationProps ?? EMPTY_OBJECT,
    elementProps,
    getButtonProps,
  ];

  const element = useRenderElement('span', componentProps, {
    enabled: () => !isRadioGroup(),
    get props() {
      return props();
    },
    ref,
    state,
    stateAttributesMapping,
  });

  return (
    <RadioRootContext value={context}>
      <Show when={isRadioGroup()} fallback={element()}>
        <CompositeItem
          tag="span"
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          refs={ref}
          props={props()}
          stateAttributesMapping={stateAttributesMapping}
        >
          {local.children}
        </CompositeItem>
      </Show>

      <input {...inputProps} />
    </RadioRootContext>
  );
}

export interface RadioRootState extends FieldRoot.State {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRoot.State>, 'value'> {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?:
    | ReactLikeRef<HTMLInputElement>
    | ((el: HTMLInputElement | null | undefined) => void)
    | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
