import { createContext, useContext } from 'solid-js';
import type { RadioRootState } from './RadioRoot';

export type RadioRootContext = RadioRootState;

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
