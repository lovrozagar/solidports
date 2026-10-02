import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';
import type { NumberFieldRoot, NumberFieldRootState } from './NumberFieldRoot';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';

export type InputMode = 'numeric' | 'decimal' | 'text';

export interface NumberFieldRootContext {
  minWithDefault: Accessor<number>;
  maxWithDefault: Accessor<number>;
  id: Accessor<string | undefined>;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputRef: ReactLikeRef<HTMLInputElement | null>;
  focusInput: () => void;
  allowInputSyncRef: ReactLikeRef<boolean | null>;
  formatOptionsRef: ReactLikeRef<Intl.NumberFormatOptions | undefined>;
  valueRef: ReactLikeRef<number | null>;
  lastChangedValueRef: ReactLikeRef<number | null>;
  hasPendingCommitRef: ReactLikeRef<boolean>;
  name: Accessor<string | undefined>;
  nameProp: Accessor<string | undefined>;
  inputMode: Accessor<InputMode>;
  getAllowedNonNumericKeys: () => Set<string>;
  min: Accessor<number | undefined>;
  max: Accessor<number | undefined>;
  setInputValue: Setter<string>;
  locale: Accessor<Intl.LocalesArgument>;
  setIsScrubbing: Setter<boolean>;
  state: NumberFieldRootState;
  onValueCommitted: (
    value: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => void;
}

export const NumberFieldRootContext = createContext<NumberFieldRootContext | null>(null);

export function useNumberFieldRootContext() {
  const context = useContext(NumberFieldRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.',
    );
  }

  return context;
}
