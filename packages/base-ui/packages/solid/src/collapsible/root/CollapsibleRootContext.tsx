import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { CollapsibleRoot } from './CollapsibleRoot';
import type { useCollapsibleRoot } from './useCollapsibleRoot';

export interface CollapsibleRootContext extends useCollapsibleRoot.ReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  state: CollapsibleRoot.State;
  transitionStatus: Accessor<TransitionStatus>;
}

export const CollapsibleRootContext = createContext<CollapsibleRootContext | null>(null);

export function useCollapsibleRootContext() {
  const context = useContext(CollapsibleRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
    );
  }

  return context;
}
