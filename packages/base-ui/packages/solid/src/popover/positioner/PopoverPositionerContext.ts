import { createContext, useContext } from 'solid-js';
import type { useAnchorPositioning } from '../../utils/useAnchorPositioning';

export type PopoverPositionerContext = useAnchorPositioning.ReturnValue;

export const PopoverPositionerContext = createContext<PopoverPositionerContext | null>(null);

export function usePopoverPositionerContext() {
  const context = useContext(PopoverPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
    );
  }
  return context;
}
