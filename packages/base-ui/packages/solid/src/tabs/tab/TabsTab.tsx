/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createTrackedEffect, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { activeElement, contains } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { useTabsListContext } from '../list/TabsListContext';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'value',
    'id',
    'nativeButton',
  ]);
  const disabled = () => Boolean(local.disabled);
  const idProp = () => local.id;
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  const { value: activeTabValue, getTabPanelIdByValue, orientation } = useTabsRootContext();

  const {
    activateOnFocus,
    highlightedTabIndex,
    onTabActivation,
    registerTabResizeObserverElement,
    setHighlightedTabIndex,
    tabsListElement,
  } = useTabsListContext();

  const id = useBaseUiId(idProp);

  const tabMetadata = {
    disabled,
    id,
    value: () => local.value,
  };

  const {
    compositeProps,
    setCompositeRef,
    index,
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = useCompositeItem<TabsTab.Metadata>({
    metadata: tabMetadata,
  });

  const active = () => local.value === activeTabValue();

  let isNavigatingRef = false;
  let tabElementRef: HTMLElement | null = null;

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!tabElementRef) {
      return;
    }
    const cleanup = registerTabResizeObserverElement(tabElementRef);
    _c.push(cleanup);
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  // Keep the highlighted item in sync with the currently active tab
  // when the value prop changes externally (controlled mode)
  createEffect(
    () => {
      if (isNavigatingRef) {
        return { skip: true as const };
      }

      if (!(active() && index() > -1 && highlightedTabIndex() !== index())) {
        return { skip: true as const };
      }

      const listElement = tabsListElement();
      if (listElement != null) {
        const activeEl = activeElement(ownerDocument(listElement));
        if (activeEl && contains(listElement, activeEl)) {
          return { skip: true as const };
        }
      }

      if (disabled()) {
        return { skip: true as const };
      }

      return { skip: false as const, index: index() };
    },
    (next) => {
      if (isNavigatingRef) {
        isNavigatingRef = false;
        return;
      }
      if (next.skip) {
        return;
      }
      setHighlightedTabIndex(next.index);
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const tabPanelId = () => getTabPanelIdByValue(local.value);

  let isPressingRef = false;
  let isMainButtonRef = false;

  function onClick(event: MouseEvent) {
    if (active() || disabled()) {
      return;
    }

    onTabActivation(
      local.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none',
      }),
    );
  }

  function onFocus(event: FocusEvent) {
    if (active()) {
      return;
    }

    // Only highlight enabled tabs when focused (disabled tabs remain focusable via focusableWhenDisabled).
    if (index() > -1 && !disabled()) {
      setHighlightedTabIndex(index());
    }

    if (disabled()) {
      return;
    }

    if (
      activateOnFocus() &&
      (!isPressingRef || // keyboard or touch focus
        (isPressingRef && isMainButtonRef)) // mouse focus
    ) {
      onTabActivation(
        local.value,
        createChangeEventDetails(REASONS.none, event, undefined, {
          activationDirection: 'none',
        }),
      );
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (active() || disabled()) {
      return;
    }

    isPressingRef = true;

    function handlePointerUp() {
      isPressingRef = false;
      isMainButtonRef = false;
    }

    if (!event.button || event.button === 0) {
      isMainButtonRef = true;

      const doc = ownerDocument(event.currentTarget as Element);
      doc.addEventListener('pointerup', handlePointerUp, { once: true });
    }
  }

  const state: TabsTab.State = {
    get active() {
      return active();
    },
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const element = useRenderElement('button', componentProps, {
    props: [
      compositeProps,
      {
        role: 'tab',
        get 'aria-controls'() {
          return tabPanelId();
        },
        get 'aria-selected'() {
          return active() ? 'true' : 'false';
        },
        get id() {
          return id();
        },
        get [ACTIVE_COMPOSITE_ITEM as string]() {
          return active() ? '' : undefined;
        },
        onClick,
        onFocus,
        onPointerDown,
        ref: withCaptureListeners({
          keydown: () => {
            isNavigatingRef = true;
          },
        }),
      },
      elementProps,
      getButtonProps,
    ],
    ref: (el) => {
      tabElementRef = el ?? null;
      buttonRef(el);
      setCompositeRef(el);
    },
    state,
  });

  return <>{element()}</>;
}

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: Accessor<boolean>;
  id: Accessor<string | undefined>;
  value: Accessor<TabsTab.Value | undefined>;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  active: boolean;
  orientation: TabsRoot.Orientation;
}

export interface TabsTabProps
  extends NativeButtonProps, BaseUIComponentProps<'button', TabsTab.State> {
  /**
   * The value of the Tab.
   */
  value: TabsTab.Value;
  /**
   * Whether the Tab is disabled.
   *
   * If a first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * However, it does not work like this during server-side rendering, as it is not known
   * during pre-rendering which Tabs are disabled.
   * To work around it, ensure that `defaultValue` or `value` on `<Tabs.Root>` is set to an enabled Tab's value.
   */
  disabled?: boolean | undefined;
}

export namespace TabsTab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}
