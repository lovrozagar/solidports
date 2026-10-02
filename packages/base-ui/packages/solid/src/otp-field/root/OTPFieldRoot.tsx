/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '../../utils/warn';
import { ownerDocument } from '../../utils/owner';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { contains } from '../../floating-ui-solid/utils';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useControlled } from '../../utils/useControlled';
import { createDepsEffect, splitComponentProps, useRef } from '../../solid-helpers';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails, BaseUIGenericEventDetails } from '../../types';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
  type OTPValidationType,
} from '../utils/otp';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { on } from '../../solid-1-compat';

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
    'normalizeValue',
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
  const normalizeValue = () => local.normalizeValue;
  const disabledProp = () => Boolean(local.disabled);
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

  const [inputCount, setInputCount] = createSignal(0);

  /* holds the sorted array of registered input elements */
  const inputElements: Array<HTMLInputElement | null | undefined> = [];
  let rootRef: HTMLDivElement | null = null;
  const pendingCompleteValueRef = useRef<{
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null>(null);

  // Solid: reads `inputCount` so label lookups re-run once the slots register, as React's
  // label fallback re-runs after every commit.
  const firstInputRef = () => {
    inputCount();
    return inputElements[0] ?? null;
  };

  const id = useLabelableId({ id: idProp });
  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, firstInputRef, true, id);
  const inputAriaLabelledBy = () => (ariaLabelledByProp() == null ? ariaLabelledBy() : undefined);

  const fieldDescriptionProps = getDescriptionProps({});
  const ariaDescribedBy = () => {
    const describedBy = ariaDescribedByProp();
    return mergeAriaIds(
      typeof describedBy === 'string' ? describedBy : undefined,
      fieldDescriptionProps['aria-describedby'] as string | undefined,
    );
  };

  const validationConfig = () => getOTPValidationConfig(validationType());
  const pattern = () => validationConfig()?.slotPattern;
  const hiddenInputPattern = () => validationConfig()?.getRootPattern(length());
  const inputMode = () => inputModeProp() ?? validationConfig()?.inputMode;
  const hasValidLength = () => Number.isInteger(length()) && length() > 0;

  const value = () =>
    normalizeOTPValue(valueUnwrapped(), length(), validationType(), normalizeValue());
  const filled = () => value() !== '';

  const [focusedIndex, setFocusedIndex] = createSignal(
    untrack(() => Math.min(value().length, length() - 1)),
  );
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
    ...on(filled, (f) => {
      setFilled(f);
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({ inputCount: inputCount(), length: length() }),
      ({ inputCount: count, length: len }) => {
        if (!Number.isInteger(len) || len <= 0 || count === 0 || count === len) {
          return;
        }
        warn(
          '<OTPField.Root> `length` must match the number of rendered ' +
            `<OTPField.Input /> parts. Received \`length={${len}}\` but rendered ` +
            `${count} input${count === 1 ? '' : 's'}.`,
          '',
        );
      },
    );

    createEffect(length, (len) => {
      if (Number.isInteger(len) && len > 0) {
        return;
      }
      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(len)}}\`.`,
        '',
      );
    });
  }

  // Solid: a ref-shaped view of the first slot, as React's `firstInputRef`.
  const firstInputControlRef = {
    get current() {
      return inputElements[0] ?? null;
    },
  };

  useRegisterFieldControl(firstInputControlRef, id, value, undefined, () => !disabled(), nameProp);

  function focusInput(index: number) {
    const targetIndex = Math.min(Math.max(index, 0), Math.max(inputElements.length - 1, 0));
    const target = inputElements[targetIndex];
    target?.focus();
    target?.select();
  }

  /* Solid 2 batches signal writes until the next flush, so move focus only once the value
     that queued it has committed (same as React's pending focus ref). */
  const pendingFocusRef = useRef<{ index: number; value: string } | null>(null);
  function queueFocusInput(index: number, nextValue: string) {
    pendingFocusRef.current = { index, value: nextValue };
  }

  function requestSubmit() {
    let formElement = validation.inputRef.current?.form ?? inputElements[0]?.form ?? null;

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
     pattern (layout effect + ref). Solid: a user effect, so it runs after the slots' DOM
     bindings, as React's layout effect runs after commit (`select()` must see the new value). */
  const prevValueRef = useRef<string | undefined>(undefined);
  createEffect(value, (currentValue) => {
    const previousValue = prevValueRef.current;
    prevValueRef.current = currentValue;

    if (previousValue === undefined || previousValue === currentValue) {
      return;
    }

    clearErrors(untrack(name));
    setDirty(currentValue !== validityData.initialValue);

    validation.change(currentValue);

    const pendingFocus = pendingFocusRef.current;
    if (pendingFocus != null) {
      pendingFocusRef.current = null;
      if (pendingFocus.value === currentValue) {
        focusInput(pendingFocus.index);
      }
    }

    const pendingCompleteValue = pendingCompleteValueRef.current;
    if (pendingCompleteValue != null) {
      pendingCompleteValueRef.current = null;
      if (pendingCompleteValue.value === currentValue) {
        completeValue(currentValue, pendingCompleteValue.eventDetails);
      }
    }
  });

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    local.onValueComplete?.(completedValue, eventDetails);
    if (autoSubmit()) {
      requestSubmit();
    }
  }

  function setValue(nextValue: string, details: OTPFieldRoot.ChangeEventDetails): string | null {
    const currentValue = value();
    const normalizedValue = normalizeOTPValue(
      nextValue,
      length(),
      validationType(),
      normalizeValue(),
    );
    const canComplete =
      details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
    const completeEventDetails =
      canComplete &&
      normalizedValue.length === length() &&
      (currentValue.length !== length() || details.reason === REASONS.inputPaste)
        ? createGenericEventDetails(details.reason, details.event)
        : null;

    if (normalizedValue === currentValue) {
      if (completeEventDetails != null) {
        completeValue(normalizedValue, completeEventDetails);
      }
      return null;
    }

    local.onValueChange?.(normalizedValue, details);

    if (details.isCanceled) {
      return null;
    }

    setValueUnwrapped(normalizedValue);

    if (completeEventDetails != null) {
      pendingCompleteValueRef.current = {
        eventDetails: completeEventDetails,
        value: normalizedValue,
      };
    } else if (normalizedValue.length !== length()) {
      pendingCompleteValueRef.current = null;
    }

    return normalizedValue;
  }

  function reportValueInvalid(invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) {
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

    {
      setFocusedIndex(index);
      setFocusedState(true);
      setFocused(true);
    }
    event.currentTarget.select();
  }

  function handleInputBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    if (contains(rootRef, event.relatedTarget as Element | null)) {
      return;
    }

    {
      setTouched(true);
      setFocusedState(false);
      setFocused(false);
    }

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
    normalizeValue,
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
    const validationProps = validation.getValidationProps(disabled(), {
      onFocus() {
        focusInput(0);
      },
      // Solid: `onInput` is React's `onChange` (fires on every edit, including autofill).
      onInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
        if (event.defaultPrevented || disabled() || readOnly()) {
          return;
        }

        const rawValue = event.currentTarget.value;
        const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
          rawValue,
          length(),
          validationType(),
          normalizeValue(),
        );

        if (didRejectCharacters) {
          reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
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
      <OTPFieldRootContext value={contextValue}>
        {element()}
        {hasValidLength() && (
          <input
            {...(hiddenInputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)}
            ref={(el) => {
              validation.inputRef.current = el;
            }}
            type="text"
            id={id() && name() == null ? `${id()}-hidden-input` : undefined}
            form={form()}
            name={name()}
            value={value()}
            autocomplete={autoComplete()}
            inputmode={inputMode()}
            minlength={length()}
            maxlength={length()}
            pattern={hiddenInputPattern()}
            disabled={disabled()}
            readonly={readOnly()}
            required={required()}
            aria-hidden="true"
            tabindex={-1}
            style={name() ? visuallyHiddenInput : visuallyHidden}
          />
        )}
      </OTPFieldRootContext>
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

export interface OTPFieldRootProps extends Omit<
  BaseUIComponentProps<'div', OTPFieldRootState>,
  'onChange'
> {
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
  inputMode?: JSX.HTMLAttributes<HTMLInputElement>['inputmode'] | undefined;
  /** @default 'numeric' */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
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
    ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void) | undefined;
  onValueInvalid?:
    ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void) | undefined;
  onValueComplete?:
    ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void) | undefined;
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
  typeof REASONS.inputChange | typeof REASONS.inputPaste;
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
