/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { untrack, type Accessor } from 'solid-js';
import type { Form } from '../../form';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeProps } from '../../merge-props';
import { useRef, type ReactLikeRef } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/empty';
import type { BaseUIHTMLProps, HTMLProps } from '../../utils/types';
import { useTimeout } from '../../utils/useTimeout';
import { DEFAULT_VALIDITY_STATE } from '../utils/constants';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { FieldRootState, FieldValidityData } from './FieldRoot';

const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE) as Array<keyof ValidityState>;

export type RegisteredInput = {
  controlRef: ReactLikeRef<HTMLElement | null | undefined>;
  value: string | undefined;
};

export type RegisteredInputs = Map<HTMLInputElement, RegisteredInput>;

/**
 * Whether an input participates in the surrounding Base UI Form. Inputs that are effectively
 * disabled, or whose `form` attribute explicitly associates them with another form, are excluded.
 * DOM position only matters when it associates the input with a different form. Otherwise, field
 * registration is context-driven, so portaled inputs (for example inside a dialog) still belong to
 * the form for both validation and values projected into `onFormSubmit`.
 */
export function isEligibleInput(
  input: HTMLInputElement,
  formElement: HTMLFormElement | null | undefined,
) {
  if (input.matches(':disabled')) {
    return false;
  }

  if (!formElement || input.form === formElement) {
    return true;
  }

  // Context crosses portal boundaries. An unassociated portaled input still participates in
  // contextual validation, unless an explicit `form` attribute opts it out of the surrounding Form.
  return input.form === null && !input.hasAttribute('form');
}

/**
 * Picks the input whose native validity should represent a field that owns several inputs (such as a
 * checkbox or radio group). Prefers the first eligible currently-invalid input, where "first" follows
 * registration order (mount order), and otherwise returns the first eligible input.
 */
function findRepresentativeInput(
  inputs: RegisteredInputs,
  formElement: HTMLFormElement | null | undefined,
): HTMLInputElement | null {
  let fallback: HTMLInputElement | null = null;
  for (const input of inputs.keys()) {
    if (!isEligibleInput(input, formElement)) {
      continue;
    }
    if (!input.validity.valid) {
      return input;
    }
    fallback ??= input;
  }
  return fallback;
}

function makeState(customError: boolean): Record<keyof ValidityState, boolean> {
  return { ...DEFAULT_VALIDITY_STATE, valid: !customError, customError };
}

function getNativeErrors(element: HTMLInputElement | null | undefined): string[] {
  return element && element.validationMessage ? [element.validationMessage] : [];
}

export function useFieldValidation(
  params: UseFieldValidationParameters,
): UseFieldValidationReturnValue {
  const { elementRef, formRef, clearErrors } = useFormContext();

  const {
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    registeredFieldIdRef,
  } = params;

  const { controlId, getDescriptionProps } = useLabelableContext();

  const timeout = useTimeout();
  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  const registeredInputs: RegisteredInputs = new Map();
  let validationCommitIdRef = 0;
  // Tracks the message installed by Base UI and the custom message it displaced.
  let customValidityRef: [element: HTMLInputElement, message: string, displaced: string] | null =
    null;

  // Groups register several inputs against a single field so focus, validation, and form-value
  // projection can use the same live controls. This also ensures a `required` checkbox can't be
  // satisfied by another input in the group, matching native per-checkbox behavior.
  const registerInput = (element: HTMLInputElement, registration: RegisteredInput) => {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  };

  const getInputControl = () => {
    const element = findRepresentativeInput(registeredInputs, elementRef.current);
    return (element && registeredInputs.get(element)?.controlRef.current) || null;
  };

  const commit = async (value: unknown, revalidate = false) => {
    validationCommitIdRef += 1;
    const validationCommitId = validationCommitIdRef;

    function updateRegisteredFieldValidity(
      nextValidityData: FieldValidityData,
      externalInvalid = untrack(invalid),
    ) {
      const fieldId = registeredFieldIdRef.current ?? untrack(controlId);
      if (fieldId == null) {
        return;
      }

      const currentFieldData = formRef.fields.get(fieldId);
      if (!currentFieldData) {
        return;
      }

      const validityDataWithFormErrors = getCombinedFieldValidityData(
        nextValidityData,
        externalInvalid,
      );

      formRef.fields.set(fieldId, {
        ...currentFieldData,
        validityData: validityDataWithFormErrors,
      });
    }

    function makeValidityData(
      validityState: FieldValidityData['state'],
      errorMessages: string[],
    ): FieldValidityData {
      // `valueMissing` may be suppressed while the native message remains non-empty.
      const errors = validityState.valid === false ? errorMessages : [];
      return {
        value,
        state: validityState,
        error: errors[0] ?? '',
        errors,
        initialValue: validityData.initialValue,
      };
    }

    function setCustomValidity(element: HTMLInputElement, message: string) {
      // Never reinstall a native constraint message as custom validity.
      const displaced = element.validity.customError ? element.validationMessage : '';
      const ownedMessage = message.replace(/\r\n?/g, '\n');
      element.setCustomValidity(ownedMessage);
      customValidityRef = [element, ownedMessage, displaced];
    }

    function clearCustomValidity() {
      const record = customValidityRef;
      customValidityRef = null;
      // Replacement transfers ownership; barred controls hide `validationMessage`.
      if (record && (!record[0].willValidate || record[0].validationMessage === record[1])) {
        record[0].setCustomValidity(record[2]);
      }
    }

    function publish(
      validityState: FieldValidityData['state'],
      errorMessages: string[],
      externalInvalid?: boolean,
    ) {
      const nextValidityData = makeValidityData(validityState, errorMessages);
      updateRegisteredFieldValidity(nextValidityData, externalInvalid);
      setValidityData(nextValidityData);
    }

    function getState(el: HTMLInputElement) {
      const computedState = validityKeys.reduce(
        (acc, key) => {
          acc[key] = el.validity[key];
          return acc;
        },
        {} as Record<keyof ValidityState, boolean>,
      );

      let hasOnlyValueMissingError = false;

      for (const key of validityKeys) {
        if (key === 'valid') {
          continue;
        }
        if (key === 'valueMissing' && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }

      // Only make `valueMissing` mark the field invalid if it's been changed
      // to reduce error noise.
      if (hasOnlyValueMissingError && !markedDirtyRef.current) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }

    // A field can own several inputs (such as a checkbox or radio group), but only the last-mounted
    // one wins the shared `inputRef`. Validate against the registry instead so every input counts;
    // `inputRef` is the fallback only when no inputs are registered.
    function resolveRepresentativeInput() {
      return registeredInputs.size > 0
        ? findRepresentativeInput(registeredInputs, elementRef.current)
        : inputRef.current;
    }

    // A field with no eligible input has no native constraint, but its custom validator still
    // applies to the logical value at the configured validation boundary.
    let element = resolveRepresentativeInput();

    function refreshState() {
      element = resolveRepresentativeInput();
      // Barred controls expose no usable native constraint state.
      return element?.willValidate ? getState(element) : makeState(false);
    }

    if (revalidate) {
      if (state.valid !== false || !element) {
        return;
      }

      if (!element.validity.valueMissing) {
        // The 'valueMissing' (required) condition has been resolved by the user typing.
        // Temporarily mark the field as valid for this onChange event.
        // Other native errors (e.g., typeMismatch) will be caught by full validation on blur or submit.
        // The required value is now present; ignore stale external invalid state for this pass.
        clearCustomValidity();
        // Clearing can make another registered input with a custom error representative.
        const currentElement = resolveRepresentativeInput();
        const foreign = currentElement?.validity.customError ? getNativeErrors(currentElement) : [];
        publish(makeState(foreign.length > 0), foreign, false);
        return;
      }

      // A stale custom error can coexist with valueMissing, but defer any other native errors.
      for (const key of validityKeys) {
        if (
          key !== 'valid' &&
          key !== 'valueMissing' &&
          key !== 'customError' &&
          element.validity[key]
        ) {
          return;
        }
      }

      // Value is still missing: publish the current native state so valueMissing and the changed
      // value are observable immediately. Full custom validation still waits for its boundary.
    }

    timeout.clear();

    // Do not read Base UI's previous message back as a native constraint.
    clearCustomValidity();

    let nextState: FieldValidityData['state'] = refreshState();
    let validationErrors = getNativeErrors(element);

    const isValidatingOnChange = shouldValidateOnChange();

    // Native or externally set errors take precedence outside onChange validation.
    if (validationErrors.length === 0 || isValidatingOnChange) {
      // call the validate function because either
      // - validating on change, or
      // - native constraint validations passed, custom validity check is next
      const formValues = Array.from(formRef.fields.values()).reduce((acc, field) => {
        if (field.name) {
          acc[field.name] = field.getValue();
        }
        return acc;
      }, {} as Form.Values);

      const resultOrPromise = validate(value, formValues);
      let result: string | string[] | null | void;

      if (
        typeof resultOrPromise === 'object' &&
        resultOrPromise !== null &&
        'then' in resultOrPromise
      ) {
        // Validity is unknown while the validator runs, so go neutral, but keep what must block
        // submission synchronously: native failures, and a previous custom error outside onSubmit
        // mode. A previous native error is never kept, since `nextState` already carries the fresh
        // native verdict.
        if (nextState.valid === false) {
          publish(nextState, validationErrors);
        } else if (untrack(validationMode) === 'onSubmit' || !validityData.state.customError) {
          nextState.valid = null;
          publish(nextState, validationErrors);
        }

        // A rejected validator keeps the previously published state, so a transient
        // failure can't retire an error and unblock submission.
        result = await resultOrPromise;

        if (validationCommitId !== validationCommitIdRef) {
          return;
        }
        nextState = refreshState();
      } else {
        result = resultOrPromise;
      }

      // Empty results and empty array entries are valid.
      validationErrors = result ? ([] as string[]).concat(result).filter(Boolean) : [];

      if (validationErrors.length > 0) {
        nextState.valid = false;
        nextState.customError = true;
        // Keep custom errors for barred controls in field state only.
        if (element?.willValidate) {
          setCustomValidity(element, validationErrors.join('\n'));
        }
      } else {
        validationErrors = getNativeErrors(element);
      }
    }

    publish(nextState, validationErrors);
  };

  const change = (value: unknown, cancelPending = false) => {
    timeout.clear();
    validationCommitIdRef += 1;
    if (cancelPending) {
      return;
    }

    const validateOnChange = shouldValidateOnChange();
    const debounceTime = untrack(validationDebounceTime);

    if (validateOnChange && value !== '' && debounceTime) {
      timeout.start(debounceTime, () => {
        commit(value);
      });
    } else {
      commit(value, !validateOnChange);
    }
  };

  function getValidationProps(
    disabledOrProps?: boolean | HTMLProps | BaseUIHTMLProps,
    externalProps: HTMLProps | BaseUIHTMLProps = {},
  ): BaseUIHTMLProps {
    // Solid: parts not yet ported to 1.8.0 still call the 1.0 `getValidationProps(props)` shape.
    if (typeof disabledOrProps !== 'boolean') {
      return getValidationProps(false, disabledOrProps ?? {});
    }

    return mergeProps<any>(
      getDescriptionProps(externalProps),
      state.valid === false && !state.disabled && !disabledOrProps
        ? { 'aria-invalid': 'true' as const }
        : EMPTY_OBJECT,
    );
  }

  // Solid: the 1.0 input helper, kept for parts not yet ported to 1.8.0 (they validate through
  // this `onInput` instead of calling `validation.change`).
  const getInputValidationProps = (externalProps: HTMLProps | BaseUIHTMLProps = {}) =>
    mergeProps<any>(
      {
        onInput(event: InputEvent) {
          if (event.defaultPrevented) {
            return;
          }

          clearErrors(params.name());
          change((event.currentTarget as HTMLInputElement).value);
        },
      },
      getValidationProps(false, externalProps),
    );

  return {
    getValidationProps,
    getInputValidationProps,
    inputRef,
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change,
  };
}

export interface UseFieldValidationParameters {
  setValidityData: (data: FieldValidityData) => void;
  validate: (
    value: unknown,
    formValues: Form.Values,
  ) => string | string[] | null | void | Promise<string | string[] | null | void>;
  validityData: FieldValidityData;
  validationDebounceTime: Accessor<number>;
  invalid: Accessor<boolean>;
  markedDirtyRef: ReactLikeRef<boolean>;
  state: FieldRootState;
  shouldValidateOnChange: () => boolean;
  validationMode: Accessor<Form.ValidationMode>;
  registeredFieldIdRef: ReactLikeRef<string | undefined>;
  /**
   * Solid: the field name, for the 1.0 `getInputValidationProps` helper.
   */
  name: Accessor<string | undefined>;
}

export interface UseFieldValidationReturnValue {
  getValidationProps: {
    (disabled: boolean, props?: HTMLProps | BaseUIHTMLProps): BaseUIHTMLProps;
    /**
     * @deprecated Solid: 1.0 shape for parts not yet ported to 1.8.0.
     */
    (props?: HTMLProps | BaseUIHTMLProps): BaseUIHTMLProps;
  };
  /**
   * @deprecated Solid: 1.0 helper for parts not yet ported to 1.8.0. Call `change` instead.
   */
  getInputValidationProps: (props?: HTMLProps | BaseUIHTMLProps) => BaseUIHTMLProps;
  inputRef: ReactLikeRef<HTMLInputElement | null | undefined>;
  registeredInputs: RegisteredInputs;
  registerInput: (element: HTMLInputElement, registration: RegisteredInput) => void | (() => void);
  getInputControl: () => HTMLElement | null;
  commit: (value: unknown, revalidate?: boolean) => Promise<void>;
  change: (value: unknown, cancelPending?: boolean) => void;
}
