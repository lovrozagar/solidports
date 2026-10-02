import { Show } from 'solid-js';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTransitionStatus, type TransitionStatus } from '../../utils/useTransitionStatus';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTab } from '../tab/TabsTab';
import { TabsPanelDataAttributes } from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsPanel(componentProps: TabsPanel.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['value', 'keepMounted']);
  const keepMounted = () => local.keepMounted ?? false;

  const {
    value: selectedValue,
    getTabIdByPanelValue,
    orientation,
    tabActivationDirection,
    registerMountedTabPanel,
  } = useTabsRootContext();

  const id = useBaseUiId();

  const { setRef: setListItemRef, index } = useCompositeListItem();

  const open = () => local.value === selectedValue();
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
  const hidden = () => !mounted();

  const correspondingTabId = () => getTabIdByPanelValue(local.value);

  const state: TabsPanelState = {
    get hidden() {
      return hidden();
    },
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  let panelRef = null as HTMLDivElement | null | undefined;

  const element = useRenderElement('div', componentProps, {
    state,
    ref: (el) => {
      panelRef = el;
      setListItemRef(el);
    },
    props: [
      {
        role: 'tabpanel',
        get 'aria-labelledby'() {
          return correspondingTabId();
        },
        get hidden() {
          return hidden();
        },
        get id() {
          return id();
        },
        get tabindex() {
          return open() ? 0 : -1;
        },
        get inert() {
          return !open();
        },
        // Computed key: a plain literal key fails the DOM-props excess property check.
        get [TabsPanelDataAttributes.index as string]() {
          return index();
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
  });

  useOpenChangeComplete({
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
    open,
    ref: () => panelRef,
  });

  createDepsEffect(
    () => ({ hidden: hidden(), keepMounted: keepMounted(), value: local.value, id: id() }),
    (deps) => {
      if (deps.id == null || (deps.hidden && !deps.keepMounted)) {
        return undefined;
      }

      return registerMountedTabPanel(deps.value, deps.id);
    },
  );

  const shouldRender = () => keepMounted() || mounted();

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps extends BaseUIComponentProps<'div', TabsPanelState> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
