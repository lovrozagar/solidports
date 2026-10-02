import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface ScrollAreaScrollbarContext {
  orientation: Accessor<'horizontal' | 'vertical'>;
}

export const ScrollAreaScrollbarContext = createContext<ScrollAreaScrollbarContext | null>(null);

export function useScrollAreaScrollbarContext() {
  const context = useContext(ScrollAreaScrollbarContext);
  if (context == null) {
    throw new Error(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  }
  return context;
}
