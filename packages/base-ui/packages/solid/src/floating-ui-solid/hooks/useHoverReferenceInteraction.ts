import { isElement } from '@floating-ui/utils/dom';
import { createEffect, onCleanup, untrack } from 'solid-js';
import { defaultProps, live } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { flushSync } from '../../utils/flushSync';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../utils/types';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';
import { useFloatingTreeAccessor } from '../components/FloatingTree';
import type { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { Delay, FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget, isTargetInsideEnabledTrigger } from '../utils';
import { isMouseLikePointerType } from '../utils/event';
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  useHoverInteractionSharedState,
} from './useHoverInteractionSharedState';
import type { HandleClose, HandleCloseContextBase } from './useHoverShared';
import {
  getDelay,
  getRestMs,
  isClickLikeOpenEvent as isClickLikeOpenEventShared,
} from './useHoverShared';

export interface UseHoverReferenceInteractionProps {
  enabled?: boolean | undefined;
  handleClose?: HandleClose | null | undefined;
  restMs?: number | (() => number) | undefined;
  delay?: Delay | (() => Delay) | undefined;
  move?: boolean | undefined;
  mouseOnly?: boolean | undefined;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Whether the hook controls the active trigger. When false, the props are
   * returned under the `trigger` key so they can be applied to inactive
   * triggers via `getTriggerProps`.
   * @default true
   */
  isActiveTrigger?: boolean | undefined;
  /**
   * The trigger element. Solid passes the element itself (read through a getter), not a ref object.
   */
  triggerElementRef?: Element | null | undefined;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  isClosing?: (() => boolean) | undefined;
  /**
   * Called before each hover-driven open attempt (immediate, delayed, and rest-ms
   * paths). Return `false` to veto; any other return value permits the open.
   */
  shouldOpen?: (() => boolean) | undefined;
  /**
   * Regression workaround (#5152): also cancels a pending hover-open from the
   * trigger's `mouseout`, backing up a `mouseleave` that Chrome can drop during
   * a fast pointer sweep and leave a submenu stuck open.
   *
   * WARNING: only enable on single-trigger, hover-driven roots (e.g.
   * `Menu.SubmenuTrigger`). It skips the `isClickLikeOpenEvent()` and
   * `isInsideEnabledTrigger()` checks `mouseleave` applies, so on a
   * multi-trigger or click-driven root it cancels legitimate opens/closes.
   * @default false
   */
  guardStaleOpen?: boolean | undefined;
}

/**
 * Provides hover interactions that should be attached to reference or trigger
 * elements.
 */
export function useHoverReferenceInteraction(parameters: {
  context: FloatingRootContext | FloatingContext;
  props: UseHoverReferenceInteractionProps;
}): HTMLProps | undefined {
  const props = defaultProps(parameters.props, {
    delay: 0,
    enabled: true,
    guardStaleOpen: false,
    handleClose: null,
    isActiveTrigger: true,
    mouseOnly: false,
    move: true,
    restMs: 0,
  });

  // Live: handlers and effect callbacks read the store imperatively, as React's refs.
  const store = live(() =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context,
  );
  const dataRef = () => store().context.dataRef;

  const getTree = useFloatingTreeAccessor(() => parameters.props.externalTree);

  const hoverState = useHoverInteractionSharedState({
    get store() {
      return store();
    },
  });
  const [instance, setInstanceState] = hoverState;
  let isHoverCloseActiveRef = false;

  // React reads these through refs, so handlers see the latest prop values.
  const handleCloseRef = () => untrack(() => props.handleClose);
  const delayRef = () => untrack(() => props.delay);
  const restMsRef = () => untrack(() => props.restMs);
  const enabledRef = () => untrack(() => props.enabled);

  const isClickLikeOpenEvent = () =>
    isClickLikeOpenEventShared(dataRef().openEvent?.type, instance.interactedInside);

  const checkShouldOpen = () => untrack(() => props.shouldOpen)?.() !== false;

  const isOverInactiveTrigger = (
    currentDomReference: Element | null | undefined,
    currentTarget: Element,
    target: EventTarget | null,
  ): boolean => {
    const allTriggers = store().context.triggerElements;

    // Fast path for normal usage where handlers are attached directly to triggers.
    if (allTriggers.hasElement(currentTarget)) {
      return !currentDomReference || !contains(currentDomReference, currentTarget);
    }

    // Fallback for delegated/wrapper usage where currentTarget may be outside the trigger map.
    if (!isElement(target)) {
      return false;
    }

    const targetElement = target as Element;
    return (
      allTriggers.hasMatchingElement((trigger: Element) => contains(trigger, targetElement)) &&
      (!currentDomReference || !contains(currentDomReference, targetElement))
    );
  };

  const cleanupMouseMoveHandler = () => {
    const handler = instance.handler;
    if (!handler) {
      return;
    }

    const doc = ownerDocument(store().select('domReferenceElement') ?? null);
    doc.removeEventListener('mousemove', handler);
    setInstanceState('handler', undefined);
  };

  const clearPointerEvents = () => {
    clearSafePolygonPointerEventsMutation(hoverState);
  };

  createEffect(
    () => (props.isActiveTrigger ? { options: props.handleClose?.__options } : null),
    (active) => {
      if (active) {
        setInstanceState('handleCloseOptions', active.options);
      }
    },
  );

  onCleanup(cleanupMouseMoveHandler);

  // When closing before opening, clear the delay timeouts to cancel it
  // from showing.
  createEffect(
    () => (props.enabled ? store().context.events : null),
    (events) => {
      if (!events) {
        return undefined;
      }

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          isHoverCloseActiveRef = details.reason === REASONS.triggerHover;
          cleanupMouseMoveHandler();
          instance.openChangeTimeout.clear();
          instance.restTimeout.clear();
          setInstanceState('blockMouseMove', true);
          setInstanceState('restTimeoutPending', false);
        } else {
          isHoverCloseActiveRef = false;
        }
      }

      events.on('openchange', onOpenChangeLocal);
      return () => {
        events.off('openchange', onOpenChangeLocal);
      };
    },
  );

  createEffect(
    () => {
      if (!props.enabled) {
        return null;
      }
      const trigger =
        (props.triggerElementRef as HTMLElement | null | undefined) ??
        (props.isActiveTrigger
          ? (store().select('domReferenceElement') as HTMLElement | null)
          : null);
      return isElement(trigger)
        ? { trigger, move: props.move, guardStaleOpen: props.guardStaleOpen }
        : null;
    },
    (target) => {
      if (!target) {
        return undefined;
      }
      const { trigger } = target;

      function closeWithDelay(event: MouseEvent, runElseBranch = true) {
        const closeDelay = getDelay(delayRef(), 'close', instance.pointerType);
        if (closeDelay) {
          instance.openChangeTimeout.start(closeDelay, () => {
            store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
            getTree()?.events.emit('floating.closed', event);
          });
        } else if (runElseBranch) {
          instance.openChangeTimeout.clear();
          store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          getTree()?.events.emit('floating.closed', event);
        }
      }

      function onMouseEnter(event: MouseEvent) {
        instance.openChangeTimeout.clear();
        setInstanceState('blockMouseMove', false);

        if (props.mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
          return;
        }

        // Only rest delay is set; there's no fallback delay.
        // This will be handled by `onMouseMove`.
        const restMsValue = getRestMs(restMsRef());
        const openDelay = getDelay(delayRef(), 'open', instance.pointerType);
        const eventTarget = getTarget(event);
        const currentTarget = (event.currentTarget as HTMLElement) ?? null;
        const currentDomReference = store().select('domReferenceElement');
        let triggerNode = currentTarget;

        // Wrapper/delegated mode: resolve the actual trigger from the event target.
        if (
          isElement(eventTarget) &&
          !store().context.triggerElements.hasElement(eventTarget as Element)
        ) {
          for (const triggerElement of store().context.triggerElements.elements()) {
            if (contains(triggerElement, eventTarget as Element)) {
              triggerNode = triggerElement as HTMLElement;
              break;
            }
          }
        }

        // Wrapper/delegated mode fallback: if the wrapper contains the active trigger,
        // treat this as re-entering that active trigger.
        if (
          isElement(currentTarget) &&
          isElement(currentDomReference) &&
          !store().context.triggerElements.hasElement(currentTarget) &&
          contains(currentTarget, currentDomReference)
        ) {
          triggerNode = currentDomReference as HTMLElement;
        }

        const isOverInactive =
          triggerNode == null
            ? false
            : isOverInactiveTrigger(currentDomReference, triggerNode, eventTarget);
        const isOpen = store().select('open');
        const isInClosingTransition =
          untrack(() => props.isClosing)?.() ?? store().select('transitionStatus') === 'ending';
        const isHoverCloseTransition = !isOpen && isInClosingTransition && isHoverCloseActiveRef;
        const isReenteringSameTriggerDuringCloseTransition =
          !isOverInactive &&
          isElement(triggerNode) &&
          isElement(currentDomReference) &&
          contains(currentDomReference, triggerNode) &&
          isHoverCloseTransition;
        const isRestOnlyDelay = restMsValue > 0 && !openDelay;
        const shouldOpenImmediately =
          (isOverInactive && (isOpen || isHoverCloseTransition)) ||
          isReenteringSameTriggerDuringCloseTransition;

        const shouldOpen = !isOpen || isOverInactive;

        // Open immediately when moving between triggers while open, or during
        // a hover-driven close transition (including same-trigger re-entry).
        if (shouldOpenImmediately) {
          if (checkShouldOpen()) {
            store().setOpen(
              true,
              createChangeEventDetails(REASONS.triggerHover, event, triggerNode),
            );
          }
          return;
        }

        if (isRestOnlyDelay) {
          return;
        }

        if (openDelay) {
          instance.openChangeTimeout.start(openDelay, () => {
            if (shouldOpen && checkShouldOpen()) {
              store().setOpen(
                true,
                createChangeEventDetails(REASONS.triggerHover, event, triggerNode),
              );
            }
          });
        } else if (shouldOpen) {
          if (checkShouldOpen()) {
            store().setOpen(
              true,
              createChangeEventDetails(REASONS.triggerHover, event, triggerNode),
            );
          }
        }
      }

      function onMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          clearPointerEvents();
          return;
        }

        cleanupMouseMoveHandler();

        const domReferenceElement = store().select('domReferenceElement');
        const doc = ownerDocument(domReferenceElement ?? null);
        instance.restTimeout.clear();
        setInstanceState('restTimeoutPending', false);

        const handleCloseContextBase =
          dataRef().floatingContext ?? untrack(() => props.getHandleCloseContext)?.();

        if (isTargetInsideEnabledTrigger(event.relatedTarget, store().context.triggerElements)) {
          return;
        }

        const handleClose = handleCloseRef();
        if (handleClose && handleCloseContextBase) {
          if (!store().select('open')) {
            instance.openChangeTimeout.clear();
          }

          const currentTrigger = untrack(() => props.triggerElementRef);

          // The handle-close context exposes getters, so it is merged rather than spread.
          const handler = handleClose(
            solidMergeProps(handleCloseContextBase, {
              tree: getTree(),
              x: () => event.clientX,
              y: () => event.clientY,
              onClose() {
                clearPointerEvents();
                cleanupMouseMoveHandler();
                if (
                  enabledRef() &&
                  !isClickLikeOpenEvent() &&
                  currentTrigger === store().select('domReferenceElement')
                ) {
                  closeWithDelay(event, true);
                }
              },
            }) as Parameters<HandleClose>[0],
          );
          setInstanceState('handler', () => handler);

          doc.addEventListener('mousemove', handler);
          handler(event);

          return;
        }

        const shouldClose =
          instance.pointerType === 'touch'
            ? !contains(store().select('floatingElement'), event.relatedTarget as Element | null)
            : true;

        if (shouldClose) {
          closeWithDelay(event);
        }
      }

      // Backup cancellation for Chrome's dropped `mouseleave` — see `guardStaleOpen`.
      function onMouseOut(event: MouseEvent) {
        if (contains(trigger, event.relatedTarget as Element | null)) {
          return; // moved within the trigger's own subtree
        }
        instance.openChangeTimeout.clear();
        instance.restTimeout.clear();
        setInstanceState('restTimeoutPending', false);
      }

      const staleOpenGuard = target.guardStaleOpen
        ? addEventListener(trigger, 'mouseout', onMouseOut)
        : undefined;

      return mergeCleanups(
        target.move && addEventListener(trigger, 'mousemove', onMouseEnter, { once: true }),
        addEventListener(trigger, 'mouseenter', onMouseEnter),
        addEventListener(trigger, 'mouseleave', onMouseLeave),
        staleOpenGuard,
      );
    },
  );

  function setPointerRef(event: PointerEvent) {
    setInstanceState('pointerType', event.pointerType);
  }

  function onMouseMove(event: MouseEvent) {
    const trigger = event.currentTarget as HTMLElement;

    const currentDomReference = store().select('domReferenceElement');
    const currentOpen = store().select('open');
    const isOverInactive = isOverInactiveTrigger(currentDomReference, trigger, event.target);

    if (props.mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
      return;
    }

    if (currentOpen && isOverInactive && instance.handleCloseOptions?.blockPointerEvents) {
      const floatingElement = store().select('floatingElement');

      if (floatingElement) {
        const scopeElement =
          instance.handleCloseOptions?.getScope?.() ?? trigger.ownerDocument.body;

        applySafePolygonPointerEventsMutation(hoverState, {
          scopeElement,
          referenceElement: trigger,
          floatingElement,
        });
      }
    }

    const restMsValue = getRestMs(restMsRef());
    if ((currentOpen && !isOverInactive) || restMsValue === 0) {
      return;
    }

    if (
      !isOverInactive &&
      instance.restTimeoutPending &&
      event.movementX ** 2 + event.movementY ** 2 < 2
    ) {
      return;
    }

    instance.restTimeout.clear();

    function handleMouseMove() {
      setInstanceState('restTimeoutPending', false);

      // A delayed hover open should not override a click-like open that happened
      // while the hover delay was pending.
      if (isClickLikeOpenEvent()) {
        return;
      }

      const latestOpen = store().select('open');

      if (!instance.blockMouseMove && (!latestOpen || isOverInactive) && checkShouldOpen()) {
        store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
      }
    }

    if (instance.pointerType === 'touch') {
      flushSync(() => {
        handleMouseMove();
      });
    } else if (isOverInactive && currentOpen) {
      handleMouseMove();
    } else {
      setInstanceState('restTimeoutPending', true);
      instance.restTimeout.start(restMsValue, handleMouseMove);
    }
  }

  return {
    get onMouseMove() {
      return props.enabled ? onMouseMove : undefined;
    },
    get onPointerDown() {
      return props.enabled ? setPointerRef : undefined;
    },
    get onPointerEnter() {
      return props.enabled ? setPointerRef : undefined;
    },
  };
}
