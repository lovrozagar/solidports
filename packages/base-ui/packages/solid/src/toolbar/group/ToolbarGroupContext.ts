import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface ToolbarGroupContext {
  disabled: Accessor<boolean>;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContext | null>(null);

export function useToolbarGroupContext(): ToolbarGroupContext | null {
  return useContext(ToolbarGroupContext);
}
