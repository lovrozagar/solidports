import { createEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { activeElement } from '../../floating-ui-solid/utils';
import { useFormContext } from '../../form/FormContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useValueChanged } from '../../internals/useValueChanged';
import { splitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps, type HTMLProps } from '../../utils/types';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Base UI input component instead. For example,
 * [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
 * or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldControl(componentProps: FieldControl.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'name',
    'value',
    'disabled',
    'onValueChange',
    'defaultValue',
    'autofocus',
  ]);
  // Solid: JSX attribute types allow `false` to remove the attribute; it means unset here.
  const idProp = () => (local.id === false ? undefined : local.id);
  const nameProp = () => (local.name === false ? undefined : local.name);
  const valueProp = () => local.value;
  const disabledProp = () => local.disabled ?? false;
  const autofocus = () => local.autofocus ?? false;

  const {
    state: fieldState,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setDirty,
    validityData,
    setFocused,
    setFilled,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { clearErrors, elementRef: formElementRef, submitCountRef } = useFormContext();

  const disabled = () => Boolean(fieldDisabled() || disabledProp());
  const name = () => fieldName() ?? nameProp();

  const state: FieldControlState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
  });

  const { labelId } = useLabelableContext();

  const id = useLabelableId({ id: idProp });

  const [valueUnwrapped] = useControlled({
    controlled: valueProp,
    default: () => local.defaultValue,
    name: 'FieldControl',
    state: 'value',
  });

  const isControlled = () => valueProp() !== undefined;
  const value = () => (isControlled() ? valueUnwrapped() : undefined);
  // The DOM value is always a string, so dirty comparisons must serialize the controlled value.
  const serializedValue = () => {
    const currentValue = value();
    return currentValue == null ? undefined : String(currentValue);
  };

  const getValueFromInput = () => validation.inputRef.current?.value;

  useRegisterFieldControl(
    validation.inputRef,
    id,
    serializedValue,
    getValueFromInput,
    () => !disabled(),
    nameProp,
  );

  // Solid: an effect, as React's layout effect. Registering a derived source (as other controls
  // do) would read the value through a parent render function's props, which also carry this
  // field's state, so `filled` would depend on itself.
  createEffect(serializedValue, (nextSerializedValue) => {
    const currentValue = nextSerializedValue ?? validation.inputRef.current?.value;
    if (currentValue !== undefined) {
      setFilled(currentValue !== '');
    }
  });

  useValueChanged(serializedValue, () => {
    const nextSerializedValue = untrack(serializedValue);
    if (nextSerializedValue === undefined) {
      return;
    }

    clearErrors(untrack(name));
    setDirty(nextSerializedValue !== (validityData.initialValue ?? ''));

    validation.change(nextSerializedValue);
  });

  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  const enterValidationTimeout = useTimeout();

  // Solid: a replacement control can attach before the outgoing one's unmount runs, so only
  // clear the shared input ref while it still points at this control's element.
  const setValidationInputRef = (element: HTMLInputElement | null) => {
    if (element) {
      validation.inputRef.current = element;
    } else if (validation.inputRef.current === inputRef.current) {
      validation.inputRef.current = null;
    }
  };

  createEffect(autofocus, (shouldAutofocus) => {
    if (
      shouldAutofocus &&
      inputRef.current === activeElement(ownerDocument(inputRef.current ?? null))
    ) {
      setFocused(true);
    }
  });

  const element = useRenderElement('input', componentProps, {
    ref: [setValidationInputRef, inputRef],
    state,
    get props() {
      return [
        {
          get id() {
            return id();
          },
          get disabled() {
            return disabled();
          },
          get name() {
            return name();
          },
          get 'aria-labelledby'() {
            return labelId();
          },
          get autofocus() {
            return autofocus();
          },
          onInput(event: InputEvent) {
            const inputValue = (event.currentTarget as HTMLInputElement).value;
            const details = createChangeEventDetails(REASONS.none, event);
            local.onValueChange?.(inputValue, details);

            // Controlled values sync from the `value` prop instead, so that a value the consumer
            // rejects or rewrites never reaches the field state.
            if (untrack(isControlled)) {
              return;
            }

            // `validation.change` reads `markedDirtyRef`, so update dirty before validating.
            setDirty(inputValue !== (validityData.initialValue ?? ''));
            setFilled(inputValue !== '');

            // Workaround for https://github.com/facebook/react/issues/9023
            if (!event.defaultPrevented && !details.isCanceled) {
              clearErrors(untrack(name));
              validation.change(inputValue);
            }
          },
          onFocus() {
            setFocused(true);
          },
          onBlur(event: FocusEvent) {
            setTouched(true);
            setFocused(false);

            if (untrack(validationMode) === 'onBlur') {
              const inputValue = (event.currentTarget as HTMLInputElement).value;
              validation.commit(inputValue);

              if (untrack(isControlled)) {
                // Controlled blur handlers can normalize the value before this microtask runs.
                // A rewrite back to the initial value is a programmatic reset: the field looks
                // pristine, so committing it would only surface `valueMissing` noise.
                queueMicrotask(() => {
                  const nextValue = validation.inputRef.current?.value;
                  if (
                    nextValue !== undefined &&
                    nextValue !== inputValue &&
                    nextValue !== (validityData.initialValue ?? '')
                  ) {
                    validation.commit(nextValue);
                  }
                });
              }
            }
          },
          onKeyDown(event: KeyboardEvent) {
            const target = event.currentTarget as HTMLInputElement;
            if (target.tagName === 'INPUT' && event.key === 'Enter') {
              setTouched(true);
              const inputValue = target.value;
              const form = target.form;
              if (form && form === formElementRef.current && !event.defaultPrevented) {
                const input = target;
                const submitCount = submitCountRef.current;

                // Implicit submission runs after keydown. Fall back unless Form handles it first.
                enterValidationTimeout.start(0, () => {
                  if (submitCountRef.current === submitCount) {
                    validation.commit(input.value);
                  }
                });
              } else {
                validation.commit(inputValue);
              }
            }
          },
        },
        // Solid re-applies an input's `value` property on every spread update (like a React
        // controlled input), so uncontrolled inputs must only pass `defaultValue`.
        isControlled() ? { value: value() } : { defaultValue: local.defaultValue },
        elementProps,
        (props: HTMLProps) => validation.getValidationProps(disabled(), props),
      ];
    },
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export interface FieldControlState extends FieldRootState {}

export interface FieldControlProps extends BaseUIComponentProps<'input', FieldControlState> {
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?:
    ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void) | undefined;
  defaultValue?: JSX.InputHTMLAttributes<HTMLInputElement>['value'] | undefined;
}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  BaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props = FieldControlProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
