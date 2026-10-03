/* eslint-disable typescript/no-explicit-any -- generic Value defaults to `any`, mirrors React */
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createEffect, createMemo, createSignal, onSettled, Show, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  type FloatingRootContext,
} from '../../floating-ui-solid';
import { activeElement, contains } from '../../floating-ui-solid/utils';
import {
  createDepsRenderEffect,
  splitComponentProps,
  useRef,
  type ReactLikeRef,
} from '../../solid-helpers';
import { type BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useControlled } from '../../utils/useControlled';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTransitionStatus } from '../../utils/useTransitionStatus';
import { NavigationMenuPositionerCssVars } from '../positioner/NavigationMenuPositionerCssVars';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import {
  type NavigationMenuPopupAutoSizeResetState,
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import { splitProps } from '../../solid-1-compat';

const blockedReturnFocusReasons = new Set<string>([
  REASONS.triggerHover,
  REASONS.outsidePress,
  REASONS.focusOut,
]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth),
    ) || 0;
  const height =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight),
    ) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuRoot<Value = any>(
  componentProps: NavigationMenuRoot.Props<Value>,
): JSX.Element {
  const [local] = splitProps(componentProps, [
    'defaultValue',
    'value',
    'onValueChange',
    'actionsRef',
    'delay',
    'closeDelay',
    'orientation',
    'onOpenChangeComplete',
  ]);
  const defaultValue = () => local.defaultValue ?? null;
  const delay = () => local.delay ?? 50;
  const closeDelay = () => local.closeDelay ?? 50;
  const orientation = () => local.orientation ?? 'horizontal';

  const nested = createMemo(() => useFloatingParentNodeId() != null);
  const parentRootContext = useNavigationMenuRootContext(true);

  const [value, setValueUnwrapped] = useControlled<NavigationMenuRoot.Value<Value>>({
    controlled: () => local.value,
    default: defaultValue,
    name: 'NavigationMenu',
    state: 'value',
  });

  // Derive open state from value being non-nullish
  const open = createMemo(() => value() != null);

  const closeReasonRef = useRef<NavigationMenuRoot.ChangeEventReason | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [positionerElement, setPositionerElement] = createSignal<HTMLElement | null | undefined>(
    null,
  );
  const [popupElement, setPopupElement] = createSignal<HTMLElement | null | undefined>(null);
  const [viewportElement, setViewportElement] = createSignal<HTMLElement | null | undefined>(null);
  const [viewportTargetElement, setViewportTargetElement] = createSignal<
    HTMLElement | null | undefined
  >(null);
  const [activationDirection, setActivationDirection] =
    createSignal<ReturnType<NavigationMenuRootContext['activationDirection']>>(null);
  // Solid: the active trigger's floating context, derived in the same flush (React copies it
  // from the trigger's effect and clears it when the menu closes or unmounts).
  const [triggerFloatingContexts, setTriggerFloatingContexts] = createSignal<
    readonly { active: Accessor<boolean>; context: FloatingRootContext }[]
  >([], { ownedWrite: true });
  const floatingRootContext = createMemo<FloatingRootContext | undefined>(() => {
    for (const entry of triggerFloatingContexts()) {
      if (entry.active()) {
        return entry.context;
      }
    }
    return undefined;
  });
  function registerTriggerFloatingContext(entry: {
    active: Accessor<boolean>;
    context: FloatingRootContext;
  }) {
    onSettled(() => {
      setTriggerFloatingContexts((current) => [...current, entry]);
      return () =>
        setTriggerFloatingContexts((current) => current.filter((item) => item !== entry));
    });
  }
  const [viewportInert, setViewportInert] = createSignal(false);

  const prevTriggerElementRef = useRef<Element | null | undefined>(null);
  const currentContentRef = useRef<HTMLDivElement | null>(null);
  const beforeInsideRef = useRef<HTMLSpanElement | null>(null);
  const afterInsideRef = useRef<HTMLSpanElement | null>(null);
  const beforeOutsideRef = useRef<HTMLSpanElement | null>(null);
  const afterOutsideRef = useRef<HTMLSpanElement | null>(null);
  // Shared across triggers so a newly active trigger can cancel a stale
  // popup auto-size reset scheduled by the previously active trigger.
  const popupAutoSizeResetRef = useRef<NavigationMenuPopupAutoSizeResetState>({
    abortController: null,
    owner: null,
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  createDepsRenderEffect(
    () => ({ open: open(), popupElement: popupElement(), positionerElement: positionerElement() }),
    (deps) => {
      if (deps.open) {
        return;
      }

      if (!deps.positionerElement || !deps.popupElement) {
        return;
      }

      const closeTransitionSize = getPositionerFixedSize(deps.positionerElement);

      if (!closeTransitionSize) {
        return;
      }

      // No cleanup is needed for this fixed size: if the popup unmounts, the inline
      // styles are removed with it. If it stays mounted, reopening runs the trigger's
      // sizing logic which clears these vars via `clearFixedSizes`/`setAutoSizes`.
      setSharedFixedSize(
        deps.popupElement,
        deps.positionerElement,
        closeTransitionSize.width,
        closeTransitionSize.height,
      );
    },
  );

  createEffect(value, () => {
    setViewportInert(false);
  });

  // Solid: a handler reading the latest value is React's stable callback.
  const setValue = (
    nextValue: NavigationMenuRoot.Value<Value>,
    eventDetails: NavigationMenuRoot.ChangeEventDetails,
  ) => {
    if (nextValue == null) {
      closeReasonRef.current = eventDetails.reason;
    }

    if (nextValue !== value()) {
      local.onValueChange?.(nextValue, eventDetails);
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextValue == null) {
      setActivationDirection(null);
    }

    setValueUnwrapped(nextValue);

    if (
      nested() &&
      nextValue == null &&
      eventDetails.reason === REASONS.linkPress &&
      parentRootContext
    ) {
      parentRootContext.setValue(null, eventDetails);
    }
  };

  const handleUnmount = () => {
    const doc = ownerDocument(rootRef.current);
    const activeEl = activeElement(doc);

    const isReturnFocusBlocked = closeReasonRef.current
      ? blockedReturnFocusReasons.has(closeReasonRef.current)
      : false;

    const popup = popupElement() ?? null;
    if (
      !isReturnFocusBlocked &&
      isHTMLElement(prevTriggerElementRef.current) &&
      (activeEl === ownerDocument(popup).body || contains(popup, activeEl)) &&
      popup
    ) {
      prevTriggerElementRef.current.focus({ preventScroll: true });
      prevTriggerElementRef.current = undefined;
    }

    setMounted(false);
    local.onOpenChangeComplete?.(false);
    setActivationDirection(null);

    currentContentRef.current = null;
    closeReasonRef.current = undefined;
  };

  // Providing `actionsRef` opts into manual unmounting, so close completion hooks leave it mounted.
  // Solid: React's `useImperativeHandle`; the ref object is written while the root is mounted.
  createEffect(
    () => local.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return undefined;
      }
      actionsRef.current = { unmount: handleUnmount };
      return () => {
        actionsRef.current = null;
      };
    },
  );

  useOpenChangeComplete({
    enabled: () => !local.actionsRef,
    open,
    ref: popupElement,
    onComplete() {
      if (!open()) {
        handleUnmount();
      }
    },
  });

  useOpenChangeComplete({
    enabled: () => !local.actionsRef,
    open,
    ref: viewportTargetElement,
    onComplete() {
      if (!open()) {
        handleUnmount();
      }
    },
  });

  const contextActivationDirection = () => (open() ? activationDirection() : null);

  const contextValue: NavigationMenuRootContext<Value> = {
    open,
    value,
    setValue,
    mounted,
    transitionStatus,
    positionerElement,
    setPositionerElement,
    popupElement,
    setPopupElement,
    viewportElement,
    setViewportElement,
    viewportTargetElement,
    setViewportTargetElement,
    activationDirection: contextActivationDirection,
    setActivationDirection,
    floatingRootContext,
    registerTriggerFloatingContext,
    currentContentRef,
    nested,
    rootRef,
    beforeInsideRef,
    afterInsideRef,
    beforeOutsideRef,
    afterOutsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    delay,
    closeDelay,
    orientation,
    viewportInert,
    setViewportInert,
  };

  const jsx = () => (
    <NavigationMenuRootContext value={contextValue}>
      <TreeContext componentProps={componentProps} />
    </NavigationMenuRootContext>
  );

  // FloatingTree provides context to nested menus
  return (
    <Show when={nested()} fallback={<FloatingTree>{jsx()}</FloatingTree>}>
      {jsx()}
    </Show>
  );
}

function TreeContext<Value>(props: { componentProps: NavigationMenuRoot.Props<Value> }) {
  const [, , elementProps] = splitComponentProps(props.componentProps, [
    'defaultValue',
    'value',
    'onValueChange',
    'actionsRef',
    'delay',
    'closeDelay',
    'orientation',
    'onOpenChangeComplete',
  ]);

  const nodeId = useFloatingNodeId();
  const { rootRef, nested, open } = useNavigationMenuRootContext();

  const state: NavigationMenuRootState = {
    get open() {
      return open();
    },
    get nested() {
      return nested();
    },
  };

  const element = useRenderElement(() => (nested() ? 'div' : 'nav'), props.componentProps, {
    state,
    ref: rootRef,
    props: elementProps,
  });

  return (
    <NavigationMenuTreeContext value={nodeId}>
      <FloatingNode id={nodeId?.()}>{element()}</FloatingNode>
    </NavigationMenuTreeContext>
  );
}

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootProps<Value = any> extends BaseUIComponentProps<
  'nav',
  NavigationMenuRootState
> {
  /**
   * A ref to imperative actions.
   */
  actionsRef?: ReactLikeRef<NavigationMenuRoot.Actions | null> | undefined;
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   * @default null
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?:
    | ((value: Value | null, eventDetails: NavigationMenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface NavigationMenuRootActions {
  unmount: () => void;
}

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>;

export namespace NavigationMenuRoot {
  export type State = NavigationMenuRootState;
  export type Props<TValue = any> = NavigationMenuRootProps<TValue>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
