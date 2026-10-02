import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Store } from 'solid-js';
import type { FieldValidityData } from '../field/root/FieldRoot';
import { NOOP } from '../utils/noop';
import type { Form } from './Form';
import { type SetStoreFunction } from '../solid-1-compat';

export type Errors = Record<string, string | string[]>;

type FormRef = {
  fields: Record<
    string,
    {
      name: string | undefined;
      validate: (flushSync?: boolean | undefined) => void;
      validityData: FieldValidityData;
      controlRef: HTMLElement | null | undefined;
      getValue: () => unknown;
    }
  >;
};

export interface FormContext {
  errors: Accessor<Errors>;
  clearErrors: (name: string | undefined) => void;
  formRef: Store<FormRef>;
  setFormRef: SetStoreFunction<FormRef>;
  validationMode: Accessor<Form.ValidationMode>;
  submitAttemptedRef: Accessor<boolean>;
}

export const FormContext = createContext<FormContext>({
  clearErrors: NOOP,
  errors: () => ({}),
  formRef: {
    fields: {},
  },
  setFormRef: NOOP,
  submitAttemptedRef: () => false,
  validationMode: () => 'onSubmit' as const,
});

export function useFormContext() {
  return useContext(FormContext);
}
