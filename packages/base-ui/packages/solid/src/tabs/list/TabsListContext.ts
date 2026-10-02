/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { TabsRoot } from '../root/TabsRoot';

export interface TabsListContext {
  activateOnFocus: Accessor<boolean>;
  highlightedTabIndex: Accessor<number>;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
  onTabActivation: (newValue: any, eventDetails: TabsRoot.ChangeEventDetails) => void;
  setHighlightedTabIndex: (index: number) => void;
  tabsListElement: Accessor<HTMLElement | null | undefined>;
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
