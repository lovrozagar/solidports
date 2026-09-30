/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { batch, createEffect, createRenderEffect, createSignal, on, type JSX } from 'solid-js';
import { warn } from '../../utils/warn';
import { ownerDocument } from '../../utils/owner';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { contains } from '../../floating-ui-solid/utils';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useField } from '../../field/useField';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useControlled } from '../../utils/useControlled';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { createChangeEventDetails, createGenericEventDetails } from '../../utils/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../../types';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  stripOTPWhitespace,
  type OTPValidationType,
} from '../utils/otp';
import type { FieldRootState } from '../../field/root/FieldRoot';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldRoot(componentProps: OTPFieldRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'aria-describedby',
    'aria-labelledby',
    'id',
    'autoComplete',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueComplete',
    'form',
    'length',
    'autoSubmit',
    'mask',
    'inputMode',
    'validationType',
    'sanitizeValue',
    'disabled',
    'readOnly',
    'required',
    'name',
    'onValueInvalid',
  ]);

  const ariaDescribedByProp = () => local['aria-describedby'];
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const idProp = () => local.id;
  const autoComplete = () => local.autoComplete ?? 'one-time-code';
  const autoSubmit = () => local.autoSubmit ?? false;
  const mask = () => local.mask ?? false;
  const inputModeProp = () => local.inputMode;
  const validationType = () => local.validationType ?? ('numeric' as OTPValidationType);
  const sanitizeValue = () => local.sanitizeValue;
  const disabledProp = () => local.disabled ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const nameProp = () => local.name;
  const length = () => local.length;
  const form = () => local.form;

  const {
    setDirty,
    validityData,
    disabled: fieldDisabled,
    setFilled,
    invalid,
    name: fieldName,
    state: fieldState,
    validation,
    validationMode,
    shouldValidateOnChange,
    setFocused,
    setTouched,
  } = useFieldRootContext();

  const { clearErrors } = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  const disabled = () => fieldDisabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();

  const [valueUnwrapped, setValueUnwrapped] = useControlled<string>({
    controlled: () => local.value,
    default: () => local.defaultValue,
    name: 'OTPField',
    state: 'value',
  });

  /* holds the sorted array of registered input elements */
  const inputElements: Array<HTMLInputElement | null | undefined> = [];
  let rootRef: HTMLDivElement | null = null;
  const pendingCompleteValueRef = useRef<{
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null>(null);

  const firstInputRef = () => inputElements[0] ?? null;

  const id = useLabelableId({ id: idProp });
  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, firstInputRef, true, id);
  const inputAriaLabelledBy = () => (ariaLabelledByProp() == null ? ariaLabelledBy() : undefined);

  const fieldDescriptionProps = getDescriptionProps({});
  const ariaDescribedBy = () =>
    mergeAriaIds(fieldDescriptionProps['aria-describedby'] as string | undefined, ariaDescribedByProp());

  const validationConfig = () => getOTPValidationConfig(validationType());
  const pattern = () => validationConfig()?.slotPattern;
  const hiddenInputPattern = () => validationConfig()?.getRootPattern(length());
  const inputMode = () => inputModeProp() ?? validationConfig()?.inputMode;
  const hasValidLength = () => Number.isInteger(length()) && length() > 0;

  const value = () => normalizeOTPValue(valueUnwrapped(), length(), validationType(), sanitizeValue());
  const filled = () => value() !== '';

  const [inputCount, setInputCount] = createSignal(0);
  const [focusedIndex, setFocusedIndex] = createSignal(Math.min(value().length, length() - 1));
  const [focused, setFocusedState] = createSignal(false);

  const activeIndex = () => {
    const v = value();
    const l = length();
    if (focused()) {
      return Math.min(focusedIndex(), Math.max(l - 1, 0));
    }
    return Math.min(v.length, l - 1);
  };

  createEffect(
    on(filled, (f) => {
      setFilled(f);
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    createEffect(() => {
      const count = inputCount();
      const len = length();
      if (!Number.isInteger(len) || len <= 0 || count === 0 || count === len) {
        return;
      }
      warn(
        '<OTPField.Root> `length` must match the number of rendered ' +
          `<OTPField.Input /> parts. Received \`length={${len}}\` but rendered ` +
          `${count} input${count === 1 ? '' : 's'}.`,
        '',
      );
    });

    createEffect(() => {
      const len = length();
      if (Number.isInteger(len) && len > 0) {
        return;
      }
      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(len)}}\`.`,
        '',
      );
    });

    createEffect(() => {
      const sv = sanitizeValue();
      const vt = validationType();
      if (sv == null || vt === 'none') {
        return;
      }
      warn('<OTPField.Root> `sanitizeValue` is only used when `validationType="none"`.', '');
    });
  }

  /* Use the solid `useField` hook — equivalent to useRegisterFieldControl in React. */
  useField({
    commit: validation.commit,
    controlRef: firstInputRef,
    getValue: value,
    id,
    name,
    value,
  });

  function focusInput(index: number) {
    const targetIndex = Math.min(
      Math.max(index, 0),
      Math.max(inputElements.length - 1, 0),
    );
    const target = inputElements[targetIndex];
    target?.focus();
    target?.select();
  }

  /* In Solid, signal updates are synchronous and inputElements is already populated at
     mount, so focus can be applied immediately rather than deferred via a ref+effect. */
  function queueFocusInput(index: number, _nextValue: string) {
    focusInput(index);
  }

  function requestSubmit() {
    let formElement =
      validation.inputRef.current?.form ?? inputElements[0]?.form ?? null;

    const formProp = form();
    if (formProp) {
      const associatedElement = ownerDocument(rootRef).getElementById(formProp);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  /* Track previous value to skip the initial run — mirrors React's useValueChanged
     pattern (useLayoutEffect + ref). createRenderEffect runs synchronously on updates,
     matching React's useLayoutEffect commit-phase timing. */
  const prevValueRef = useRef<string | undefined>(undefined);
  createRenderEffect(() => {
    const currentValue = value();
    const previousValue = prevValueRef.current;
    prevValueRef.current = currentValue;

    if (previousValue === undefined || previousValue === currentValue) {
      return;
    }

    clearErrors(name());
    setDirty(currentValue !== validityData.initialValue);

    if (shouldValidateOnChange()) {
      validation.commit(currentValue);
    } else {
      validation.commit(currentValue, true);
    }

    const pendingCompleteValue = pendingCompleteValueRef.current;
    if (pendingCompleteValue != null) {
      pendingCompleteValueRef.current = null;
      if (pendingCompleteValue.value === currentValue) {
        local.onValueComplete?.(currentValue, pendingCompleteValue.eventDetails);
        if (autoSubmit()) {
          requestSubmit();
        }
      }
    }

  });

  function setValue(
    nextValue: string,
    details: OTPFieldRoot.ChangeEventDetails,
  ): string | null {
    const currentValue = value();
    const normalizedValue = normalizeOTPValue(nextValue, length(), validationType(), sanitizeValue());

    if (normalizedValue === currentValue) {
      return null;
    }

    local.onValueChange?.(normalizedValue, details);

    if (details.isCanceled) {
      return null;
    }

    setValueUnwrapped(normalizedValue);

    if (normalizedValue.length === length() && currentValue.length !== length()) {
      pendingCompleteValueRef.current = {
        eventDetails: createGenericEventDetails(details.reason, details.event),
        value: normalizedValue,
      };
    } else if (normalizedValue.length !== length()) {
      pendingCompleteValueRef.current = null;
    }

    return normalizedValue;
  }

  function reportValueInvalid(
    invalidValue: string,
    details: OTPFieldRoot.InvalidEventDetails,
  ) {
    local.onValueInvalid?.(invalidValue, details);
  }

  function handleInputFocus(
    index: number,
    event: FocusEvent & { currentTarget: HTMLInputElement },
  ) {
    if (index > value().length) {
      focusInput(Math.min(value().length, length() - 1));
      return;
    }

    batch(() => {
      setFocusedIndex(index);
      setFocusedState(true);
      setFocused(true);
    });
    event.currentTarget.select();
  }

  function handleInputBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    if (contains(rootRef, event.relatedTarget as Element | null)) {
      return;
    }

    batch(() => {
      setTouched(true);
      setFocusedState(false);
      setFocused(false);
    });

    if (validationMode() === 'onBlur') {
      validation.commit(value());
    }
  }

  function getInputId(index: number): string | undefined {
    const idVal = id();
    if (idVal == null) {
      return undefined;
    }
    return index === 0 ? idVal : `${idVal}-${index + 1}`;
  }

  const state: OTPFieldRootState = {
    get complete() {
      return value().length === length();
    },
    get dirty() {
      return fieldState.dirty;
    },
    get disabled() {
      return disabled();
    },
    get filled() {
      return filled();
    },
    get focused() {
      return focused();
    },
    get length() {
      return length();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get touched() {
      return fieldState.touched;
    },
    get valid() {
      return fieldState.valid;
    },
    get value() {
      return value();
    },
  };

  const contextValue: OTPFieldRootContext = {
    activeIndex,
    autoComplete,
    disabled,
    focusInput,
    form,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    inputAriaLabelledBy,
    inputMode,
    invalid,
    length,
    mask,
    pattern,
    queueFocusInput,
    readOnly,
    reportValueInvalid,
    required,
    sanitizeValue,
    setValue,
    state,
    validationType,
    value,
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        role: 'group',
        get 'aria-describedby'() {
          return ariaDescribedBy();
        },
        get 'aria-labelledby'() {
          return ariaLabelledBy();
        },
      },
      elementProps,
    ],
    ref: (el: HTMLDivElement | null | undefined) => {
      rootRef = el ?? null;
    },
    state,
    stateAttributesMapping: rootStateAttributesMapping,
  });

  const hiddenInputProps = () => {
    const validationProps = validation.getInputValidationProps({
      onFocus() {
        focusInput(0);
      },
      /* Handles password-manager autofill via the hidden input. */
      onChange(event: Event & { currentTarget: HTMLInputElement }) {
        if ((event as any).nativeEvent?.defaultPrevented) {
          return;
        }

        const rawValue = event.currentTarget.value;
        const normalizedValue = normalizeOTPValue(
          rawValue,
          length(),
          validationType(),
          sanitizeValue(),
        );

        if (stripOTPWhitespace(rawValue).length > normalizedValue.length) {
          reportValueInvalid(
            rawValue,
            createGenericEventDetails(REASONS.inputChange, event),
          );
        }

        const committedValue = setValue(
          normalizedValue,
          createChangeEventDetails(REASONS.inputChange, event),
        );

        if (committedValue != null && committedValue !== '') {
          queueFocusInput(committedValue.length - 1, committedValue);
        }
      },
    });
    return validationProps;
  };

  return (
    <CompositeList
      refs={{ elements: inputElements }}
      onMapChange={(newMap) => {
        setInputCount(newMap.length);
      }}
    >
      <OTPFieldRootContext.Provider value={contextValue}>
        {element()}
        {hasValidLength() && (
          <input
            {...(hiddenInputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)}
            ref={validation.inputRef.current as HTMLInputElement | undefined}
            type="text"
            id={id() && name() == null ? `${id()}-hidden-input` : undefined}
            form={form()}
            name={name()}
            value={value()}
            autocomplete={autoComplete()}
            inputMode={inputMode()}
            minLength={length()}
            maxLength={length()}
            pattern={hiddenInputPattern()}
            disabled={disabled()}
            readOnly={readOnly()}
            required={required()}
            aria-hidden
            tabIndex={-1}
            style={name() ? visuallyHiddenInput : visuallyHidden}
          />
        )}
      </OTPFieldRootContext.Provider>
    </CompositeList>
  );
}

export interface OTPFieldRootState extends FieldRootState {
  /** Whether all slots are filled. */
  complete: boolean;
  /** Whether the component should ignore user interaction. */
  disabled: boolean;
  /** The number of OTP input slots. */
  length: number;
  /** Whether the user should be unable to change the field value. */
  readOnly: boolean;
  /** Whether the user must enter a value before submitting a form. */
  required: boolean;
  /** The OTP value. */
  value: string;
}

export interface OTPFieldRootProps
  extends Omit<BaseUIComponentProps<'div', OTPFieldRootState>, 'onChange'> {
  /** The id of the first input element. */
  id?: string | undefined;
  /** @default 'one-time-code' */
  autoComplete?: string | undefined;
  form?: string | undefined;
  /** Required: number of OTP input slots. */
  length: number;
  /** @default false */
  autoSubmit?: boolean | undefined;
  /** @default false */
  mask?: boolean | undefined;
  inputMode?: JSX.HTMLAttributes<HTMLInputElement>['inputMode'] | undefined;
  /** @default 'numeric' */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  sanitizeValue?: ((value: string) => string) | undefined;
  /** @default false */
  required?: boolean | undefined;
  /** @default false */
  disabled?: boolean | undefined;
  /** @default false */
  readOnly?: boolean | undefined;
  name?: string | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?:
    | ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void)
    | undefined;
  onValueInvalid?:
    | ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void)
    | undefined;
  onValueComplete?:
    | ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void)
    | undefined;
}

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  BaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

/* OTPFieldRootContext re-export for consumers that only import root */
export type { OTPFieldRootContext } from './OTPFieldRootContext';

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}
