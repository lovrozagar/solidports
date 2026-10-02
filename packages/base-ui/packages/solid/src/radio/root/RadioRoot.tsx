/* eslint-disable typescript/no-explicit-any -- generic radio Value erased at root */
import { createEffect, createSignal, onCleanup, onSettled, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useButton } from '../../internals/use-button';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { splitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { EMPTY_OBJECT } from '../../utils/empty';
import { NOOP } from '../../utils/noop';
import { REASONS } from '../../utils/reasons';
import { serializeValue } from '../../utils/serializeValue';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
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
  const disabledProp = () => local.disabled ?? false;
  const readOnlyProp = () => local.readOnly ?? false;
  const requiredProp = () => local.required ?? false;
  const nativeButton = () => local.nativeButton ?? false;
  const idProp = () => local.id;

  const groupContext = useRadioGroupContext();

  const disabledGroup = () => groupContext?.disabled();
  const readOnlyGroup = () => groupContext?.readOnly();
  const requiredGroup = () => groupContext?.required();
  const formGroup = () => groupContext?.form();
  const touched = () => groupContext?.touched() ?? false;
  const validation = groupContext?.validation;
  const name = () => groupContext?.name();
  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setTouched = groupContext?.setTouched ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;

  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = () =>
    Boolean(fieldDisabled() || fieldItemContext.disabled() || disabledGroup() || disabledProp());
  const readOnly = () => Boolean(readOnlyGroup() || readOnlyProp());
  const required = () => Boolean(requiredGroup() || requiredProp());
  const form = formGroup;

  const checked = () =>
    groupContext ? groupContext.checkedValue() === local.value : local.value === '';

  const radioRef = useRef<HTMLElement | null | undefined>(null);
  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  // Solid: the label fallback below reads the input reactively, as React re-runs it every commit.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null, {
    ownedWrite: true,
  });

  const registerFieldInput = validation?.registerInput;
  const registerInput = (element: HTMLInputElement) =>
    registerFieldInput?.(element, { controlRef: radioRef, value: undefined });

  // Solid: refs return no cleanup, so the merged ref's cleanups run when the radio unmounts.
  let inputRefCleanups: Array<void | (() => void)> = [];
  const mergedInputRef = (element: HTMLInputElement) => {
    const inputRefProp = untrack(() => local.inputRef);
    if (typeof inputRefProp === 'function') {
      inputRefProp(element);
    } else if (inputRefProp) {
      inputRefProp.current = element;
    }
    inputRef.current = element;
    setInputElement(element);
    inputRefCleanups = [registerInputRef(element), registerInput(element)];
  };
  onCleanup(() => {
    inputRefCleanups.forEach((cleanup) => cleanup?.());
    inputRefCleanups = [];
    const inputRefProp = untrack(() => local.inputRef);
    if (typeof inputRefProp === 'function') {
      inputRefProp(null);
    } else if (inputRefProp) {
      inputRefProp.current = null;
    }
  });

  onSettled(() => {
    if (inputRef.current?.checked) {
      setFilled(true);
    }
  });

  createEffect(
    () => ({ checked: checked(), disabled: disabled() }),
    (deps) => {
      if (!inputRef.current) {
        return;
      }

      if (deps.disabled && deps.checked) {
        registerInputRef(null);
        return;
      }

      registerInputRef(inputRef.current);
    },
  );

  const id = useBaseUiId();
  const inputId = useLabelableId({ id: idProp });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
  const ariaLabelledBy = useAriaLabelledBy(
    () => local['aria-labelledby'],
    labelId,
    inputElement,
    !untrack(nativeButton),
    hiddenInputId,
  );

  const rootProps: JSX.HTMLAttributes<HTMLSpanElement> = {
    role: 'radio',
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
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
        // Radio only activates with Space. Preventing the keydown's default
        // stops useButton from turning Enter into a click.
        event.preventDefault();
      }
    },
    onClick(event) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled() || readOnly() || !touched()) {
        return;
      }

      inputRef.current?.click();

      setTouched(false);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
    composite: false,
  });

  const inputProps: JSX.InputHTMLAttributes<HTMLInputElement> = {
    type: 'radio',
    ref: mergedInputRef,
    get form() {
      return form();
    },
    get id() {
      return hiddenInputId();
    },
    get name() {
      return name();
    },
    tabindex: -1,
    get style() {
      return name() ? visuallyHiddenInput : visuallyHidden;
    },
    'aria-hidden': 'true',
    get value() {
      return local.value !== undefined ? serializeValue(local.value) : undefined;
    },
    get disabled() {
      return disabled();
    },
    get checked() {
      return checked();
    },
    get required() {
      return required();
    },
    get readonly() {
      return readOnly();
    },
    // Solid: React's radio `onChange` runs during the click (only when the radio becomes
    // checked), so it is handled here, where canceling the click also reverts the native change.
    onClick(event) {
      // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
      // implementation detail and must not reach ancestors.
      event.stopPropagation();

      // Workaround for https://github.com/facebook/react/issues/9023
      if (event.defaultPrevented || untrack(checked)) {
        return;
      }

      if (disabled() || readOnly() || local.value === undefined) {
        event.preventDefault();
        return;
      }

      const details = createChangeEventDetails(REASONS.none, event);

      setCheckedValue(local.value, details);

      if (details.isCanceled) {
        event.preventDefault();
        return;
      }

      setFieldTouched(true);
    },
    onFocus() {
      radioRef.current?.focus();
    },
  };

  const state: RadioRootState = solidMergeProps(fieldState, {
    get required() {
      return required();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get checked() {
      return checked();
    },
  });

  const contextValue: RadioRootContext = state;

  const isRadioGroup = groupContext != null;

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

  const refs = [radioRef, buttonRef];
  const props = () => [
    rootProps,
    elementProps,
    getButtonProps,
    getDescriptionProps,
    validation
      ? (validationProps: HTMLProps) => validation.getValidationProps(disabled(), validationProps)
      : EMPTY_OBJECT,
  ];

  const element = useRenderElement('span', componentProps, {
    enabled: !isRadioGroup,
    state,
    ref: refs,
    get props() {
      return props();
    },
    stateAttributesMapping,
  });

  return (
    <RadioRootContext value={contextValue}>
      <Show when={isRadioGroup} fallback={element()}>
        <CompositeItem
          tag="span"
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          refs={[forwardedRef, ...refs]}
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

export interface RadioRootState extends FieldRootState {
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
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRootState>, 'value'> {
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
    | ReactLikeRef<HTMLInputElement | null | undefined>
    | ((el: HTMLInputElement | null) => void)
    | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
