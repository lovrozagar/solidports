import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { OTPFieldRoot, OTPFieldRootState } from './OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';
import type { JSX } from '@solidjs/web';

export interface OTPFieldRootContext {
  activeIndex: Accessor<number>;
  autoComplete: Accessor<string | undefined>;
  disabled: Accessor<boolean>;
  form: Accessor<string | undefined>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  handleInputFocus: (index: number, event: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  inputMode: Accessor<JSX.HTMLAttributes<HTMLInputElement>['inputmode']>;
  inputAriaLabelledBy: Accessor<string | undefined>;
  invalid: Accessor<boolean | undefined>;
  length: Accessor<number>;
  mask: Accessor<boolean>;
  pattern: Accessor<string | undefined>;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  normalizeValue: Accessor<((value: string) => string) | undefined>;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: Accessor<OTPFieldRoot.ValidationType>;
  value: Accessor<string>;
}

export const OTPFieldRootContext = createContext<OTPFieldRootContext | null>(null);

export function useOTPFieldRootContext() {
  const context = useContext(OTPFieldRootContext);

  if (context == null) {
    throw new Error(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: string,
  index: number,
): OTPFieldInputState {
  return {
    ...state,
    filled: value !== '',
    index,
    value,
  };
}
