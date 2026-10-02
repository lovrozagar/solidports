import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { Orientation } from '../../utils/types';
import type { ToolbarRoot } from './ToolbarRoot';

export interface ToolbarRootContext {
  disabled: Accessor<boolean>;
  orientation: Accessor<Orientation>;
  setItemArray: Setter<
    Array<{ element: Element; metadata: CompositeMetadata<ToolbarRoot.ItemMetadata> | null }>
  >;
}

export const ToolbarRootContext = createContext<ToolbarRootContext | null>(null);

export function useToolbarRootContext(optional?: false): ToolbarRootContext;
export function useToolbarRootContext(optional: true): ToolbarRootContext | null;
export function useToolbarRootContext(optional?: boolean) {
  const context = useContext(ToolbarRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  }

  return context;
}
