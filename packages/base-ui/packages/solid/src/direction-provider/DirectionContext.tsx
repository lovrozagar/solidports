import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export type TextDirection = 'ltr' | 'rtl';

export type DirectionContext = {
  direction: Accessor<TextDirection>;
};

/**
 * @internal
 */
export const DirectionContext = createContext<DirectionContext | null>(null);

export function useDirection() {
  const context = useContext(DirectionContext);
  return () => context?.direction() ?? 'ltr';
}
