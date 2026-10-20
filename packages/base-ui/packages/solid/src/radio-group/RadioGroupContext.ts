import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { UseFieldValidationReturnValue } from '../field/root/useFieldValidation';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../utils/reasons';

// Solid: reactive fields are accessors.
export interface RadioGroupContext<Value> {
  disabled: Accessor<boolean | undefined>;
  readOnly: Accessor<boolean | undefined>;
  required: Accessor<boolean | undefined>;
  form: Accessor<string | undefined>;
  name: Accessor<string | undefined>;
  checkedValue: Accessor<Value | undefined>;
  /**
   * Whether `value` is the checked one (`createIdSelector`): a tracked read subscribes to that
   * value only, so a click re-runs the old and the new radio, not every one.
   */
  isChecked: (value: unknown) => boolean;
  setCheckedValue: (
    value: Value,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  touched: Accessor<boolean>;
  setTouched: Setter<boolean>;
  validation?: UseFieldValidationReturnValue | undefined;
  registerInputRef: (element: HTMLInputElement | null) => void | (() => void);
}

export const RadioGroupContext = createContext<RadioGroupContext<any> | null>(null);

export function useRadioGroupContext() {
  return useContext(RadioGroupContext);
}
