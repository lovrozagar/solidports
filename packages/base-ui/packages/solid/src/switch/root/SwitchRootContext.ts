import { createContext, useContext } from 'solid-js';
import type { SwitchRootState } from './SwitchRoot';

export type SwitchRootContext = SwitchRootState;

export const SwitchRootContext = createContext<SwitchRootContext | null>(null);

export function useSwitchRootContext() {
  const context = useContext(SwitchRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  }

  return context;
}
