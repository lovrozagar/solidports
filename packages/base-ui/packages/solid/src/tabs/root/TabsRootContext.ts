import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsRoot } from './TabsRoot';

export interface TabsRootContext {
  value: Accessor<TabsTab.Value>;
  onValueChange: (value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void;
  orientation: Accessor<'horizontal' | 'vertical'>;
  getTabElementBySelectedValue: (selectedValue: TabsTab.Value) => HTMLElement | null;
  getTabIdByPanelValue: (panelValue: TabsTab.Value) => string | undefined;
  getTabPanelIdByValue: (tabValue: TabsTab.Value) => string | undefined;
  registerMountedTabPanel: (panelValue: TabsTab.Value, panelId: string) => () => void;
  /**
   * Solid: receives `CompositeList`'s sorted items (React passes a `Map`).
   */
  setTabMap: (
    entries: Array<{ element: Element; metadata: CompositeMetadata<TabsTab.Metadata> | null }>,
  ) => void;
  tabActivationDirection: Accessor<TabsTab.ActivationDirection>;
}

export const TabsRootContext = createContext<TabsRootContext | null>(null);

export function useTabsRootContext() {
  const context = useContext(TabsRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.',
    );
  }

  return context;
}
