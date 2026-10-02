import { createContext, useContext } from 'solid-js';
import { TooltipStore } from '../store/TooltipStore';

export type TooltipRootContext<Payload = unknown> = {
  store: TooltipStore<Payload>;
};

export const TooltipRootContext = createContext<TooltipRootContext | null>(null);

export function useTooltipRootContext(optional?: false): TooltipRootContext;
export function useTooltipRootContext(optional: true): TooltipRootContext | null;
export function useTooltipRootContext(optional?: boolean) {
  const context = useContext(TooltipRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
    );
  }

  return context;
}
