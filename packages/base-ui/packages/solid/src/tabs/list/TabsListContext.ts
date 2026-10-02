import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface TabsListContext {
  activateOnFocus: Accessor<boolean>;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
  tabsListElement: Accessor<HTMLElement | null>;
}

export const TabsListContext = createContext<TabsListContext | null>(null);

export function useTabsListContext() {
  const context = useContext(TabsListContext);
  if (context == null) {
    throw new Error(
      'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
    );
  }

  return context;
}
