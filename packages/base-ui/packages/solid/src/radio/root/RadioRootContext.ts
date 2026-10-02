import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { FieldRoot } from '../../field/root/FieldRoot';
import type { Accessorify } from '../../floating-ui-solid';

export interface RadioRootContext extends Accessorify<FieldRoot.State> {
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  checked: Accessor<boolean>;
  required: Accessor<boolean>;
}

export const RadioRootContext = createContext<RadioRootContext | null>(null);

export function useRadioRootContext() {
  const value = useContext(RadioRootContext);
  if (value == null) {
    throw new Error(
      'Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.',
    );
  }

  return value;
}
