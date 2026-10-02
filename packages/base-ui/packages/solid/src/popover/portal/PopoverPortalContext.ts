import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const PopoverPortalContext = createContext<Accessor<boolean> | null>(null);

export function usePopoverPortalContext() {
  const value = useContext(PopoverPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Popover.Portal> is missing.');
  }
  return value;
}
