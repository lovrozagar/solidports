import { createEffect, untrack } from 'solid-js';
import { useControlled } from '../utils/useControlled';
import { EMPTY_ARRAY } from '../utils/empty';
import { areArraysEqual } from '../utils/areArraysEqual';
import { useBaseUiId } from '../utils/useBaseUiId';
import { useRenderElement } from '../utils/useRenderElement';
import { CheckboxGroupContext } from './CheckboxGroupContext';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldRootContext } from '../field/root/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../internals/labelable-provider/useLabelableId';
import type { BaseUIComponentProps } from '../utils/types';
import { fieldValidityMapping } from '../field/utils/constants';
import { useCheckboxGroupParent } from './useCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import { REASONS } from '../utils/reasons';
import { useFormContext } from '../form/FormContext';
import { useValueChanged } from '../internals/useValueChanged';
import { splitComponentProps, type ReactLikeRef } from '../solid-helpers';
import { mergeProps as solidMergeProps } from '../solid-1-compat';

/**
 * Provides a shared state to a series of checkboxes.
 *
 * Documentation: [Base UI Checkbox Group](https://base-ui.com/react/components/checkbox-group)
 */
export function CheckboxGroup(componentProps: CheckboxGroup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'allValues',
    'defaultValue',
    'disabled',
    'id',
    'onValueChange',
    'value',
  ]);
  const disabledProp = () => local.disabled ?? false;
  const idProp = () => local.id;

  const {
    disabled: fieldDisabled,
    name: fieldName,
    state: fieldState,
    validation,
    setFilled,
    setDirty,
    validityData,
  } = useFieldRootContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();
  const { clearErrors, elementRef } = useFormContext();

  const disabled = () => Boolean(fieldDisabled() || disabledProp());
  const defaultValue = () => local.defaultValue ?? (EMPTY_ARRAY as string[]);

  const [valueUnwrapped, setValueUnwrapped] = useControlled<string[]>({
    controlled: () => local.value,
    default: defaultValue,
    name: 'CheckboxGroup',
    state: 'value',
  });
  // Solid: a controlled value that becomes `undefined` reads as empty, as React's array spreads do.
  const value = (): string[] => valueUnwrapped() ?? (EMPTY_ARRAY as string[]);

  const setValue = (v: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
    local.onValueChange?.(v, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(v);
  };

  const parent = useCheckboxGroupParent({
    allValues: () => local.allValues,
    value,
    onValueChange: setValue,
  });

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `htmlFor` at one arbitrary checkbox inside the group.
  useLabelableId({ id: null });

  const id = useBaseUiId(idProp);
  const getInputControl = validation.getInputControl;

  const controlRef: ReactLikeRef<HTMLElement | null> = {
    get current() {
      return getInputControl();
    },
  };

  const getFormValue = () => {
    const currentValue = untrack(value);
    const formElement = elementRef.current;
    if (!formElement) {
      return currentValue;
    }

    const successfulValues = new Set<string>();
    for (const [input, registration] of validation.registeredInputs) {
      if (
        registration.value !== undefined &&
        input.checked &&
        isEligibleInput(input, formElement)
      ) {
        successfulValues.add(registration.value);
      }
    }

    return currentValue.filter((inputValue) => successfulValues.has(inputValue));
  };

  useRegisterFieldControl(
    controlRef,
    id,
    value,
    getFormValue,
    () => !!fieldName() && !disabled(),
    fieldName,
  );

  createEffect(
    () => value().length > 0,
    (filled) => {
      setFilled(filled);
    },
  );

  useValueChanged(value, () => {
    const currentValue = untrack(value);
    const currentFieldName = untrack(fieldName);
    if (currentFieldName) {
      clearErrors(currentFieldName);
    }

    const initialValue = Array.isArray(validityData.initialValue)
      ? (validityData.initialValue as readonly string[])
      : EMPTY_ARRAY;

    setDirty(!areArraysEqual(currentValue, initialValue));

    validation.change(currentValue);
  });

  const state: CheckboxGroupState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
  });

  const contextValue: CheckboxGroupContext = {
    allValues: () => local.allValues,
    value,
    setValue,
    parent,
    disabled,
    validation,
    registerControlId,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get id() {
          return idProp();
        },
        role: 'group',
        get 'aria-labelledby'() {
          return labelId();
        },
      },
      elementProps,
      getDescriptionProps,
    ],
    stateAttributesMapping: fieldValidityMapping,
  });

  return <CheckboxGroupContext value={contextValue}>{element()}</CheckboxGroupContext>;
}

export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface CheckboxGroupProps extends BaseUIComponentProps<'div', CheckboxGroupState> {
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  onValueChange?:
    ((value: string[], eventDetails: CheckboxGroupChangeEventDetails) => void) | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupChangeEventReason = typeof REASONS.none;
export type CheckboxGroupChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props = CheckboxGroupProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
