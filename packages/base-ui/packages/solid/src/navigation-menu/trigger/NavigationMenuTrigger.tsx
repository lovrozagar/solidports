import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { closest } from '../../utils/shadowDom';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import type { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import {
  safePolygon,
  useClick,
  useFloatingRootContext,
  useFloatingTree,
  useHoverReferenceInteraction,
  useInteractions,
} from '../../floating-ui-solid';
import type { ElementProps, Placement } from '../../floating-ui-solid/types';
import type { HandleCloseContextBase } from '../../floating-ui-solid/hooks/useHoverShared';
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  useHoverInteractionSharedState,
} from '../../floating-ui-solid/hooks/useHoverInteractionSharedState';
import {
  contains,
  getNextTabbable,
  getTabbableAfterElement,
  getPreviousTabbable,
  isOutsideEvent,
  stopEvent,
} from '../../floating-ui-solid/utils';
import { useDirection } from '../../direction-provider/DirectionContext';
import {
  createDepsEffect,
  createDepsRenderEffect,
  splitComponentProps,
  useRef,
} from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import {
  EMPTY_ARRAY,
  EMPTY_OBJECT,
  ownerVisuallyHidden,
  PATIENT_CLICK_THRESHOLD,
} from '../../utils/constants';
import { useTriggerInteractions } from '../../utils/popups/useInteractionIntent';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { FocusGuard } from '../../utils/FocusGuard';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { ownerWindow } from '../../utils/owner';
import {
  CommonTriggerDataAttributes,
  pressableTriggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { TransitionStatusDataAttributes } from '../../utils/stateAttributesMapping';
import { addEventListener } from '../../utils/addEventListener';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import {
  compositeButtonKeyDownAfterConsumer,
  compositeButtonKeyUp,
} from '../../utils/native/compositeButton';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  HTMLProps,
  NativeButtonProps,
  UseRenderElementRef,
} from '../../utils/types';
import { useAnimationFrame } from '../../utils/useAnimationFrame';
import { useTimeout } from '../../utils/useTimeout';
import { flushSync } from '../../utils/flushSync';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { useNavigationMenuDismissContext } from '../list/NavigationMenuDismissContext';
import type { NavigationMenuRoot } from '../root/NavigationMenuRoot';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import * as NavigationMenuPopupCssVars from '../popup/NavigationMenuPopupCssVars';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';

const DEFAULT_SIZE = { width: 0, height: 0 };

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);
const TRIGGER_LITERALS: Record<string, unknown> = {
  [NAVIGATION_MENU_TRIGGER_IDENTIFIER as string]: '',
  // The trigger's own `tabindex`, which overrides the composite item's roving one.
  tabindex: 0,
};

/**
 * A native trigger's model: the target of its module-level handlers and attribute write, and its
 * state. Its handler sources in the slow path's `mergeProps` order below the consumer's: the
 * trigger's own props, the list's dismiss props, then hover and click once the interactions exist;
 * the composite item's focus and hover highlight run last (`useCompositeItem` inlined). One object
 * per trigger.
 */
class NativeNavigationMenuTriggerModel implements NavigationMenuTrigger.State {
  declare private readonly disabledAccessor: () => boolean;
  declare readonly isActive: () => boolean;
  declare readonly root: NavigationMenuRootContext;
  declare private readonly composite: CompositeRootContext;
  declare private readonly index: () => number;
  declare private readonly elementRef: { current: HTMLElement | null };
  declare private readonly sources: ReadonlyArray<() => object | undefined>;

  constructor(
    disabled: () => boolean,
    isActive: () => boolean,
    root: NavigationMenuRootContext,
    composite: CompositeRootContext,
    index: () => number,
    elementRef: { current: HTMLElement | null },
    sources: ReadonlyArray<() => object | undefined>,
  ) {
    this.disabledAccessor = disabled;
    this.isActive = isActive;
    this.root = root;
    this.composite = composite;
    this.index = index;
    this.elementRef = elementRef;
    this.sources = sources;
  }

  get disabled() {
    return this.disabledAccessor();
  }

  get open() {
    return this.isActive();
  }

  /** Calls each source's handler for `key` until one prevents the rest (`mergeProps` order). */
  dispatch(key: string, event: BaseUIEvent<Event>) {
    for (const source of this.sources) {
      if (event.baseUIHandlerPrevented) {
        return;
      }
      const props = source();
      const handler = props ? readHandler(props, key) : undefined;
      if (handler) {
        handler(event);
      }
    }
  }

  /** `useCompositeItem`'s focus: the composite highlights this trigger. */
  focus() {
    this.composite.onHighlightedIndexChange(this.index());
  }

  /** `useCompositeItem`'s hover highlight: focus the trigger when the composite highlights on hover. */
  mouseMove() {
    const el = this.elementRef.current;
    if (!this.composite.highlightItemOnHover() || !el) {
      return;
    }
    const disabled = el.hasAttribute('disabled') || el.ariaDisabled === 'true';
    if (!this.composite.isHighlighted(this.index()) && !disabled) {
      el.focus();
    }
  }
}

type TriggerModel = NativeNavigationMenuTriggerModel;

/** A disabled trigger cancels the event and runs no handler (`useButton`'s click and pointerdown). */
function preventWhileDisabled(trigger: TriggerModel, event: Event) {
  if (trigger.disabled) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (trigger: TriggerModel) => !trigger.disabled;

const dispatchSources = (key: string) => (trigger: TriggerModel, event: Event) =>
  trigger.dispatch(key, event as BaseUIEvent<Event>);

/**
 * A native trigger's handlers, created once: `useButton`'s gates for a focusable-when-disabled
 * native composite button, then the consumer's handler, then the trigger's sources (`dispatch`)
 * and the composite item's.
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<TriggerModel>>> = {
  onClick: partHandler('onClick', dispatchSources('onClick'), preventWhileDisabled),
  onPointerDown: partHandler(
    'onPointerDown',
    dispatchSources('onPointerDown'),
    preventWhileDisabled,
  ),
  onMouseDown: partHandler('onMouseDown', dispatchSources('onMouseDown'), runWhileEnabled),
  onKeyDown: partHandler<TriggerModel, KeyboardEvent>(
    'onKeyDown',
    (trigger, event) => {
      trigger.dispatch('onKeyDown', event);
      compositeButtonKeyDownAfterConsumer(event);
    },
    (trigger, event) => {
      // Allow Tabbing away from the focusable-when-disabled button; block every other key.
      if (trigger.disabled && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !trigger.disabled;
    },
  ),
  onKeyUp: compositeButtonKeyUp<TriggerModel>((trigger) => trigger.disabled),
  onFocus: partHandler('onFocus', (trigger: TriggerModel, event) => {
    trigger.dispatch('onFocus', event);
    trigger.focus();
  }),
  onBlur: partHandler('onBlur', dispatchSources('onBlur')),
  onMouseEnter: partHandler('onMouseEnter', dispatchSources('onMouseEnter')),
  onMouseLeave: partHandler('onMouseLeave', dispatchSources('onMouseLeave')),
  onMouseMove: partHandler('onMouseMove', (trigger: TriggerModel, event) => {
    trigger.dispatch('onMouseMove', event);
    trigger.mouseMove();
  }),
  onPointerEnter: partHandler('onPointerEnter', dispatchSources('onPointerEnter')),
};

const writeTriggerState = compileStateWriter(['disabled'], undefined);

/** The trigger's own attributes below the consumer's: one write per pass. */
function writeTriggerAttributes(w: SetAttribute, trigger: TriggerModel) {
  const open = trigger.open;
  w.set('aria-expanded', open ? 'true' : 'false');
  w.set('aria-controls', open ? trigger.root.popupElement()?.id : undefined);
  // `useFocusableWhenDisabled` for a focusable-when-disabled native composite button.
  w.set('aria-disabled', trigger.disabled ? 'true' : 'false');
  // `pressableTriggerOpenStateMapping`.
  w.set(CommonTriggerDataAttributes.popupOpen, open ? '' : undefined);
  w.set(CommonTriggerDataAttributes.pressed, open ? '' : undefined);
}

const triggerState = (trigger: TriggerModel) => trigger;

/**
 * Opens the navigation menu popup when hovered or clicked, revealing the
 * associated content.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuTrigger(componentProps: NavigationMenuTrigger.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<button>` trigger
  // renders with direct JSX and registers with its list's composite; `useButton` and
  // `useCompositeItem` inlined (D32). The server and hydration keep the slow path.
  const native =
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton ?? true);
  const disabled = () => componentProps.disabled ?? false;

  const rootContext = useNavigationMenuRootContext();
  const {
    value,
    setValue,
    mounted,
    open,
    positionerElement,
    setActivationDirection,
    registerTriggerFloatingContext,
    popupElement,
    viewportElement,
    transitionStatus,
    rootRef,
    beforeOutsideRef,
    afterOutsideRef,
    afterInsideRef,
    beforeInsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    currentContentRef,
    delay,
    closeDelay,
    orientation,
    setViewportInert,
    nested,
  } = rootContext;
  const { value: itemValue } = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();
  const dismissProps = useNavigationMenuDismissContext();
  const direction = useDirection();

  const stickIfOpenTimeout = useTimeout();
  const mutationFrame = useAnimationFrame();
  const resizeFrame = useAnimationFrame();
  const sizeFrame = useAnimationFrame();

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);
  const [stickIfOpen, setStickIfOpen] = createSignal(true);
  const [pointerType, setPointerType] = createSignal<'mouse' | 'touch' | 'pen' | ''>('');

  const triggerElementRef = useRef<HTMLElement | null>(null);
  const prevSizeRef = useRef(DEFAULT_SIZE);
  const skipAutoSizeSyncRef = useRef(false);

  // A memo holds the committed (rendered) state until the next flush, as React's render-time
  // `isActiveItem`; handlers that run after an activation in the same event still see it.
  const isActiveItem = createMemo(() => open() && value() === itemValue());
  const interactionsEnabled = () => (positionerElement() != null || value() == null) && !disabled();
  const hoverFloatingElement = () => positionerElement() || viewportElement();
  const hoverInteractionsEnabled = () =>
    (hoverFloatingElement() != null || value() == null) && !disabled();

  const runOnceAnimationsFinish = useAnimationsFinished(popupElement);

  const handleTriggerElement = (element: HTMLElement | null) => {
    triggerElementRef.current = element;
    setTriggerElement(element);
  };

  // Solid: plain functions read the latest values, as React's stable callbacks.
  function cancelAutoSizeReset(force = false) {
    if (!force && popupAutoSizeResetRef.current.owner !== untrack(itemValue)) {
      return;
    }

    popupAutoSizeResetRef.current.abortController?.abort();
    popupAutoSizeResetRef.current.abortController = null;
    popupAutoSizeResetRef.current.owner = null;
  }

  createDepsRenderEffect(isActiveItem, (active) => {
    if (active) {
      return;
    }

    mutationFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  });

  function setAutoSizes(element: HTMLElement) {
    element.style.setProperty(NavigationMenuPopupCssVars.popupWidth, 'auto');
    element.style.setProperty(NavigationMenuPopupCssVars.popupHeight, 'auto');
  }

  function clearFixedSizes(popup: HTMLElement, positioner: HTMLElement) {
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
  }

  function scheduleAutoSizeReset(popup: HTMLElement) {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    popupAutoSizeResetRef.current.abortController = abortController;
    popupAutoSizeResetRef.current.owner = untrack(itemValue);

    runOnceAnimationsFinish(() => {
      popupAutoSizeResetRef.current.abortController = null;
      popupAutoSizeResetRef.current.owner = null;
      setAutoSizes(popup);
    }, abortController.signal);
  }

  function handleValueChange(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);
    const measuredWidth = width || prevSizeRef.current.width;
    const measuredHeight = height || prevSizeRef.current.height;

    if (currentHeight === 0 || currentWidth === 0) {
      currentWidth = measuredWidth;
      currentHeight = measuredHeight;
    }

    popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
    popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerWidth,
      `${measuredWidth}px`,
    );
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerHeight,
      `${measuredHeight}px`,
    );

    sizeFrame.request(() => {
      if (!untrack(isActiveItem)) {
        return;
      }

      popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
      popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${measuredHeight}px`);

      scheduleAutoSizeReset(popup);
    });
  }

  function handleInterruptedMutationResize(
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);

    if (currentWidth === 0 || currentHeight === 0) {
      return;
    }

    setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

    mutationFrame.request(() => {
      mutationFrame.request(() => {
        clearFixedSizes(popup, positioner);

        const { width, height } = getCssDimensions(popup);
        const measuredWidth = width || currentWidth;
        const measuredHeight = height || currentHeight;

        setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

        sizeFrame.request(() => {
          if (!untrack(isActiveItem)) {
            return;
          }

          setSharedFixedSize(popup, positioner, measuredWidth, measuredHeight);
          scheduleAutoSizeReset(popup);
        });
      });
    });
  }

  function syncCurrentSize(popup: HTMLElement, positioner: HTMLElement) {
    sizeFrame.cancel();
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);

    if (width === 0 || height === 0) {
      return;
    }

    prevSizeRef.current = { width, height };
    setAutoSizes(popup);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${width}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${height}px`);
  }

  function getMutationBaseline(popup: HTMLElement) {
    const popupWidth = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing =
      popupWidth !== '' && popupWidth !== 'auto' && popupHeight !== '' && popupHeight !== 'auto';

    if (!isResizing) {
      return { size: prevSizeRef.current, syncPositioner: false };
    }

    return {
      size: {
        width: popup.offsetWidth || prevSizeRef.current.width,
        height: popup.offsetHeight || prevSizeRef.current.height,
      },
      syncPositioner: true,
    };
  }

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      stickIfOpenTimeout.clear();
      mutationFrame.cancel();
      resizeFrame.cancel();
      sizeFrame.cancel();
      cancelAutoSizeReset(true);
      skipAutoSizeSyncRef.current = false;
      setPointerType('');
    }
  });

  createEffect(mounted, (isMounted) => {
    if (!isMounted) {
      prevSizeRef.current = DEFAULT_SIZE;
    }
  });

  createDepsRenderEffect(popupElement, (popup) => {
    if (!popup || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      prevSizeRef.current = {
        width: popup.offsetWidth,
        height: popup.offsetHeight,
      };
    });

    resizeObserver.observe(popup);

    return () => {
      resizeObserver.disconnect();
    };
  });

  createDepsEffect(
    () => ({
      open: open(),
      active: isActiveItem(),
      popup: popupElement(),
      positioner: positionerElement(),
    }),
    ({ open: isOpen, active, popup, positioner }) => {
      if (!isOpen || !active || !popup || !positioner) {
        return undefined;
      }

      const win = ownerWindow(positioner);
      function handleResize() {
        resizeFrame.cancel();
        resizeFrame.request(() => syncCurrentSize(popup!, positioner!));
      }

      const unsubscribe = addEventListener(win, 'resize', handleResize);

      return () => {
        resizeFrame.cancel();
        unsubscribe();
      };
    },
  );

  createDepsEffect(
    () => ({
      popup: popupElement(),
      positioner: positionerElement(),
      active: isActiveItem(),
      transitionStatus: transitionStatus(),
    }),
    ({ popup, positioner, active, transitionStatus: status }) => {
      const observedElement = currentContentRef.current;

      if (
        !observedElement ||
        !popup ||
        !positioner ||
        !active ||
        typeof MutationObserver !== 'function'
      ) {
        return undefined;
      }

      const mutationObserver = new MutationObserver(() => {
        if (
          status === 'starting' ||
          popup.hasAttribute(TransitionStatusDataAttributes.startingStyle)
        ) {
          syncCurrentSize(popup, positioner);
          return;
        }

        const { size, syncPositioner } = getMutationBaseline(popup);

        if (syncPositioner) {
          handleInterruptedMutationResize(popup, positioner, size.width, size.height);
          return;
        }

        handleValueChange(popup, positioner, size.width, size.height);
      });

      mutationObserver.observe(observedElement, {
        childList: true,
        subtree: true,
        characterData: true,
        // `keepMounted` submenu switches update dimensions by toggling hidden
        // content rather than inserting or removing content nodes.
        attributes: true,
        attributeFilter: ['hidden'],
      });

      return () => {
        mutationObserver.disconnect();
      };
    },
  );

  // Solid: a user effect, so the popup has rendered its content before it is measured, as React's
  // layout effect runs after commit.
  createDepsEffect(
    () => ({
      open: open(),
      popup: popupElement(),
      positioner: positionerElement(),
      transitionStatus: transitionStatus(),
    }),
    ({ open: isOpen, popup, positioner }) => {
      if (untrack(isActiveItem) && isOpen && popup && positioner) {
        if (skipAutoSizeSyncRef.current) {
          skipAutoSizeSyncRef.current = false;
          return undefined;
        }

        const { width, height } = getCssDimensions(popup);
        handleValueChange(popup, positioner, width, height);
      }
      return undefined;
    },
  );

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails: NavigationMenuRoot.ChangeEventDetails,
  ) {
    const isHover = eventDetails.reason === REASONS.triggerHover;

    if (!interactionsEnabled()) {
      return;
    }

    if (pointerType() === 'touch' && isHover) {
      return;
    }

    if (!nextOpen && value() !== itemValue()) {
      return;
    }

    function changeState() {
      if (isHover) {
        // Only allow "patient" clicks to close the popup if it's open.
        // If they clicked within 500ms of the popup opening, keep it open.
        setStickIfOpen(true);
        stickIfOpenTimeout.clear();
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      }

      if (nextOpen) {
        setValue(itemValue(), eventDetails);
      } else {
        setValue(null, eventDetails);
        setPointerType('');
      }
    }

    if (isHover) {
      flushSync(changeState);
    } else {
      changeState();
    }
  }

  const context = useFloatingRootContext({
    get open() {
      return open();
    },
    onOpenChange: (nextOpen, eventDetails) =>
      handleOpenChange(nextOpen, eventDetails as NavigationMenuRoot.ChangeEventDetails),
    elements: {
      get reference() {
        return triggerElement();
      },
    },
  });
  // The shared positioner (or viewport) is each trigger's floating element: derived in the same
  // flush, so a positioner that mounts never shows readers a stale floating element.
  context.useSyncedValue('floatingElement', (prev) => {
    const floating = hoverFloatingElement();
    return floating !== undefined ? floating : prev;
  });

  const hoverInteractionState = useHoverInteractionSharedState({ store: context });
  const shouldBlockSafePolygonPointerEvents = () => pointerType() !== 'touch';

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      context.context.dataRef.openEvent = undefined;
      hoverInteractionState[1]('pointerType', undefined);
      hoverInteractionState[1]('interactedInside', false);
      hoverInteractionState[1]('restTimeoutPending', false);
      hoverInteractionState[0].openChangeTimeout.clear();
      hoverInteractionState[0].restTimeout.clear();
    }

    return () => {
      clearSafePolygonPointerEventsMutation(hoverInteractionState);
    };
  });

  function getInlineHandleCloseContext() {
    const floatingElement = hoverFloatingElement();
    if (!nested() || positionerElement() || !triggerElementRef.current || !floatingElement) {
      return null;
    }

    return getHandleCloseContext(triggerElementRef.current, floatingElement, nodeId?.());
  }

  function getScope() {
    if (nested() && positionerElement()) {
      return null;
    }

    return closest(triggerElementRef.current, 'ul');
  }

  // Set once the trigger is disposed: a pointer-events mutation deferred to a microtask (a hover
  // moving between triggers) is dropped then, since no cleanup is left to clear it and the scope
  // (the document body) would keep `pointer-events: none`. React queues the same microtask.
  let disposed = false;
  void onCleanup(() => {
    disposed = true;
  });

  // Solid: React's click handler closes over the render-time `toggle`, while `useClick` reads it
  // live; keep the value from before this event's activation flush for the rest of the event.
  let toggleDuringActivation: boolean | undefined;

  // A closed trigger renders handlers only: hover and click (and their merged reference props) are
  // created on the trigger's first intent, in the capture phase before its own listeners, or once
  // its item is active, and are kept afterwards (D32, as Popover and Tooltip do). React mounts them
  // up front; the floating root context above stays eager, since the root derives its context from
  // the triggers' registered ones.
  const interactions = useTriggerInteractions(
    () => {
      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          get enabled() {
            return hoverInteractionsEnabled();
          },
          move: false,
          handleClose: safePolygon({
            get blockPointerEvents() {
              return shouldBlockSafePolygonPointerEvents();
            },
            getScope,
          }),
          restMs: () => (mounted() && positionerElement() ? 0 : delay()),
          delay: () => ({ close: closeDelay() }),
          // The signal, not `triggerElementRef.current`: the hover hook attaches its listeners
          // in an effect that must re-run once the element exists.
          get triggerElementRef() {
            return triggerElement();
          },
          getHandleCloseContext: getInlineHandleCloseContext,
        },
      });

      const click = useClick({
        context,
        props: {
          get enabled() {
            return interactionsEnabled();
          },
          get stickIfOpen() {
            return stickIfOpen();
          },
          get toggle() {
            return toggleDuringActivation ?? isActiveItem();
          },
        },
      });
      // Solid: `useInteractions` merges the interaction props, as React's `mergeProps` call; the
      // native path dispatches to each instead.
      const merged = native
        ? undefined
        : useInteractions(
            [
              hoverProps ? { reference: hoverProps as JSX.HTMLAttributes<Element> } : null,
              click,
            ].filter(Boolean) as ElementProps[],
          );
      return { hover: hoverProps, click, merged };
    },
    triggerElement,
    isActiveItem,
  );
  // The merged reference props once the interactions exist; until then the props pass through.
  const getReferenceProps = (userProps?: JSX.HTMLAttributes<Element>) =>
    interactions()?.merged?.getReferenceProps(userProps) ?? userProps ?? EMPTY_OBJECT;

  // The root derives its floating context from the active trigger; this remembers the element.
  registerTriggerFloatingContext({ active: isActiveItem, context });
  createDepsEffect(
    () => ({ active: isActiveItem(), element: triggerElement() }),
    ({ active, element }) => {
      if (active) {
        prevTriggerElementRef.current = element;
      }
    },
  );

  function handleActivation(event: MouseEvent | KeyboardEvent) {
    toggleDuringActivation = untrack(isActiveItem);
    queueMicrotask(() => {
      toggleDuringActivation = undefined;
    });

    flushSync(() => {
      const currentTarget = event.currentTarget as HTMLElement;
      const prevTriggerRect = prevTriggerElementRef.current?.getBoundingClientRect();
      const trigger = triggerElement();

      if (mounted() && prevTriggerRect && trigger) {
        const nextTriggerRect = trigger.getBoundingClientRect();
        const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
        const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;

        if (orientation() === 'horizontal' && nextTriggerRect.left !== prevTriggerRect.left) {
          setActivationDirection(isMovingRight ? 'right' : 'left');
        } else if (orientation() === 'vertical' && nextTriggerRect.top !== prevTriggerRect.top) {
          setActivationDirection(isMovingDown ? 'down' : 'up');
        }
      }

      // Reset the `openEvent` to `undefined` when the active item changes so that a
      // `click` -> `hover` on new trigger -> `hover` back to old trigger doesn't unexpectedly
      // cause the popup to remain stuck open when leaving the old trigger.
      if (event.type !== 'click' && value() != null) {
        context.context.dataRef.openEvent = undefined;
      }

      if (pointerType() === 'touch' && event.type !== 'click') {
        return;
      }

      // Keyboard open events reach this activation path after `onKeyDown` has already set
      // the value with the `listNavigation` reason.
      const currentValue = value();
      if (currentValue != null && event.type !== 'keydown') {
        setValue(
          itemValue(),
          createChangeEventDetails(
            event.type === 'mouseenter' ? REASONS.triggerHover : REASONS.triggerPress,
            event,
          ),
        );
      }

      const floatingElement = hoverFloatingElement();
      if (
        event.type === 'mouseenter' &&
        shouldBlockSafePolygonPointerEvents() &&
        (!nested() || !positionerElement()) &&
        floatingElement
      ) {
        const applyPointerEventsMutation = () => {
          const scopeElement = getScope() ?? currentTarget.ownerDocument.body;

          applySafePolygonPointerEventsMutation(hoverInteractionState, {
            scopeElement,
            referenceElement: currentTarget,
            floatingElement,
          });
        };

        if (currentValue != null && currentValue !== itemValue()) {
          queueMicrotask(() => {
            if (!disposed) {
              applyPointerEventsMutation();
            }
          });
        } else {
          applyPointerEventsMutation();
        }
      }
    });
  }

  function handleOpenEvent(event: MouseEvent | KeyboardEvent) {
    if (disabled()) {
      return;
    }

    const popup = popupElement();
    const positioner = positionerElement();
    if (!popup || !positioner) {
      handleActivation(event);
      return;
    }

    const { width, height } = getCssDimensions(popup);
    const currentValue = value();
    const shouldSkipAutoSizeSync =
      currentValue != null &&
      currentValue !== itemValue() &&
      (event.type === 'click' || pointerType() !== 'touch');

    handleActivation(event);

    if (shouldSkipAutoSizeSync) {
      skipAutoSizeSyncRef.current = true;
    }

    handleValueChange(popup, positioner, width, height);
  }

  const state: NavigationMenuTriggerState = {
    get open() {
      return isActiveItem();
    },
    get disabled() {
      return disabled();
    },
  };

  function handleSetPointerType(event: PointerEvent) {
    setPointerType(event.pointerType as 'mouse' | 'touch' | 'pen' | '');
  }

  function handleTriggerPointerDown(event: PointerEvent) {
    handleSetPointerType(event);
    clearSafePolygonPointerEventsMutation(hoverInteractionState);
  }

  const defaultProps: HTMLProps = {
    tabindex: 0,
    onMouseEnter: handleOpenEvent,
    onClick: handleOpenEvent,
    onPointerEnter: handleSetPointerType,
    onPointerDown: handleTriggerPointerDown,
    get 'aria-expanded'() {
      return isActiveItem() ? 'true' : 'false';
    },
    get 'aria-controls'() {
      return isActiveItem() ? popupElement()?.id : undefined;
    },
    [NAVIGATION_MENU_TRIGGER_IDENTIFIER as string]: '',
    onFocus() {
      if (!isActiveItem()) {
        return;
      }
      setViewportInert(false);
    },
    onMouseLeave() {
      if (value() == null) {
        clearSafePolygonPointerEventsMutation(hoverInteractionState);
      }
    },
    onKeyDown(event: KeyboardEvent) {
      // For nested (submenu) triggers, don't intercept arrow keys that are used for
      // navigation in the parent content. The arrow keys should be handled by the
      // parent's CompositeRoot for navigating between items.
      if (nested()) {
        return;
      }

      const verticalOpenKey = direction() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const openHorizontal = orientation() === 'horizontal' && event.key === 'ArrowDown';
      const openVertical = orientation() === 'vertical' && event.key === verticalOpenKey;

      if (openHorizontal || openVertical) {
        setValue(itemValue(), createChangeEventDetails(REASONS.listNavigation, event));
        handleOpenEvent(event);
        stopEvent(event);
      }
    },
    onBlur(event: FocusEvent) {
      const popup = popupElement();
      if (
        positionerElement() &&
        popup &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget as HTMLElement | null,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement: popup, rootRef: rootRef.current, tree, nodeId: nodeId?.() },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
  };

  // The element is created once, here, under the trigger's owner.
  const element = native ? nativeElement() : slowElement();

  function nativeElement() {
    const listItem = createNativeListItem<null>(null);
    const model = new NativeNavigationMenuTriggerModel(
      disabled,
      isActiveItem,
      rootContext,
      useCompositeRootContext(),
      listItem.index,
      triggerElementRef,
      [
        () => defaultProps,
        () => dismissProps?.()?.reference,
        () => interactions()?.hover,
        () => interactions()?.click.reference,
      ],
    );
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
    const el = (<button type="button" />) as unknown as HTMLButtonElement;
    return renderNativeElement(el, componentProps, {
      own: OWN_KEYS,
      state: triggerState,
      stateWriter: writeTriggerState,
      stateView: model,
      reactive: true,
      literal: TRIGGER_LITERALS,
      attributes: writeTriggerAttributes,
      handlers: TRIGGER_HANDLERS,
      handlerTarget: model,
      refs: [handleTriggerElement, listItem.setRef],
    }) as unknown as JSX.Element;
  }

  function slowElement() {
    const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
      'style',
      'ref',
      'nativeButton',
      'disabled',
    ]);
    const { buttonSources, buttonRef } = useButton({
      disabled,
      focusableWhenDisabled: true,
      native: () => local.nativeButton ?? true,
    });

    return (
      <CompositeItem
        tag="button"
        render={renderProps.render}
        class={renderProps.class}
        style={local.style}
        state={state}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
        refs={[local.ref as UseRenderElementRef<HTMLElement>, handleTriggerElement, buttonRef]}
        baseProps={buttonSources.attributes}
        props={[
          getReferenceProps,
          dismissProps?.()?.reference || EMPTY_ARRAY,
          defaultProps,
          elementProps,
          buttonSources.handlers,
        ]}
      />
    );
  }

  const referenceElement = hoverFloatingElement;

  return (
    <>
      {element}
      <Show when={isActiveItem()}>
        <FocusGuard
          ref={(el) => {
            beforeOutsideRef.current = el;
          }}
          onFocus={(event) => {
            const referenceEl = referenceElement();
            if (referenceEl && isOutsideEvent(event, referenceEl)) {
              beforeInsideRef.current?.focus();
            } else {
              const prevTabbable = getPreviousTabbable(triggerElement());
              prevTabbable?.focus();
            }
          }}
        />
        <span aria-owns={viewportElement()?.id} style={ownerVisuallyHidden} />
        <FocusGuard
          ref={(el) => {
            afterOutsideRef.current = el;
          }}
          onFocus={(event) => {
            const referenceEl = referenceElement();
            if (referenceEl && isOutsideEvent(event, referenceEl)) {
              flushSync(() => {
                setViewportInert(false);
              });
              const elementToFocus = afterInsideRef.current || triggerElement();
              elementToFocus?.focus();
            } else {
              let nextTabbable = getNextTabbable(triggerElement());

              if (
                nested() &&
                !positionerElement() &&
                referenceEl &&
                nextTabbable &&
                contains(referenceEl, nextTabbable)
              ) {
                nextTabbable = getTabbableAfterElement(afterInsideRef.current);
              }

              nextTabbable?.focus();

              if ((!nested() || positionerElement()) && !contains(rootRef.current, nextTabbable)) {
                setValue(null, createChangeEventDetails(REASONS.focusOut, event));
              }
            }
          }}
        />
      </Show>
    </>
  );
}

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface NavigationMenuTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NavigationMenuTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace NavigationMenuTrigger {
  export type State = NavigationMenuTriggerState;
  export type Props = NavigationMenuTriggerProps;
}

function getPlacementFromElements(
  domReferenceElement: Element,
  floatingElement: HTMLElement,
): Placement {
  const referenceRect = domReferenceElement.getBoundingClientRect();
  const floatingRect = floatingElement.getBoundingClientRect();
  const referenceCenterX = referenceRect.left + referenceRect.width / 2;
  const referenceCenterY = referenceRect.top + referenceRect.height / 2;
  const floatingCenterX = floatingRect.left + floatingRect.width / 2;
  const floatingCenterY = floatingRect.top + floatingRect.height / 2;
  const deltaX = floatingCenterX - referenceCenterX;
  const deltaY = floatingCenterY - referenceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function getHandleCloseContext(
  domReferenceElement: Element,
  floatingElement: HTMLElement,
  nodeId: string | undefined,
): HandleCloseContextBase {
  // Solid: the hover hooks read the close context through accessors.
  const placement = getPlacementFromElements(domReferenceElement, floatingElement);
  return {
    placement: () => placement,
    elements: {
      domReference: () => domReferenceElement,
      floating: () => floatingElement,
    },
    nodeId: () => nodeId,
  };
}
