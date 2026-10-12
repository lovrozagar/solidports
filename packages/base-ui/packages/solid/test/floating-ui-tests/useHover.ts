import { isElement } from '@floating-ui/utils/dom';
import { createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import { createDepsEffect, defaultProps, live } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { FloatingUIOpenChangeDetails } from '../../utils/types';
import { useTimeout } from '../../utils/useTimeout';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';
import { useFloatingParentNodeId, useFloatingTree } from '../components/FloatingTree';
import type { Delay, ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget, isInteractiveElement } from '../utils';
import type { HandleClose } from './useHoverShared';
import {
  getDelay,
  getRestMs,
  isClickLikeOpenEvent as isClickLikeOpenEventShared,
  isHoverOpenEvent,
} from './useHoverShared';

export type { HandleClose, HandleCloseContext } from './useHoverShared';

export interface UseHoverProps {
  /**
   * Accepts an event handler that runs on `mousemove` to control when the
   * floating element closes once the cursor leaves the reference element.
   * @default null
   */
  handleClose?: HandleClose | null | undefined;
  /**
   * Waits until the user's cursor is at “rest” over the reference element
   * before changing the `open` state.
   * @default 0
   */
  restMs?: number | (() => number) | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  delay?: Delay | (() => Delay) | undefined;
  /**
   * Whether moving the cursor over the floating element will open it, without a
   * regular hover event required.
   * @default true
   */
  move?: boolean | undefined;
}

/**
 * Opens the floating element while hovering over the reference element, like
 * CSS `:hover`.
 * @see https://floating-ui.com/docs/useHover
 */
export function useHover(parameters: {
  context: FloatingRootContext | FloatingContext;
  props?: UseHoverProps;
}): ElementProps {
  const props = defaultProps(parameters.props ?? {}, {
    delay: 0,
    handleClose: null,
    move: true,
    restMs: 0,
  });

  // Live: handlers and effect callbacks read the store imperatively, as React's refs.
  const store = live(() =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context,
  );

  const open = createMemo(() => store().select('open'));
  const floatingElement = createMemo(() => store().select('floatingElement'));
  const domReferenceElement = createMemo(() => store().select('domReferenceElement'));
  const dataRef = () => store().context.dataRef;

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  // React reads these through refs, so handlers see the latest prop values.
  const handleCloseRef = () => untrack(() => props.handleClose);
  const delayRef = () => untrack(() => props.delay);
  const restMsRef = () => untrack(() => props.restMs);

  let pointerTypeRef: string | undefined;
  let interactedInsideRef = false;
  let handlerRef: ((event: MouseEvent) => void) | undefined;
  let blockMouseMoveRef = true;
  let performedPointerEventsMutationRef = false;
  let unbindMouseMoveRef = () => {};
  let restTimeoutPendingRef = false;

  const timeout = useTimeout();
  const restTimeout = useTimeout();

  const isHoverOpen = () => isHoverOpenEvent(dataRef().openEvent?.type);

  const isClickLikeOpenEvent = () =>
    isClickLikeOpenEventShared(dataRef().openEvent?.type, interactedInsideRef);

  const cleanupMouseMoveHandler = () => {
    unbindMouseMoveRef();
    handlerRef = undefined;
  };

  const clearPointerEvents = () => {
    if (performedPointerEventsMutationRef) {
      const body = ownerDocument(untrack(floatingElement) ?? null).body;
      body.style.pointerEvents = '';
      performedPointerEventsMutationRef = false;
    }
  };

  // When closing before opening, clear the delay timeouts to cancel it
  // from showing.
  createEffect(
    () => store().context.events,
    (events) => {
      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          timeout.clear();
          restTimeout.clear();
          blockMouseMoveRef = true;
          restTimeoutPendingRef = false;
        }
      }

      events.on('openchange', onOpenChangeLocal);
      return () => {
        events.off('openchange', onOpenChangeLocal);
      };
    },
  );

  createDepsEffect(
    () => ({ open: open(), floatingElement: floatingElement() }),
    (deps) => {
      if (!handleCloseRef()) {
        return undefined;
      }

      if (!deps.open) {
        return undefined;
      }

      function onLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          return;
        }

        if (isHoverOpen()) {
          store().setOpen(
            false,
            createChangeEventDetails(
              REASONS.triggerHover,
              event,
              (event.currentTarget as HTMLElement) ?? undefined,
            ),
          );
        }
      }

      const html = ownerDocument(deps.floatingElement ?? null).documentElement;
      return addEventListener(html, 'mouseleave', onLeave);
    },
  );

  // Registering the mouse events on the reference directly to bypass Solid's
  // delegation system. If the cursor was on a disabled element and then entered
  // the reference (no gap), `mouseenter` doesn't fire in the delegation system.
  createDepsEffect(
    () => ({
      move: props.move,
      domReferenceElement: domReferenceElement(),
      floatingElement: floatingElement(),
      open: open(),
    }),
    (deps) => {
      function closeWithDelay(event: MouseEvent, runElseBranch = true) {
        const closeDelay = getDelay(delayRef(), 'close', pointerTypeRef);
        if (closeDelay && !handlerRef) {
          timeout.start(closeDelay, () =>
            store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event)),
          );
        } else if (runElseBranch) {
          timeout.clear();
          store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
        }
      }

      function handleInteractInside(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        if (!isInteractiveElement(target)) {
          interactedInsideRef = false;
          return;
        }

        interactedInsideRef = true;
      }

      function getHandleCloseHandler(event: MouseEvent, onClose: () => void) {
        const handleClose = handleCloseRef();
        const floatingContext = dataRef().floatingContext;
        if (!handleClose || !floatingContext) {
          return null;
        }

        // The floating context exposes getters, so it is merged rather than spread.
        return handleClose(
          solidMergeProps(floatingContext, {
            tree,
            x: () => event.clientX,
            y: () => event.clientY,
            onClose,
          }),
        );
      }

      function onReferenceMouseEnter(event: MouseEvent) {
        timeout.clear();
        blockMouseMoveRef = false;

        if (getRestMs(restMsRef()) > 0 && !getDelay(delayRef(), 'open')) {
          return;
        }

        const openDelay = getDelay(delayRef(), 'open', pointerTypeRef);
        const trigger = (event.currentTarget as HTMLElement) ?? undefined;

        const domReference = store().select('domReferenceElement');

        const isOverInactiveTrigger = domReference && trigger && !contains(domReference, trigger);

        if (openDelay) {
          timeout.start(openDelay, () => {
            if (!store().select('open')) {
              store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
            }
          });
        } else if (!deps.open || isOverInactiveTrigger) {
          store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      function onReferenceMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          clearPointerEvents();
          return;
        }

        unbindMouseMoveRef();

        const doc = ownerDocument(deps.floatingElement ?? null);
        restTimeout.clear();
        restTimeoutPendingRef = false;

        const triggers = store().context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          // If the mouse is leaving the reference element to another trigger, don't explicitly close the popup
          // as it will be moved.
          return;
        }

        const handler = getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event, true);
          }
        });

        if (handler) {
          // Prevent clearing `onScrollMouseLeave` timeout.
          if (!deps.open) {
            timeout.clear();
          }

          handlerRef = handler;
          unbindMouseMoveRef = addEventListener(doc, 'mousemove', handler);

          return;
        }

        // Allow interactivity without `safePolygon` on touch devices. With a
        // pointer, a short close delay is an alternative, so it should work
        // consistently.
        const shouldClose =
          pointerTypeRef === 'touch'
            ? !contains(deps.floatingElement, event.relatedTarget as Element | null)
            : true;
        if (shouldClose) {
          closeWithDelay(event);
        }
      }

      // Ensure the floating element closes after scrolling even if the pointer
      // did not move.
      // https://github.com/floating-ui/floating-ui/discussions/1692
      function onScrollMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent() || !dataRef().floatingContext || !store().select('open')) {
          return;
        }

        const triggers = store().context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          // If the mouse is leaving the reference element to another trigger, don't explicitly close the popup
          // as it will be moved.
          return;
        }

        getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event);
          }
        })?.(event);
      }

      function onFloatingMouseEnter() {
        timeout.clear();
        clearPointerEvents();
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (!isClickLikeOpenEvent()) {
          closeWithDelay(event, false);
        }
      }

      const trigger = deps.domReferenceElement as HTMLElement | null;

      if (isElement(trigger)) {
        const floating = deps.floatingElement;

        return mergeCleanups(
          deps.open && addEventListener(trigger, 'mouseleave', onScrollMouseLeave),
          deps.move &&
            addEventListener(trigger, 'mousemove', onReferenceMouseEnter, { once: true }),
          addEventListener(trigger, 'mouseenter', onReferenceMouseEnter),
          addEventListener(trigger, 'mouseleave', onReferenceMouseLeave),
          floating && addEventListener(floating, 'mouseleave', onScrollMouseLeave),
          floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
          floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
          floating && addEventListener(floating, 'pointerdown', handleInteractInside, true),
        );
      }

      return undefined;
    },
  );

  // Block pointer-events of every element other than the reference and floating
  // while the floating element is open and has a `handleClose` handler. Also
  // handles nested floating elements.
  // https://github.com/floating-ui/floating-ui/issues/1722
  createDepsEffect(
    () => ({
      open: open(),
      domReferenceElement: domReferenceElement(),
      floatingElement: floatingElement(),
    }),
    (deps) => {
      if (deps.open && handleCloseRef()?.__options?.blockPointerEvents && isHoverOpen()) {
        performedPointerEventsMutationRef = true;
        const floatingEl = deps.floatingElement;

        if (isElement(deps.domReferenceElement) && floatingEl) {
          const body = ownerDocument(floatingEl).body;

          const ref = deps.domReferenceElement as HTMLElement | SVGSVGElement;

          const parentFloating = tree?.nodesRef
            .find((node) => node.id === parentId)
            ?.context?.elements.floating();

          if (parentFloating) {
            parentFloating.style.pointerEvents = '';
          }

          body.style.pointerEvents = 'none';
          ref.style.pointerEvents = 'auto';
          floatingEl.style.pointerEvents = 'auto';

          return () => {
            body.style.pointerEvents = '';
            ref.style.pointerEvents = '';
            floatingEl.style.pointerEvents = '';
          };
        }
      }

      return undefined;
    },
  );

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      pointerTypeRef = undefined;
      restTimeoutPendingRef = false;
      interactedInsideRef = false;
      cleanupMouseMoveHandler();
      clearPointerEvents();
    }
  });

  createEffect(domReferenceElement, () => () => {
    cleanupMouseMoveHandler();
    timeout.clear();
    restTimeout.clear();
    interactedInsideRef = false;
  });

  onCleanup(clearPointerEvents);

  function setPointerRef(event: PointerEvent) {
    pointerTypeRef = event.pointerType;
  }

  const reference: ElementProps['reference'] = {
    onPointerDown: setPointerRef,
    onPointerEnter: setPointerRef,
    onMouseMove(event: MouseEvent) {
      const trigger = event.currentTarget as HTMLElement;

      // `true` when there are multiple triggers per floating element and user hovers over the one that
      // wasn't used to open the floating element.
      const isOverInactiveTrigger =
        store().select('domReferenceElement') &&
        !contains(store().select('domReferenceElement'), event.target as Element);

      function handleMouseMove() {
        if (!blockMouseMoveRef && (!store().select('open') || isOverInactiveTrigger)) {
          store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      if ((store().select('open') && !isOverInactiveTrigger) || getRestMs(restMsRef()) === 0) {
        return;
      }

      // Ignore insignificant movements to account for tremors.
      if (
        !isOverInactiveTrigger &&
        restTimeoutPendingRef &&
        event.movementX ** 2 + event.movementY ** 2 < 2
      ) {
        return;
      }

      restTimeout.clear();

      if (pointerTypeRef === 'touch') {
        handleMouseMove();
      } else if (isOverInactiveTrigger) {
        handleMouseMove();
      } else {
        restTimeoutPendingRef = true;
        restTimeout.start(getRestMs(restMsRef()), handleMouseMove);
      }
    },
  };

  return { reference };
}
