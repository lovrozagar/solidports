import { createMemo, isStatic, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { canRenderNative, partHandler } from '../../utils/native';
import {
  compositeButtonKeyDownAfterConsumer,
  compositeButtonKeyUp,
} from '../../utils/native/compositeButton';
import type { Dispatch } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
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
/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a native `<button>` rendered
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

  const { isActive, getTabPanelIdByValue, onValueChange, orientation, tabActivationDirection } =
    useTabsRootContext();

  const { activateOnFocus, registerTabResizeObserverElement } = useTabsListContext();

  const id = useBaseUiId(() => local.id);

  const tabMetadata = createMemo<TabsTab.Metadata>(() => ({
    disabled: disabled(),
    id: id(),
    value: value(),
  }));

  const {
    compositeProps,
    setCompositeRef,
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = useCompositeItem<TabsTab.Metadata>({
    metadata: tabMetadata,
  });

  const active = () => isActive(value());

  let unobserveTabElement: (() => void) | null = null;

  // Registered from the ref callback rather than an effect so the observer
  // follows the rendered element when the `render` prop swaps the host element.
  function observeTabElement(element: HTMLElement | null | undefined) {
    unobserveTabElement?.();
    unobserveTabElement = element ? registerTabResizeObserverElement(element) : null;
  }

  // The highlight follows the selected tab from the list (`TabsHighlightSync`), one effect for
  // the list rather than one per tab.
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
      },
      elementProps,
      buttonSources.handlers,
    ],
    stateAttributesMapping: tabsStateAttributesMapping,
  });

  return element();
}

/** What a native tab's handlers act on: its `disabled` accessor and its own handlers. */
interface TabHandlerTarget {
  disabled(): boolean;
  click(event: MouseEvent): void;
  focus(event: FocusEvent): void;
  pointerDown(event: PointerEvent): void;
}

/** A disabled tab cancels the event and runs no handler. */
function preventWhileDisabled(tab: TabHandlerTarget, event: Event) {
  if (tab.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

/** A native tab's handlers, in `useButton` and the tab's own order, created once. */
const TAB_HANDLERS: Readonly<Record<string, Dispatch<TabHandlerTarget>>> = {
  onClick: partHandler<TabHandlerTarget, MouseEvent>(
    'onClick',
    (tab, event) => tab.click(event),
    preventWhileDisabled,
  ),
  onFocus: partHandler<TabHandlerTarget, FocusEvent>('onFocus', (tab, event) => tab.focus(event)),
  onPointerDown: partHandler<TabHandlerTarget, PointerEvent>(
    'onPointerDown',
    (tab, event) => tab.pointerDown(event),
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<TabHandlerTarget, KeyboardEvent>(
    'onKeyDown',
    (_tab, event) => compositeButtonKeyDownAfterConsumer(event),
    (tab, event) => {
      // Allow Tabbing away from the focusable-when-disabled button; block every other key.
      if (tab.disabled() && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !tab.disabled();
    },
  ),
  onKeyUp: compositeButtonKeyUp<TabHandlerTarget>((tab) => tab.disabled()),
};

/** Bound only when the consumer passes them: the gate on `onMouseDown`, and `onMouseMove`. */
const TAB_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<TabHandlerTarget>>> = {
  // Tabs.List never highlights on hover: the composite's mouse-move handler does nothing.
  onMouseMove: partHandler<TabHandlerTarget>('onMouseMove'),
  onMouseDown: partHandler<TabHandlerTarget>('onMouseDown', undefined, (tab) => !tab.disabled()),
};

function NativeTabsTab(props: TabsTab.Props): JSX.Element {
  const disabled = () => props.disabled ?? false;
  const value = () => props.value;

  const { isActive, getTabPanelIdByValue, onValueChange, orientation, tabActivationDirection } =
    useTabsRootContext();

  const { activateOnFocus, registerTabResizeObserverElement } = useTabsListContext();

  const { isHighlighted: isIndexHighlighted, onHighlightedIndexChange } = useCompositeRootContext();

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
  const isHighlighted = () => isIndexHighlighted(index());

  const active = () => isActive(value());

  let unobserveTabElement: (() => void) | null = null;

  function observeTabElement(el: HTMLElement | null | undefined) {
    unobserveTabElement?.();
    unobserveTabElement = el ? registerTabResizeObserverElement(el) : null;
  }

  // The highlight follows the selected tab from the list (`TabsHighlightSync`), one effect for
  // the list rather than one per tab.
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
  const handlerTarget: TabHandlerTarget = {
    disabled,
    click: tabClick,
    focus: tabFocus,
    pointerDown: tabPointerDown,
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

  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
  const el = (<button type="button" />) as unknown as HTMLButtonElement;

  return renderNativeElement(el, props, {
    own: OWN_KEYS,
    state,
    mapping: tabsStateAttributesMapping,
    reactive: true,
    literal: TAB,
    attributes: (w) => {
      // One read of the selection per pass: each read of a keyed selector registers a release.
      const isActive = active();
      w.set('tabindex', isHighlighted() ? 0 : -1);
      w.set('aria-disabled', disabled() ? 'true' : 'false');
      w.set('aria-controls', tabPanelId());
      w.set('aria-selected', isActive ? 'true' : 'false');
      w.set('id', id());
      w.set(ACTIVE_COMPOSITE_ITEM, isActive ? '' : undefined);
    },
    handlers: TAB_HANDLERS,
    handlersIfPassed: TAB_HANDLERS_IF_PASSED,
    handlerTarget,
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
