/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createMemo, isStatic, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { activeElement, contains } from '../../floating-ui-solid/utils';
import { createDepsEffect, shallowEqual, splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { makeEventPreventable } from '../../merge-props/mergeProps';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { canRenderNative, composeHandler } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIEvent, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { useTabsListContext } from '../list/TabsListContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'value', 'id', 'nativeButton']);
const TAB: Record<string, unknown> = { role: 'tab' };
/** Tabs rendered in DOM order get their index on the first render (the list's flush confirms it). */
const GUESS_INDEX = { guessIndex: true };
/** Handler keys the tab needs even without a consumer handler. */
const HANDLER_KEYS = ['onClick', 'onFocus', 'onPointerDown', 'onKeyDown', 'onKeyUp'] as const;

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a native `<button>` rendered
  // with direct JSX; `useButton` and `useCompositeItem` for a native composite item are inlined.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton ?? true) === true
  ) {
    return NativeTabsTab(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'value',
    'id',
    'nativeButton',
  ]);
  const disabled = () => local.disabled ?? false;
  const value = () => local.value;
  const nativeButton = () => local.nativeButton ?? true;

  const {
    value: activeTabValue,
    getTabPanelIdByValue,
    onValueChange,
    orientation,
    tabActivationDirection,
  } = useTabsRootContext();

  const { activateOnFocus, registerTabResizeObserverElement, tabsListElement } =
    useTabsListContext();

  const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();

  const id = useBaseUiId(() => local.id);

  const tabMetadata = createMemo<TabsTab.Metadata>(() => ({
    disabled: disabled(),
    id: id(),
    value: value(),
  }));

  const {
    compositeProps,
    setCompositeRef,
    index,
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = useCompositeItem<TabsTab.Metadata>({
    metadata: tabMetadata,
  });

  const active = () => value() === activeTabValue();

  let isNavigating = false;
  let unobserveTabElement: (() => void) | null = null;

  // Registered from the ref callback rather than an effect so the observer
  // follows the rendered element when the `render` prop swaps the host element.
  function observeTabElement(element: HTMLElement | null | undefined) {
    unobserveTabElement?.();
    unobserveTabElement = element ? registerTabResizeObserverElement(element) : null;
  }

  // Keep the highlighted item in sync with the currently active tab
  // when the value prop changes externally (controlled mode)
  // Solid: a user effect, since a render effect's mount-time apply may not write signals.
  createDepsEffect(
    () => ({
      active: active(),
      index: index(),
      highlightedIndex: highlightedIndex(),
      disabled: disabled(),
      tabsListElement: tabsListElement(),
    }),
    (deps) => {
      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(deps.active && deps.index > -1 && deps.highlightedIndex !== deps.index)) {
        return;
      }

      // If focus is currently within the tabs list, don't override the roving
      // focus highlight. This keeps keyboard navigation relative to the focused
      // item after an external/asynchronous selection change.
      const listElement = deps.tabsListElement;
      if (listElement != null) {
        const activeEl = activeElement(ownerDocument(listElement));
        if (activeEl && contains(listElement, activeEl)) {
          return;
        }
      }

      // Don't highlight disabled tabs to prevent them from interfering with keyboard navigation.
      // Keyboard focus (tabIndex) should remain on an enabled tab even when a disabled tab is selected.
      if (!deps.disabled) {
        onHighlightedIndexChange(deps.index);
      }
    },
  );

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
    focusableWhenDisabled: true,
  });

  const tabPanelId = () => getTabPanelIdByValue(value());

  let isPressing = false;
  let isMainButton = false;

  // Both callers guard on `!active`, so the current value is never re-committed.
  function activate(event: Event) {
    onValueChange(
      value(),
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none',
      }),
    );
  }

  function onClick(event: MouseEvent) {
    // Solid: React DOM drops `click` events from the secondary mouse button before they reach
    // `onClick`; match it.
    if (event.button === 2) {
      return;
    }

    if (active() || disabled()) {
      return;
    }

    activate(event);
  }

  function onFocus(event: FocusEvent) {
    if (active() || disabled()) {
      return;
    }

    if (
      activateOnFocus() &&
      (!isPressing || // keyboard or touch focus
        isMainButton) // main mouse button focus
    ) {
      activate(event);
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (active() || disabled()) {
      return;
    }

    isPressing = true;
    // Secondary presses (context menu, middle click) may focus the tab, but
    // must not activate it with `activateOnFocus`.
    isMainButton = event.button === 0;

    // Registered for every button so a secondary press doesn't leave the tab
    // stuck in the pressing state, which would suppress later focus activation.
    const doc = ownerDocument(event.currentTarget as Element);

    function handlePointerEnd() {
      isPressing = false;
      isMainButton = false;
      doc.removeEventListener('pointerup', handlePointerEnd);
      doc.removeEventListener('pointercancel', handlePointerEnd);
    }

    doc.addEventListener('pointerup', handlePointerEnd);
    doc.addEventListener('pointercancel', handlePointerEnd);
  }

  const state: TabsTabState = {
    get disabled() {
      return disabled();
    },
    get active() {
      return active();
    },
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [buttonRef, setCompositeRef, observeTabElement],
    props: [
      ...buttonSources.attributes,
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
        onClick,
        onFocus,
        onPointerDown,
        get [ACTIVE_COMPOSITE_ITEM as string]() {
          return active() ? '' : undefined;
        },
        // Solid: React's `onKeyDownCapture`.
        ref: withCaptureListeners({
          keydown: () => {
            isNavigating = true;
          },
        }),
      },
      elementProps,
      buttonSources.handlers,
    ],
    stateAttributesMapping: tabsStateAttributesMapping,
  });

  return <>{element()}</>;
}

type Handler = (...args: any[]) => unknown;
type TabEvent<T extends Event> = BaseUIEvent<T>;

/**
 * `useButton`'s keyboard logic after the consumer's handler for a native `<button>` that is a
 * composite item (`handleKeyDownAfterConsumer`): Space activates the item on keydown so the
 * composite root's navigation and the click stay in order. Enter is left to the browser.
 */
function compositeButtonKeyDownAfterConsumer(event: TabEvent<KeyboardEvent>) {
  if (event.baseUIHandlerPrevented || event.target !== event.currentTarget || event.key !== ' ') {
    return;
  }
  event.preventDefault();
  event.preventBaseUIHandler();
  dispatchClickWithModifiers(event.currentTarget as Element, event);
}

/**
 * `handleKeyUpAfterConsumer`: a composite native button cancels Space's keyup activation (the
 * keydown already dispatched the click), before and regardless of `preventBaseUIHandler`.
 */
function compositeButtonKeyUpAfterConsumer(event: TabEvent<KeyboardEvent>) {
  if (event.target === event.currentTarget && event.key === ' ') {
    event.preventDefault();
  }
}

function NativeTabsTab(props: TabsTab.Props): JSX.Element {
  const disabled = () => props.disabled ?? false;
  const value = () => props.value;

  const {
    value: activeTabValue,
    getTabPanelIdByValue,
    onValueChange,
    orientation,
    tabActivationDirection,
  } = useTabsRootContext();

  const { activateOnFocus, registerTabResizeObserverElement, tabsListElement } =
    useTabsListContext();

  const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();

  // A static `id` (absent or literal) is read once: a constant accessor, no memo.
  const idIsStatic = !('id' in props) || isStatic(props, 'id');
  const id = useBaseUiId(idIsStatic ? untrack(() => props.id) : () => props.id);

  // The registration metadata is one object when its inputs are literal; otherwise a memo, so a
  // change re-registers the item with the list (the hook compares metadata by identity).
  const metadataIsStatic =
    idIsStatic &&
    (!('disabled' in props) || isStatic(props, 'disabled')) &&
    (!('value' in props) || isStatic(props, 'value'));
  const readMetadata = (): TabsTab.Metadata => ({
    disabled: disabled(),
    id: id(),
    value: value(),
  });
  const listItem = createNativeListItem<TabsTab.Metadata>(
    metadataIsStatic ? untrack(readMetadata) : createMemo(readMetadata),
    GUESS_INDEX,
  );
  const index = listItem.index;
  const isHighlighted = () => highlightedIndex() === index();

  const active = () => value() === activeTabValue();

  let isNavigating = false;
  let unobserveTabElement: (() => void) | null = null;

  function observeTabElement(el: HTMLElement | null | undefined) {
    unobserveTabElement?.();
    unobserveTabElement = el ? registerTabResizeObserverElement(el) : null;
  }

  // Keep the highlighted item in sync with the currently active tab when the value changes
  // externally. One effect: the dependency snapshot is compared in the apply (no memo), so the
  // body runs only when a value changed, as `createDepsEffect` runs it.
  let previousDeps:
    | {
        active: boolean;
        index: number;
        highlightedIndex: number;
        disabled: boolean;
        tabsListElement: HTMLElement | null;
      }
    | undefined;
  createEffect(
    () => ({
      active: active(),
      index: index(),
      highlightedIndex: highlightedIndex(),
      disabled: disabled(),
      tabsListElement: tabsListElement(),
    }),
    (deps) => {
      if (previousDeps && shallowEqual(previousDeps, deps)) {
        return;
      }
      previousDeps = deps;

      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(deps.active && deps.index > -1 && deps.highlightedIndex !== deps.index)) {
        return;
      }

      const listElement = deps.tabsListElement;
      if (listElement != null) {
        const activeEl = activeElement(ownerDocument(listElement));
        if (activeEl && contains(listElement, activeEl)) {
          return;
        }
      }

      if (!deps.disabled) {
        onHighlightedIndexChange(deps.index);
      }
    },
  );

  const tabPanelId = () => getTabPanelIdByValue(value());

  let isPressing = false;
  let isMainButton = false;

  function activate(event: Event) {
    onValueChange(
      value(),
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none',
      }),
    );
  }

  function tabClick(event: MouseEvent) {
    if (event.button === 2 || active() || disabled()) {
      return;
    }
    activate(event);
  }

  function tabFocus(event: FocusEvent) {
    if (active() || disabled()) {
      // The composite item still takes the highlight.
      onHighlightedIndexChange(index());
      return;
    }
    if (activateOnFocus() && (!isPressing || isMainButton)) {
      activate(event);
    }
    onHighlightedIndexChange(index());
  }

  function tabPointerDown(event: PointerEvent) {
    if (active() || disabled()) {
      return;
    }

    isPressing = true;
    isMainButton = event.button === 0;

    const doc = ownerDocument(event.currentTarget as Element);

    function handlePointerEnd() {
      isPressing = false;
      isMainButton = false;
      doc.removeEventListener('pointerup', handlePointerEnd);
      doc.removeEventListener('pointercancel', handlePointerEnd);
    }

    doc.addEventListener('pointerup', handlePointerEnd);
    doc.addEventListener('pointercancel', handlePointerEnd);
  }

  // `useCompositeItem`'s hover highlight (`highlightItemOnHover` is always `false` for a tab list,
  // so this never focuses).
  function compositeMouseMove() {
    /* Tabs.List never highlights on hover. */
  }

  const disabledGate = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
      return false;
    }
    return true;
  };

  const wrapHandler = (key: string, read: (() => Handler | undefined) | undefined) => {
    switch (key.toLowerCase()) {
      case 'onclick':
        return composeHandler<MouseEvent>(read, tabClick, disabledGate);
      case 'onpointerdown':
        return composeHandler<PointerEvent>(read, tabPointerDown, disabledGate);
      case 'onfocus':
        return composeHandler<FocusEvent>(read, tabFocus);
      case 'onmousemove':
        return read ? composeHandler<MouseEvent>(read, compositeMouseMove) : undefined;
      case 'onmousedown':
        return composeHandler<MouseEvent>(read, undefined, () => !disabled());
      case 'onkeydown':
        return composeHandler<KeyboardEvent>(read, compositeButtonKeyDownAfterConsumer, (event) => {
          // Allow Tabbing away from the focusable-when-disabled button; block every other key.
          if (disabled() && event.key !== 'Tab') {
            event.preventDefault();
          }
          return !disabled();
        });
      case 'onkeyup':
        // `useButton`: a composite native button cancels Space's keyup activation even when the
        // consumer prevented the Base UI handler, so this runs outside `composeHandler`'s gate.
        return (nativeEvent: KeyboardEvent) => {
          const event = makeEventPreventable(nativeEvent as TabEvent<KeyboardEvent>);
          return untrack(() => {
            if (disabled()) {
              return undefined;
            }
            const consumer = read?.();
            const result = consumer ? consumer(event) : undefined;
            compositeButtonKeyUpAfterConsumer(event);
            return result;
          });
        };
      default:
        return undefined;
    }
  };

  const state: TabsTabState = {
    get disabled() {
      return disabled();
    },
    get active() {
      return active();
    },
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  const el = (<button type="button" />) as unknown as HTMLButtonElement;
  // React's `onKeyDownCapture`: navigation keys reach the composite root before this tab's
  // highlight sync runs, which must not undo the move.
  el.addEventListener(
    'keydown',
    () => {
      isNavigating = true;
    },
    true,
  );

  return renderNativeElement(el, props, {
    own: OWN_KEYS,
    state,
    mapping: tabsStateAttributesMapping,
    reactive: true,
    literal: TAB,
    attributes: (set) => {
      set('tabindex', isHighlighted() ? 0 : -1);
      set('aria-disabled', disabled() ? 'true' : 'false');
      set('aria-controls', tabPanelId());
      set('aria-selected', active() ? 'true' : 'false');
      set('id', id());
      set(ACTIVE_COMPOSITE_ITEM, active() ? '' : undefined);
    },
    wrapHandler,
    handlerKeys: HANDLER_KEYS,
    refs: [listItem.setRef, observeTabElement],
  }) as unknown as JSX.Element;
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
  disabled: boolean;
  id: string | undefined;
  value: TabsTab.Value | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsTabProps
  extends NativeButtonProps, BaseUIComponentProps<'button', TabsTabState> {
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
