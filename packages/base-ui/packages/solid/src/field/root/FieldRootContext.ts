/* eslint-disable typescript/no-explicit-any -- field validation pipeline accepts arbitrary value types */
import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { Store } from 'solid-js';
import type { Form } from '../../form';
import type { ReactLikeRef } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { NOOP } from '../../utils/noop';
import { DEFAULT_VALIDITY_STATE } from '../utils/constants';
import type { FieldRoot, FieldValidityData } from './FieldRoot';
import type { UseFieldValidationReturnValue } from './useFieldValidation';
import { type SetStoreFunction } from '../../solid-1-compat';

export interface FieldRootContext {
  invalid: Accessor<boolean | undefined>;
  name: Accessor<string | undefined>;
  validityData: Store<FieldValidityData>;
  setValidityData: SetStoreFunction<FieldValidityData>;
  disabled: Accessor<boolean | undefined>;
  touched: Accessor<boolean>;
  setTouched: Setter<boolean>;
  dirty: Accessor<boolean>;
  setDirty: Setter<boolean>;
  filled: Accessor<boolean>;
  setFilled: Setter<boolean>;
  focused: Accessor<boolean>;
  setFocused: Setter<boolean>;
  validate: (
    value: unknown,
    formValues: Record<string, unknown>,
  ) => string | string[] | null | Promise<string | string[] | null>;
  validationMode: Accessor<Form.ValidationMode>;
  validationDebounceTime: Accessor<number>;
  shouldValidateOnChange: () => boolean;
  state: FieldRoot.State;
  markedDirtyRef: ReactLikeRef<boolean>;
  validation: UseFieldValidationReturnValue;
}

export const FieldRootContext = createContext<FieldRootContext>({
  dirty: () => false,
  disabled: () => undefined,
  filled: () => false,
  focused: () => false,
  invalid: () => undefined,
  markedDirtyRef: { current: false },
  name: () => undefined,
  setDirty: NOOP as Setter<any>,
  setFilled: NOOP as Setter<any>,
  setFocused: NOOP as Setter<any>,
  setTouched: NOOP as Setter<any>,
  setValidityData: NOOP,
  shouldValidateOnChange: () => false,
  state: {
    dirty: false,
    disabled: false,
    filled: false,
    focused: false,
    touched: false,
    valid: null,
  },
  touched: () => false,
  validate: () => null,
  validation: {
    commit: async () => {},
    getInputValidationProps: (props = EMPTY_OBJECT) => props,
    getValidationProps: (props = EMPTY_OBJECT) => props,
    inputRef: { current: null },
  },
  validationDebounceTime: () => 0,
  validationMode: () => 'onSubmit' as const,
  validityData: {
    error: '',
    errors: [],
    initialValue: null,
    state: DEFAULT_VALIDITY_STATE,
    value: '',
  },
});

export function useFieldRootContext(optional = true) {
  const context = useContext(FieldRootContext);

  if (context.setValidityData === NOOP && !optional) {
    throw new Error(
      'Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.',
    );
  }

  return context;
}
