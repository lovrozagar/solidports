import { createContext, useContext } from 'solid-js';
import type { CollapsibleRootModel } from './useCollapsibleRoot';

/** A Collapsible.Root's or an Accordion.Item's model (`useCollapsibleRoot`). */
export type CollapsibleRootContext = CollapsibleRootModel;

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
