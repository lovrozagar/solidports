import { createContext, useContext } from 'solid-js';
import type { PopoverStore } from '../store/PopoverStore';

export interface PopoverRootContext<Payload = unknown> {
  store: PopoverStore<Payload>;
}

export const PopoverRootContext = createContext<PopoverRootContext | null>(null);

export function usePopoverRootContext(optional?: false): PopoverRootContext;
export function usePopoverRootContext(optional: true): PopoverRootContext | null;
export function usePopoverRootContext(optional?: boolean) {
  const context = useContext(PopoverRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>.',
    );
  }
  return context;
}
