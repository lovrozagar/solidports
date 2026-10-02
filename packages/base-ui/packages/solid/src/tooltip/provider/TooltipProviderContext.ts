import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

/**
 * The provider's open delay. Solid: an accessor, so consumers read the latest value.
 */
export const TooltipProviderContext = createContext<Accessor<number | undefined> | null>(null);

export function useTooltipProviderContext(): Accessor<number | undefined> | null {
  return useContext(TooltipProviderContext);
}
