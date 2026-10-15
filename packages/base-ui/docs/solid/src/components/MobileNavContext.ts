import { createContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export const MobileNavContext = createContext<
  Accessor<{
    close: () => void;
    closeAndScrollTop: () => void;
    closeAndScrollTopAfterNavigation: (nextPathname: string) => void;
  }>
>(() => ({
  close: () => {},
  closeAndScrollTop: () => {},
  closeAndScrollTopAfterNavigation: () => {},
}));
