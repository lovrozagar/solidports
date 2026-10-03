import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { Form } from '../../form';
import type { FieldControlRegistration } from '../../internals/field-register-control/useFieldControlRegistration';
import { EMPTY_OBJECT } from '../../utils/constants';
import { NOOP } from '../../utils/noop';
import type { HTMLProps } from '../../utils/types';
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from '../utils/constants';
import type { FieldRootState, FieldValidityData } from './FieldRoot';
import type { UseFieldValidationReturnValue } from './useFieldValidation';

export interface FieldRootContext {
  invalid: Accessor<boolean | undefined>;
  name: Accessor<string | undefined>;
  /**
   * Solid: a live view of the validity data; property reads track the current value.
   */
  validityData: FieldValidityData;
  setValidityData: (
    value: FieldValidityData | ((prev: FieldValidityData) => FieldValidityData),
  ) => void;
  disabled: Accessor<boolean | undefined>;
  setTouched: Setter<boolean>;
  setDirty: Setter<boolean>;
  setFilled: Setter<boolean>;
  /** Derives `filled` from `source` for the lifetime of the current owner. */
  registerFilledSource: (source: Accessor<boolean>) => void;
  /** Derives the field's `dirty` from a control's value (once mounted, until unmounted). */
  registerDirtySource: (source: Accessor<boolean>) => void;
  setFocused: Setter<boolean>;
  validationMode: Accessor<Form.ValidationMode>;
  shouldValidateOnChange: () => boolean;
  state: FieldRootState;
  registerFieldControl: (
    source: symbol,
    registration: FieldControlRegistration | undefined,
  ) => void;
  validation: UseFieldValidationReturnValue;
  /**
   * Solid: accessors for parts that read single state fields; same values as `state`.
   */
  touched: Accessor<boolean>;
  dirty: Accessor<boolean>;
  filled: Accessor<boolean>;
  focused: Accessor<boolean>;
}

export const DEFAULT_FIELD_ROOT_CONTEXT: FieldRootContext = {
  invalid: () => undefined,
  name: () => undefined,
  validityData: {
    state: DEFAULT_VALIDITY_STATE,
    errors: [],
    error: '',
    value: '',
    initialValue: null,
  },
  setValidityData: NOOP,
  disabled: () => undefined,
  setTouched: NOOP as Setter<boolean>,
  setDirty: NOOP as Setter<boolean>,
  setFilled: NOOP as Setter<boolean>,
  registerFilledSource: NOOP,
  registerDirtySource: NOOP,
  setFocused: NOOP as Setter<boolean>,
  validationMode: () => 'onSubmit' as const,
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: ((
      disabledOrProps?: boolean | HTMLProps,
      props: HTMLProps = EMPTY_OBJECT as HTMLProps,
    ) =>
      typeof disabledOrProps === 'boolean'
        ? props
        : (disabledOrProps ?? props)) as UseFieldValidationReturnValue['getValidationProps'],
    getInputValidationProps: (props = EMPTY_OBJECT) => props,
    inputRef: { current: null },
    registeredInputs: new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: async () => {},
    change: NOOP,
  },
  touched: () => false,
  dirty: () => false,
  filled: () => false,
  focused: () => false,
};

export const FieldRootContext = createContext<FieldRootContext>(DEFAULT_FIELD_ROOT_CONTEXT);

export function useFieldRootContext(optional = true) {
  const context = useContext(FieldRootContext);

  if (context.setValidityData === NOOP && !optional) {
    throw new Error(
      'Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.',
    );
  }

  return context;
}
