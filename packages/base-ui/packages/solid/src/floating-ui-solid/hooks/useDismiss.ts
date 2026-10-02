/* eslint-disable typescript/no-explicit-any -- EventTarget addEventListener variants + Solid event-handler shape bridging require any-casts */
import { getOverflowAncestors } from '@floating-ui/dom';
import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
  isShadowRoot,
  isWebKit,
} from '@floating-ui/utils/dom';
import { createTrackedEffect, createEffect, createMemo, onCleanup } from 'solid-js';
import { access, defaultProps } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { useTimeout } from '../../utils/useTimeout';
import { useFloatingTree } from '../components/FloatingTree';
import { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import {
  contains,
  getNodeChildren,
  getTarget,
  isEventTargetInsidePortal,
  isEventTargetWithin,
  isRootElement,
} from '../utils';
import { createAttribute } from '../utils/createAttribute';
import { on } from '../../solid-1-compat';

function alwaysFalse() {
  return false;
}

type PressType = 'intentional' | 'sloppy';

const bubbleHandlerKeys = {
  intentional: 'onClick',
  sloppy: 'onPointerDown',
} as const;

export function normalizeProp(
  normalizable?: boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined },
) {
  return {
    escapeKey:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.escapeKey ?? false),
    outsidePress:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.outsidePress ?? true),
  };
}

export interface UseDismissProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the `esc` key.
   * @default true
   */
  escapeKey?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the reference
   * element. You likely want to ensure the `move` option in the `useHover()`
   * Hook has been disabled when this is in use.
   *
   * A lazy getter invoked when handling reference press events.
   * @default false
   */
  referencePress?: boolean | (() => boolean) | undefined;
  /**
   * The type of event to use to determine a "press".
   * - `down` is `pointerdown` on mouse input, but special iOS-like touch handling on touch input.
   * - `up` is lazy on both mouse + touch input (equivalent to `click`).
   * @default 'down'
   */
  referencePressEvent?: PressType | undefined;
  /**
   * Whether to dismiss the floating element upon pressing outside of the
   * floating element.
   * If you have another element, like a toast, that is rendered outside the
   * floating element's Solid tree and don't want the floating element to close
   * when pressing it, you can guard the check like so:
   * ```jsx
   * useDismiss(context, {
   *   outsidePress: (event) => !event.target.closest('.toast'),
   * });
   * ```
   * @default true
   */
  outsidePress?: boolean | ((event: MouseEvent | TouchEvent) => boolean) | undefined;
  /**
   * The type of event to use to determine an outside "press".
   * - `intentional` requires the user to click outside intentionally, firing on `pointerup` for mouse, and requiring minimal `touchmove`s for touch.
   * - `sloppy` fires on `pointerdown` for mouse, while for touch it fires on `touchend` (within 1 second) or while scrolling away after `touchstart`.
   */
  outsidePressEvent?:
    | PressType
    | {
        mouse: PressType;
        touch: PressType;
      }
    | (() =>
        | PressType
        | {
            mouse: PressType;
            touch: PressType;
          })
    | undefined;

  /**
   * Whether to dismiss the floating element upon scrolling an overflow
   * ancestor.
   * @default false
   */
  ancestorScroll?: boolean | undefined;
  /**
   * Determines whether event listeners bubble upwards through a tree of
   * floating elements.
   */
  bubbles?:
    | boolean
    | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined }
    | undefined;
  /**
   * External FlatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Closes the floating element when a dismissal is requested — by default, when
 * the user presses the `escape` key or outside of the floating element.
 * @see https://floating-ui.com/docs/useDismiss
 */
export function useDismiss(parameters: {
  context: FloatingRootContext | FloatingContext;
  props?: UseDismissProps;
}): ElementProps {
  const props = defaultProps(parameters.props ?? {}, {
    ancestorScroll: false,
    enabled: true,
    escapeKey: true,
    outsidePress: true,
    outsidePressEvent: 'sloppy',
    referencePress: alwaysFalse as () => boolean,
    referencePressEvent: 'sloppy' as PressType,
  });

  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const dataRef = () => store().context.dataRef;
  const open = createMemo(() => store().select('open'));
  const floatingElement = createMemo(() => store().select('floatingElement'));
  const referenceElement = createMemo(() => store().select('referenceElement'));
  const domReferenceElement = createMemo(() => store().select('domReferenceElement'));

  const bubbles = createMemo(() => normalizeProp(props.bubbles));

  const tree = useFloatingTree(props.externalTree);
  const outsidePress = createMemo(() => {
    // If it's an event callback
    if (typeof props.outsidePress === 'function') {
      return props.outsidePress;
    }

    return props.outsidePress ?? true;
  });
  const outsidePressEnabled = createMemo(() => outsidePress() !== false);

  const isReferencePressEnabled = () => {
    const refPress = props.referencePress;
    if (typeof refPress === 'function') return refPress();
    return refPress ?? false;
  };

  let pressStartedInsideRef = false;
  let pressStartPreventedRef = false;
  /* Ignore only the very next outside click after dragging from inside to outside. */
  let suppressNextOutsideClickRef = false;

  let touchStateRef = null as {
    startTime: number;
    startX: number;
    startY: number;
    dismissOnTouchEnd: boolean;
    dismissOnMouseDown: boolean;
  } | null;

  const cancelDismissOnEndTimeout = useTimeout();
  const clearinsidePortalTimeout = useTimeout();
  const compositionTimeout = useTimeout();

  const clearinsidePortal = () => {
    clearinsidePortalTimeout.clear();
    dataRef().insidePortal = false;
  };

  let isComposingRef = false;
  let currentPointerTypeRef: PointerEvent['pointerType'] = '';

  const getOutsidePressEvent = () => {
    const type = currentPointerTypeRef as 'pen' | 'mouse' | 'touch' | '';
    const computedType = type === 'pen' || !type ? 'mouse' : type;

    const resolved =
      typeof props.outsidePressEvent === 'function'
        ? props.outsidePressEvent()
        : props.outsidePressEvent;

    if (typeof resolved === 'string') {
      return resolved;
    }

    return resolved[computedType];
  };

  const isEventTargetWithinChildren = (event: Event) => {
    const nodeId = dataRef().floatingContext?.nodeId();

    return (
      tree &&
      getNodeChildren(tree.nodesRef, nodeId).some((node) =>
        isEventTargetWithin(event, node.context?.elements.floating()),
      )
    );
  };

  const isEventTargetWithinFloatingTree = (event: Event) => {
    return (
      isEventTargetWithin(event, floatingElement()) ||
      isEventTargetWithin(event, domReferenceElement()) ||
      isEventTargetWithinChildren(event)
    );
  };

  const isPrimaryButtonPress = (event: MouseEvent | PointerEvent) => {
    return event.button == null || event.button === 0;
  };

  const closeOnEscapeKeyDown = (event: KeyboardEvent) => {
    if (!event.currentTarget) {
      return;
    }

    if (!open() || !props.enabled || !props.escapeKey || event.key !== 'Escape') {
      return;
    }

    // Wait until IME is settled. Pressing `Escape` while composing should
    // close the compose menu, but not the floating element.
    if (isComposingRef) {
      return;
    }

    const nodeId = dataRef().floatingContext?.nodeId();

    const children = tree ? getNodeChildren(tree.nodesRef, nodeId) : [];

    let shouldDismiss = true;
    if (children.length > 0) {
      for (const child of children) {
        if (child.context?.open() && !child.context.dataRef.__escapeKeyBubbles) {
          shouldDismiss = false;
          break;
        }
      }
    }

    if (!shouldDismiss) {
      return;
    }

    dataRef().__closing = true;

    const eventDetails = createChangeEventDetails(REASONS.escapeKey, event);

    store().setOpen(false, eventDetails);

    if (!bubbles().escapeKey && !eventDetails.isPropagationAllowed) {
      event.stopImmediatePropagation();
    }
  };

  const shouldIgnoreEvent = (event: Event) => {
    const computedOutsidePressEvent = getOutsidePressEvent();
    return (
      (computedOutsidePressEvent === 'intentional' && event.type !== 'click') ||
      (computedOutsidePressEvent === 'sloppy' && event.type === 'click')
    );
  };

  const markinsidePortal = () => {
    dataRef().insidePortal = true;
    clearinsidePortalTimeout.start(0, clearinsidePortal);
  };

  const closeOnPressOutside = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (shouldIgnoreEvent(event)) {
      clearinsidePortal();
      return;
    }

    if (dataRef().insidePortal) {
      clearinsidePortal();
      return;
    }

    if (isEventTargetInsidePortal(event)) {
      markinsidePortal();
      /* If the target is inside a portal OR its dismissal is managed externally then don't dismiss here */
      const managed = (event.target as HTMLElement)?.hasAttribute(createAttribute('managed'));

      if (!tree && !managed && typeof outsidePress() !== 'function') {
        return;
      }
    }

    const resolvedOutsidePress = outsidePress();
    if (typeof resolvedOutsidePress === 'function' && !resolvedOutsidePress(event)) {
      return;
    }

    const target = getTarget(event);
    const inertSelector = `[${createAttribute('inert')}]`;
    const targetRoot = isElement(target) ? target.getRootNode() : null;
    const markers = Array.from(
      (isShadowRoot(targetRoot)
        ? targetRoot
        : ownerDocument(store().select('floatingElement') ?? null)
      ).querySelectorAll(inertSelector),
    );

    const triggers = store().context.triggerElements;

    // If another trigger is clicked, don't close the floating element.
    if (
      target &&
      (triggers.hasElement(target as Element) ||
        triggers.hasMatchingElement((trigger: Element) => contains(trigger, target as Element)))
    ) {
      return;
    }

    let targetRootAncestor = isElement(target) ? target : null;
    while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
      const nextParent = getParentNode(targetRootAncestor);
      if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
        break;
      }

      targetRootAncestor = nextParent;
    }

    // Check if the click occurred on a third-party element injected after the
    // floating element rendered.
    if (
      markers.length &&
      isElement(target) &&
      !isRootElement(target) &&
      // Clicked on a direct ancestor (e.g. FloatingOverlay).
      !contains(target, floatingElement()) &&
      // If the target root element contains none of the markers, then the
      // element was injected after the floating element rendered.
      markers.every((marker) => !contains(targetRootAncestor, marker))
    ) {
      return;
    }

    // Check if the click occurred on the scrollbar
    // Skip for touch events: scrollbars don't receive touch events on most platforms
    if (isHTMLElement(target) && !('touches' in event)) {
      const lastTraversableNode = isLastTraversableNode(target);
      const style = getComputedStyle(target);
      const scrollRe = /auto|scroll/;
      const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
      const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);

      const canScrollX =
        isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
      const canScrollY =
        isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;

      const isRTL = style.direction === 'rtl';

      // Check click position relative to scrollbar.
      // In some browsers it is possible to change the <body> (or window)
      // scrollbar to the left side, but is very rare and is difficult to
      // check for. Plus, for modal dialogs with backdrops, it is more
      // important that the backdrop is checked but not so much the window.
      const pressedVerticalScrollbar =
        canScrollY &&
        (isRTL
          ? event.offsetX <= target.offsetWidth - target.clientWidth
          : event.offsetX > target.clientWidth);

      const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;

      if (pressedVerticalScrollbar || pressedHorizontalScrollbar) {
        return;
      }
    }

    if (isEventTargetWithinFloatingTree(event)) {
      return;
    }

    /* In intentional mode, a press that starts inside and ends outside gets one suppressed outside click.
     * Check both the pointerup-set flag (real browsers) and pressStartedInsideRef (JSDOM tests where
     * pointerup may not fire between pointerdown + click). */
    if (getOutsidePressEvent() === 'intentional' && (suppressNextOutsideClickRef || pressStartedInsideRef)) {
      suppressNextOutsideClickRef = false;
      pressStartedInsideRef = false;
      return;
    }

    const nodeId = dataRef().floatingContext?.nodeId();

    const children = tree ? getNodeChildren(tree.nodesRef, nodeId) : [];

    if (children.length > 0) {
      let shouldDismiss = true;

      children.forEach((child) => {
        const childContext = access(child.context);
        if (childContext?.open() && !childContext.dataRef.__outsidePressBubbles) {
          shouldDismiss = false;
        }
      });

      if (!shouldDismiss) {
        return;
      }
    }

    store().setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
    clearinsidePortal();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (
      getOutsidePressEvent() !== 'sloppy' ||
      event.pointerType === 'touch' ||
      !open() ||
      !props.enabled ||
      isEventTargetWithin(event, floatingElement()) ||
      isEventTargetWithin(event, domReferenceElement())
    ) {
      return;
    }

    closeOnPressOutside(event);
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (
      getOutsidePressEvent() !== 'sloppy' ||
      !open() ||
      !props.enabled ||
      isEventTargetWithin(event, floatingElement()) ||
      isEventTargetWithin(event, domReferenceElement())
    ) {
      return;
    }

    const touch = event.touches[0];
    if (touch) {
      touchStateRef = {
        dismissOnMouseDown: true,
        dismissOnTouchEnd: false,
        startTime: Date.now(),
        startX: touch.clientX,
        startY: touch.clientY,
      };

      cancelDismissOnEndTimeout.start(1000, () => {
        if (touchStateRef) {
          touchStateRef.dismissOnTouchEnd = false;
          touchStateRef.dismissOnMouseDown = false;
        }
      });
    }
  };

  function addTargetEventListenerOnce<EventType extends Event>(
    event: EventType,
    listener: (event: EventType) => void,
  ) {
    const target = getTarget(event);
    if (!target) return;
    const unsubscribe = addEventListener(target as EventTarget & { addEventListener: any; removeEventListener: any }, event.type, () => {
      listener(event);
      unsubscribe();
    });
  }

  const handleTouchStartCapture = (event: TouchEvent) => {
    currentPointerTypeRef = 'touch';
    addTargetEventListenerOnce(event, handleTouchStart);
  };

  const closeOnPressOutsideCapture = (event: PointerEvent | MouseEvent) => {
    if (event.type === 'pointerdown') {
      currentPointerTypeRef = (event as PointerEvent).pointerType;
    }

    cancelDismissOnEndTimeout.clear();

    /* Track presses that start inside the floating tree — used to suppress dismissal in intentional mode. */
    if (
      (event.type === 'pointerdown' || event.type === 'mousedown') &&
      open() &&
      props.enabled &&
      isPrimaryButtonPress(event) &&
      isEventTargetWithinFloatingTree(event)
    ) {
      if (!pressStartedInsideRef) {
        pressStartedInsideRef = true;
        pressStartPreventedRef = false;
      }
    }

    if (event.type === 'mousedown' && touchStateRef && !touchStateRef.dismissOnMouseDown) {
      return;
    }

    /* event-handler callback chain — runs in event context, not render */
    // eslint-disable-next-line solid/reactivity
    addTargetEventListenerOnce(event, (targetEvent) => {
      if (targetEvent.type === 'pointerdown') {
        handlePointerDown(targetEvent as PointerEvent);
      } else {
        closeOnPressOutside(targetEvent as MouseEvent);
      }
    });
  };

  const handlePressEndCapture = (event: PointerEvent | MouseEvent) => {
    if (!pressStartedInsideRef) {
      return;
    }

    const pressStartedInsideDefaultPrevented = pressStartPreventedRef;
    pressStartedInsideRef = false;
    pressStartPreventedRef = false;

    if (getOutsidePressEvent() !== 'intentional') {
      return;
    }

    if (event.type === 'pointercancel') {
      if (pressStartedInsideDefaultPrevented) {
        suppressNextOutsideClickRef = true;
      }
      return;
    }

    if (isEventTargetWithinFloatingTree(event)) {
      return;
    }

    if (pressStartedInsideDefaultPrevented) {
      suppressNextOutsideClickRef = true;
      return;
    }

    if (typeof outsidePress() === 'function' && !(outsidePress() as Function)(event)) {
      return;
    }

    suppressNextOutsideClickRef = true;
    clearinsidePortal();
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (
      getOutsidePressEvent() !== 'sloppy' ||
      !touchStateRef ||
      isEventTargetWithin(event, floatingElement()) ||
      isEventTargetWithin(event, domReferenceElement())
    ) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    const deltaX = Math.abs(touch.clientX - touchStateRef.startX);
    const deltaY = Math.abs(touch.clientY - touchStateRef.startY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 5) {
      touchStateRef.dismissOnTouchEnd = true;
    }

    if (distance > 10) {
      closeOnPressOutside(event);
      cancelDismissOnEndTimeout.clear();
      touchStateRef = null;
    }
  };

  const handleTouchMoveCapture = (event: TouchEvent) => {
    addTargetEventListenerOnce(event, handleTouchMove);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (
      getOutsidePressEvent() !== 'sloppy' ||
      !touchStateRef ||
      isEventTargetWithin(event, floatingElement()) ||
      isEventTargetWithin(event, domReferenceElement())
    ) {
      return;
    }

    if (touchStateRef.dismissOnTouchEnd) {
      closeOnPressOutside(event);
    }

    cancelDismissOnEndTimeout.clear();
    touchStateRef = null;
  };

  const handleTouchEndCapture = (event: TouchEvent) => {
    addTargetEventListenerOnce(event, handleTouchEnd);
  };

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!open() || !props.enabled) {
      dataRef().pressStartedInside = false;
      return;
    }

    dataRef().__escapeKeyBubbles = bubbles().escapeKey;
    dataRef().__outsidePressBubbles = bubbles().outsidePress;

    function onScroll(event: Event) {
      store().setOpen(false, createChangeEventDetails(REASONS.none, event));
    }

    function handleCompositionStart() {
      compositionTimeout.clear();
      isComposingRef = true;
    }

    function handleCompositionEnd() {
      // Safari fires `compositionend` before `keydown`, so we need to wait
      // until the next tick to set `isComposing` to `false`.
      // https://bugs.webkit.org/show_bug.cgi?id=165004
      compositionTimeout.start(
        // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
        // Only apply to WebKit for the test to remain 0ms.
        isWebKit() ? 5 : 0,
        () => {
          isComposingRef = false;
        },
      );
    }

    const floating = floatingElement();
    const doc = ownerDocument(floating ?? null);

    const unsubscribe = mergeCleanups(
      props.escapeKey &&
        mergeCleanups(
          addEventListener(doc, 'keydown', closeOnEscapeKeyDown),
          addEventListener(doc, 'compositionstart', handleCompositionStart),
          addEventListener(doc, 'compositionend', handleCompositionEnd),
        ),
      outsidePressEnabled() &&
        mergeCleanups(
          addEventListener(doc, 'click', closeOnPressOutsideCapture, true),
          addEventListener(doc, 'pointerdown', closeOnPressOutsideCapture, true),
          addEventListener(doc, 'pointerup', handlePressEndCapture, true),
          addEventListener(doc, 'pointercancel', handlePressEndCapture, true),
          addEventListener(doc, 'mousedown', closeOnPressOutsideCapture, true),
          addEventListener(doc, 'mouseup', handlePressEndCapture, true),
          addEventListener(doc, 'touchstart', handleTouchStartCapture, true),
          addEventListener(doc, 'touchmove', handleTouchMoveCapture, true),
          addEventListener(doc, 'touchend', handleTouchEndCapture, true),
        ),
    );

    let ancestors: (Element | Window | VisualViewport)[] = [];

    if (props.ancestorScroll) {
      const domReference = domReferenceElement();
      if (isElement(domReference)) {
        ancestors = getOverflowAncestors(domReference);
      }

      const floatingEl = floatingElement();
      if (isElement(floatingEl)) {
        ancestors = ancestors.concat(getOverflowAncestors(floatingEl));
      }

      const reference = referenceElement();
      if (!isElement(reference) && reference && reference.contextElement) {
        ancestors = ancestors.concat(getOverflowAncestors(reference.contextElement));
      }
    }

    /* Ignore the visual viewport for scrolling dismissal (allow pinch-zoom) */
    ancestors
      .filter((ancestor) => ancestor !== doc.defaultView?.visualViewport)
      .forEach((ancestor) => {
        ancestor.addEventListener('scroll', onScroll, { passive: true });
        _c.push(() => ancestor.removeEventListener('scroll', onScroll));
      });

    _c.push(() => {
      unsubscribe();
      compositionTimeout.clear();
      pressStartedInsideRef = false;
      pressStartPreventedRef = false;
      suppressNextOutsideClickRef = false;
      dataRef().pressStartedInside = false;
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createEffect(...on(outsidePress, clearinsidePortal));

  const reference = createMemo<ElementProps['reference']>(() => ({
    onKeyDown: closeOnEscapeKeyDown,
    [bubbleHandlerKeys[props.referencePressEvent]](event: Event) {
      if (!isReferencePressEnabled()) return;
      store().setOpen(false, createChangeEventDetails(REASONS.triggerPress, event as any));
    },
    ...(props.referencePressEvent !== 'intentional' && {
      onClick(event: Event) {
        if (!isReferencePressEnabled()) return;
        store().setOpen(false, createChangeEventDetails(REASONS.triggerPress, event as any));
      },
    }),
  }));

  const markPressStartedInsideTree = (event: PointerEvent | MouseEvent) => {
    if (!open() || !props.enabled || event.button !== 0) return;
    const target = getTarget(event) as Element | null;
    /* Only treat presses that start within the floating DOM subtree as inside. */
    if (!contains(floatingElement(), target)) return;
    if (!pressStartedInsideRef) {
      pressStartedInsideRef = true;
      pressStartPreventedRef = false;
    }
    dataRef().pressStartedInside = true;
  };

  const markInsidePressStartPrevented = (event: PointerEvent | MouseEvent) => {
    if (!open() || !props.enabled) return;
    if (!(event.defaultPrevented || (event as any).nativeEvent?.defaultPrevented)) return;
    if (pressStartedInsideRef) {
      pressStartPreventedRef = true;
    }
  };

  const markPressStartedinsidePortal = (event: PointerEvent | MouseEvent) => {
    if (!open() || !props.enabled || !isPrimaryButtonPress(event)) return;
    markPressStartedInsideTree(event);
  };

  const floating: ElementProps['floating'] = {
    onKeyDown: closeOnEscapeKeyDown,

    /* `onMouseDown` may be blocked if `event.preventDefault()` is called in
     * `onPointerDown`, such as with <NumberField.ScrubArea>.
     * See https://github.com/mui/base-ui/pull/3379 */
    onPointerDown: markInsidePressStartPrevented,
    onMouseDown: markInsidePressStartPrevented,
    ref: withCaptureListeners({
      click: markinsidePortal,
      mousedown: (event) => {
        markinsidePortal();
        markPressStartedinsidePortal(event);
      },
      pointerdown: (event) => {
        markinsidePortal();
        markPressStartedinsidePortal(event);
      },
      mouseup: markinsidePortal,
      touchend: markinsidePortal,
      touchmove: markinsidePortal,
    }),
  };

  return {
    get floating() {
      return props.enabled ? floating : undefined;
    },
    get reference() {
      return props.enabled ? reference() : undefined;
    },
    get trigger() {
      return props.enabled ? reference() : undefined;
    },
  };
}
