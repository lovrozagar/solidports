import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface TooltipProviderContext {
  delay: Accessor<number | undefined>;
  closeDelay: Accessor<number | undefined>;
}

export const TooltipProviderContext = createContext<TooltipProviderContext | null>(null);

export function useTooltipProviderContext(): TooltipProviderContext | undefined {
  return useContext(TooltipProviderContext);
}
