import { createContext, useContext } from 'solid-js';
import { type MaybeAccessor } from '../../solid-helpers';

export const SelectPortalContext = createContext<MaybeAccessor<boolean> | null>(null);

export function useSelectPortalContext() {
  const value = useContext(SelectPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Select.Portal> is missing.');
  }
  return value;
}
