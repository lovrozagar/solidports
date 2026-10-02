import { createRenderEffect, createSignal } from 'solid-js';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_ARRAY } from '../../utils/constants';
import { BaseUIComponentProps, HTMLProps, UseRenderElementRef } from '../../utils/types';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRootState } from '../root/TabsRoot';
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

  const { orientation, setTabMap, tabActivationDirection } = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createRenderEffect(tabsListElement, (listElement) => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      indicatorUpdateListeners.forEach((listener) => {
        listener();
      });
    });

    resizeObserver = observer;

    if (listElement) {
      observer.observe(listElement);
    }

    tabResizeObserverElements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      resizeObserver = null;
    };
  });

  function registerIndicatorUpdateListener(listener: () => void) {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  }

  function registerTabResizeObserverElement(element: HTMLElement) {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);
    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  }

  const state: TabsListState = {
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
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  return (
    <TabsListContext value={tabsListContextValue}>
      <CompositeRoot
        render={renderProps.render}
        class={renderProps.class}
        state={state}
        refs={[
          // The public `ref` also accepts Solid's native ref forms, which the merged refs apply.
          [componentProps.ref as UseRenderElementRef<HTMLElement> | undefined],
          (el) => {
            setTabsListElement(el ?? null);
          },
        ]}
        props={[defaultProps as Record<string, unknown>, elementProps as Record<string, unknown>]}
        stateAttributesMapping={tabsStateAttributesMapping}
        highlightedIndex={highlightedTabIndex()}
        enableHomeAndEndKeys
        loopFocus={loopFocus()}
        orientation={orientation()}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={setTabMap}
        disabledIndices={EMPTY_ARRAY as number[]}
      >
        {local.children}
      </CompositeRoot>
    </TabsListContext>
  );
}

export interface TabsListState extends TabsRootState {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsListState> {
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
