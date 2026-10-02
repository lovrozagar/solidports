import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface ToolbarGroupContext {
  disabled: Accessor<boolean>;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContext | null>(null);

export function useToolbarGroupContext(optional?: false): ToolbarGroupContext;
export function useToolbarGroupContext(optional: true): ToolbarGroupContext | null;
export function useToolbarGroupContext(optional?: boolean) {
  const context = useContext(ToolbarGroupContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ToolbarGroupContext is missing. ToolbarGroup parts must be placed within <Toolbar.Group>.',
    );
  }
  return context;
}
