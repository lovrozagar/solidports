/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_ARRAY } from '../../utils/constants';
import { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { TabsListContext } from './TabsListContext';

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsList(componentProps: TabsList.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'activateOnFocus',
    'loopFocus',
    'children',
  ]);
  const activateOnFocus = () => local.activateOnFocus ?? false;
  const loopFocus = () => local.loopFocus ?? true;

  const {
    onValueChange,
    orientation,
    value,
    setTabArray,
    tabActivationDirection,
  } = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null | undefined>(null);

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  function notifyIndicatorUpdateListeners() {
    indicatorUpdateListeners.forEach((listener) => {
      listener();
    });
  }

  createEffect(() => {
    const listEl = tabsListElement();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!indicatorUpdateListeners.size) {
        return;
      }
      notifyIndicatorUpdateListeners();
    });

    resizeObserver = observer;

    if (listEl) {
      observer.observe(listEl);
    }

    tabResizeObserverElements.forEach((element) => {
      observer.observe(element);
    });

    onCleanup(() => {
      observer.disconnect();
      resizeObserver = null;
    });
  });

  function registerIndicatorUpdateListener(listener: () => void): () => void {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  }

  function registerTabResizeObserverElement(element: HTMLElement): () => void {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);
    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  }

  const onTabActivation = (newValue: any, eventDetails: TabsRoot.ChangeEventDetails) => {
    if (newValue !== value()) {
      onValueChange(newValue, eventDetails);
    }
  };

  const state: TabsList.State = {
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return orientation() === 'vertical' ? 'vertical' : undefined;
    },
    role: 'tablist',
  };

  const tabsListContextValue: TabsListContext = {
    activateOnFocus,
    highlightedTabIndex,
    onTabActivation,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    setHighlightedTabIndex,
    tabsListElement,
  };

  return (
    <TabsListContext.Provider value={tabsListContextValue}>
      <CompositeRoot
        render={renderProps.render}
        class={renderProps.class}
        state={state}
        refs={[
          (el) => {
            if (typeof componentProps.ref === 'function') {
              componentProps.ref(el as HTMLDivElement | null);
            } else if (
              componentProps.ref != null &&
              typeof componentProps.ref === 'object' &&
              'current' in componentProps.ref
            ) {
              componentProps.ref.current = el as HTMLDivElement | null;
            } else {
              // eslint-disable-next-line solid/reactivity
              componentProps.ref = el as any;
            }
          },
          (el) => {
            setTabsListElement(el);
          },
        ]}
        props={[defaultProps as Record<string, unknown>, elementProps as Record<string, unknown>]}
        stateAttributesMapping={tabsStateAttributesMapping}
        highlightedIndex={highlightedTabIndex()}
        enableHomeAndEndKeys
        loopFocus={loopFocus()}
        orientation={orientation()}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={setTabArray}
        disabledIndices={EMPTY_ARRAY as number[]}
      >
        {local.children}
      </CompositeRoot>
    </TabsListContext.Provider>
  );
}

export interface TabsListState extends TabsRoot.State {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsList.State> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
