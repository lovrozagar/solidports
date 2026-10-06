import { createSignal } from 'solid-js';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { useDirection } from '../../direction-provider/DirectionContext';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import { splitComponentProps, createLayoutEffect } from '../../solid-helpers';
import { EMPTY_ARRAY } from '../../utils/constants';
import { canRenderNative, composeHandler } from '../../utils/native';
import { provideNativeContexts } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import { BaseUIComponentProps, HTMLProps, UseRenderElementRef } from '../../utils/types';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTab } from '../tab/TabsTab';
import { TabsListContext } from './TabsListContext';

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['activateOnFocus', 'loopFocus']);
const TABLIST: Record<string, unknown> = { role: 'tablist' };
/** Handler keys the composite root needs even without a consumer handler. */
const HANDLER_KEYS = ['onFocusIn', 'onKeyDown'] as const;
const NEVER = () => false;

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsList(componentProps: TabsList.Props): JSX.Element {
  const activateOnFocus = () => componentProps.activateOnFocus ?? false;
  const loopFocus = () => componentProps.loopFocus ?? true;

  const { orientation, setTabMap, tabActivationDirection } = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createLayoutEffect(tabsListElement, (listElement) => {
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

  const tabsListContextValue: TabsListContext = {
    activateOnFocus,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): `CompositeRoot`'s composition
  // (its hook, context and item list) with the `<div>` rendered through direct JSX.
  if (canRenderNative(componentProps)) {
    const direction = useDirection();
    const composite = useCompositeRoot<TabsTab.Metadata>({
      loopFocus,
      orientation,
      highlightedIndex: highlightedTabIndex,
      onHighlightedIndexChange: setHighlightedTabIndex,
      direction,
      disabledIndices: EMPTY_ARRAY as number[],
      enableHomeAndEndKeys: true,
      stopEventPropagation: true,
    });
    const compositeContext: CompositeRootContext = {
      highlightItemOnHover: NEVER,
      highlightedIndex: composite.highlightedIndex,
      onHighlightedIndexChange: composite.onHighlightedIndexChange,
      relayKeyboardEvent: composite.relayKeyboardEvent,
    };
    const compositeProps = composite.props as Record<string, (event: Event) => void>;
    return provideNativeContexts(
      TabsListContext,
      tabsListContextValue,
      CompositeRootContext,
      compositeContext,
      () =>
        createComponent(CompositeList<TabsTab.Metadata>, {
          refs: composite.refs,
          onMapChange(map) {
            setTabMap(map);
            composite.onMapChange(map);
          },
          get children() {
            return renderNativeElement((<div />) as unknown as Element, componentProps, {
              own: OWN_KEYS,
              state,
              mapping: tabsStateAttributesMapping,
              reactive: true,
              literal: TABLIST,
              attributes: (set) =>
                set('aria-orientation', orientation() === 'vertical' ? 'vertical' : undefined),
              wrapHandler: (key, read) => {
                const part = compositeProps[key];
                return part ? composeHandler(read, part) : undefined;
              },
              handlerKeys: HANDLER_KEYS,
              refs: [composite.setRootRef, (el: HTMLElement | null) => setTabsListElement(el)],
            }) as unknown as JSX.Element;
          },
        }),
    );
  }

  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'activateOnFocus',
    'loopFocus',
    'children',
  ]);

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return orientation() === 'vertical' ? 'vertical' : undefined;
    },
    role: 'tablist',
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
