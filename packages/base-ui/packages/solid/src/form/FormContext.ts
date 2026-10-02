import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { FieldValidityData } from '../field/root/FieldRoot';
import type { ReactLikeRef } from '../solid-helpers';
import { NOOP } from '../utils/noop';
import type { Form } from './Form';

export type Errors = Record<string, string | string[]>;

export interface FormField {
  name: string | undefined;
  /**
   * After this returns, the field registry entry reflects the latest synchronous
   * validity verdict. Async validators do not block submit.
   */
  validate: () => void;
  validityData: FieldValidityData;
  controlRef: ReactLikeRef<HTMLElement | null | undefined>;
  getValue: () => unknown;
}

export type FormRef = {
  fields: Map<string, FormField>;
};

export interface FormContext {
  errors: Accessor<Errors>;
  clearErrors: (name: string | undefined) => void;
  elementRef: ReactLikeRef<HTMLFormElement | null | undefined>;
  /**
   * Mutable registry of the form's fields (React's `formRef.current`). Not reactive.
   */
  formRef: FormRef;
  validationMode: Accessor<Form.ValidationMode>;
  submitCountRef: ReactLikeRef<number>;
}

export const FormContext = createContext<FormContext>({
  elementRef: { current: null },
  formRef: {
    fields: new Map(),
  },
  errors: () => ({}),
  clearErrors: NOOP,
  validationMode: () => 'onSubmit' as const,
  submitCountRef: {
    current: 0,
  },
});

export function useFormContext() {
  return useContext(FormContext);
}
