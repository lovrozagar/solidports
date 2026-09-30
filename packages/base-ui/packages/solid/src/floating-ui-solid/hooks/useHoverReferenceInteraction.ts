import { isElement } from '@floating-ui/utils/dom';
import { createEffect, onCleanup, mergeProps as solidMergeProps } from 'solid-js';
import { defaultProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { addEventListener } from '../../utils/addEventListener';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { FloatingUIOpenChangeDetails, HTMLProps } from '../../utils/types';
import { useFloatingTree } from '../components/FloatingTree';
import type { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { Delay, FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget, isTargetInsideEnabledTrigger } from '../utils';
import { isMouseLikePointerType } from '../utils/event';
import {
  clearSafePolygonPointerEventsMutation,
  useHoverInteractionSharedState,
} from './useHoverInteractionSharedState';
import { type HandleClose } from './useHover';
import { getDelay, getRestMs } from './useHoverShared';

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
  triggerElementRef?: Readonly<Element | null | undefined>;
  getHandleCloseContext?: (() => { elements: { domReference: () => Element | null | undefined; floating: () => HTMLElement | null | undefined }; } | null) | undefined;
  isClosing?: (() => boolean) | undefined;
}

const EMPTY_REF: Readonly<Element | null | undefined> = null;

function getMouseEventPointerType(pointerType: string | undefined) {
  return pointerType ?? 'mouse';
}

/**
 * Provides hover interactions that should be attached to reference or trigger
 * elements.
 */
export function useHoverReferenceInteraction(parameters: {
  context: FloatingRootContext | FloatingContext;
  props: UseHoverReferenceInteractionProps;
}): HTMLProps | undefined {
  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const props = defaultProps(parameters.props, {
    delay: 0,
    enabled: true,
    handleClose: null,
    isActiveTrigger: true,
    mouseOnly: false,
    move: true,
    restMs: 0,
    triggerElementRef: EMPTY_REF,
  });

  const tree = useFloatingTree(parameters.props.externalTree);

  const hoverState = useHoverInteractionSharedState({
    get store() {
      return store();
    },
  });
  const [instance, setInstanceState] = hoverState;

  /* Track whether the last close was driven by hover — used to detect re-entry during close transition. */
  let isHoverCloseActiveRef = false;

  createEffect(() => {
    if (props.isActiveTrigger) {
      setInstanceState('handleCloseOptions', props.handleClose?.__options);
    }
  });

  const isClickLikeOpenEvent = () => {
    if (instance.interactedInside) {
      return true;
    }

    const openEvent = store().context.dataRef.openEvent;
    return openEvent ? ['click', 'mousedown'].includes(openEvent.type) : false;
  };

  const isRelatedTargetInsideEnabledTrigger = (target: EventTarget | null | undefined) => {
    return isTargetInsideEnabledTrigger(target, store().context.triggerElements);
  };

  const isOverInactiveTrigger = (
    currentDomReference: Element | null,
    currentTarget: Element,
    target: EventTarget | null,
  ): boolean => {
    const allTriggers = store().context.triggerElements;

    /* Fast path: handlers attached directly to triggers. */
    if (allTriggers.hasElement(currentTarget)) {
      return !currentDomReference || !contains(currentDomReference, currentTarget);
    }

    /* Fallback for delegated/wrapper usage. */
    if (!isElement(target)) {
      return false;
    }

    const targetElement = target as Element;
    return (
      allTriggers.hasMatchingElement((trigger) => contains(trigger, targetElement)) &&
      (!currentDomReference || !contains(currentDomReference, targetElement))
    );
  };

  const closeWithDelay = (event: MouseEvent, runElseBranch = true) => {
    const closeDelay = getDelay(props.delay, 'close', instance.pointerType);
    if (closeDelay) {
      instance.openChangeTimeout.start(closeDelay, () => {
        store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
        tree?.events.emit('floating.closed', event);
      });
    } else if (runElseBranch) {
      instance.openChangeTimeout.clear();
      store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      tree?.events.emit('floating.closed', event);
    }
  };

  const cleanupMouseMoveHandler = () => {
    if (!instance.handler) {
      return;
    }
    const doc = ownerDocument(store().select('domReferenceElement') ?? null);
    doc.removeEventListener('mousemove', instance.handler);
    setInstanceState('handler', undefined);
  };

  const clearPointerEvents = () => {
    clearSafePolygonPointerEventsMutation(hoverState);
  };

  onCleanup(cleanupMouseMoveHandler);

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

  /* When closing before opening, clear delay timeouts to cancel from showing. */
  createEffect(() => {
    if (!props.enabled) {
      return;
    }

    store().context.events.on('openchange', onOpenChangeLocal);
    onCleanup(() => store().context.events.off('openchange', onOpenChangeLocal));
  });

  createEffect(() => {
    if (!props.enabled) {
      return;
    }

    const trigger =
      (props.triggerElementRef as HTMLElement | null) ??
      (props.isActiveTrigger
        ? (store().select('domReferenceElement') as HTMLElement | null)
        : null);

    if (!isElement(trigger)) {
      return;
    }

    function onMouseEnter(event: MouseEvent) {
      instance.openChangeTimeout.clear();
      setInstanceState('blockMouseMove', false);

      const pointerType = getMouseEventPointerType(instance.pointerType);

      if (props.mouseOnly && !isMouseLikePointerType(pointerType)) {
        return;
      }

      /* Only rest delay is set; there's no fallback delay. This will be handled by `onMouseMove`. */
      const restMsValue = getRestMs(props.restMs);
      const openDelay = getDelay(props.delay, 'open', instance.pointerType);
      if (restMsValue > 0 && !openDelay) {
        return;
      }

      const eventTarget = getTarget(event);
      const currentTarget = (event.currentTarget as HTMLElement) ?? null;
      const currentDomReference = store().select('domReferenceElement');
      let triggerNode = currentTarget;

      /* Wrapper/delegated mode: resolve actual trigger from event target. */
      if (isElement(eventTarget) && !store().context.triggerElements.hasElement(eventTarget as Element)) {
        for (const triggerElement of store().context.triggerElements.elements()) {
          if (contains(triggerElement, eventTarget as Element)) {
            triggerNode = triggerElement as HTMLElement;
            break;
          }
        }
      }

      /* Wrapper/delegated mode fallback: wrapper contains active trigger → treat as re-entering it. */
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
          : isOverInactiveTrigger(currentDomReference ?? null, triggerNode, eventTarget);
      const isOpen = store().select('open');
      const isInClosingTransition = props.isClosing?.() ?? false;
      const isHoverCloseTransition = !isOpen && isInClosingTransition && isHoverCloseActiveRef;
      const isReenteringSameTriggerDuringCloseTransition =
        !isOverInactive &&
        isElement(triggerNode) &&
        isElement(currentDomReference) &&
        contains(currentDomReference, triggerNode) &&
        isHoverCloseTransition;
      const shouldOpenImmediately =
        (isOverInactive && (isOpen || isHoverCloseTransition)) ||
        isReenteringSameTriggerDuringCloseTransition;

      const shouldOpen = !isOpen || isOverInactive;

      /* Open immediately when moving between triggers while open, or during a hover close transition. */
      if (shouldOpenImmediately) {
        store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode));
        return;
      }

      if (openDelay) {
        instance.openChangeTimeout.start(openDelay, () => {
          if (shouldOpen) {
            store().setOpen(
              true,
              createChangeEventDetails(REASONS.triggerHover, event, triggerNode),
            );
          }
        });
      } else if (shouldOpen) {
        store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode));
      }
    }

    function onMouseLeave(event: MouseEvent) {
      if (isClickLikeOpenEvent()) {
        clearPointerEvents();
        return;
      }

      cleanupMouseMoveHandler();

      const domReferenceElement = store().select('domReferenceElement') ?? null;
      const doc = ownerDocument(domReferenceElement);
      instance.restTimeout.clear();
      setInstanceState('restTimeoutPending', false);

      if (isRelatedTargetInsideEnabledTrigger(event.relatedTarget)) {
        return;
      }

      const floatingContext = store().context.dataRef.floatingContext;
      if (props.handleClose && floatingContext) {
        if (!store().select('open')) {
          instance.openChangeTimeout.clear();
        }

        if (!floatingContext.elements.domReference() || !floatingContext.elements.floating()) {
          closeWithDelay(event);
          return;
        }

        const currentTrigger = props.triggerElementRef;

        const handlerProps = solidMergeProps(store().context.dataRef.floatingContext, {
          onClose() {
            clearPointerEvents();
            cleanupMouseMoveHandler();
            if (
              props.enabled &&
              !isClickLikeOpenEvent() &&
              currentTrigger === store().select('domReferenceElement')
            ) {
              closeWithDelay(event, true);
            }
          },
          tree,
          x: () => event.clientX,
          y: () => event.clientY,
        });

        const handlerValue = props.handleClose(handlerProps);
        setInstanceState('handler', () => handlerValue);

        handlerValue(event);

        doc.addEventListener('mousemove', handlerValue);

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

    onCleanup(
      mergeCleanups(
        store().select('open') && addEventListener(trigger, 'mouseleave', onScrollMouseLeave),
        props.move && addEventListener(trigger, 'mousemove', onMouseEnter, { once: true }),
        addEventListener(trigger, 'mouseenter', onMouseEnter),
        addEventListener(trigger, 'mouseleave', onMouseLeave),
      ),
    );
  });

  function setPointerRef(event: PointerEvent) {
    setInstanceState('pointerType', event.pointerType);
  }

  function onScrollMouseLeave(event: MouseEvent) {
    if (isClickLikeOpenEvent()) {
      return;
    }

    if (!store().context.dataRef.floatingContext) {
      return;
    }

    if (isRelatedTargetInsideEnabledTrigger(event.relatedTarget)) {
      return;
    }

    const currentTrigger = props.triggerElementRef;
    const floatingContext = store().context.dataRef.floatingContext;
    const hasInteractiveElements =
      floatingContext?.elements.domReference() && floatingContext.elements.floating();

    if (!hasInteractiveElements) {
      closeWithDelay(event);
      return;
    }

    const localMergedProps = solidMergeProps(store().context.dataRef.floatingContext, {
      onClose() {
        clearPointerEvents();
        cleanupMouseMoveHandler();
        if (!isClickLikeOpenEvent() && currentTrigger === store().select('domReferenceElement')) {
          closeWithDelay(event);
        }
      },
      tree,
      x: () => event.clientX,
      y: () => event.clientY,
    });

    props.handleClose?.(localMergedProps)?.(event);
  }

  function onMouseMove(event: MouseEvent) {
    const trigger = event.currentTarget as HTMLElement;
    const pointerType = getMouseEventPointerType(instance.pointerType);

    const currentDomReference = store().select('domReferenceElement');
    const currentOpen = store().select('open');
    const isOverInactive = isOverInactiveTrigger(currentDomReference ?? null, trigger, event.target);

    if (props.mouseOnly && !isMouseLikePointerType(pointerType)) {
      return;
    }

    const restMsValue = getRestMs(props.restMs);
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

      /* A delayed hover open should not override a click-like open that happened while hover delay was pending. */
      if (isClickLikeOpenEvent()) {
        return;
      }

      const latestOpen = store().select('open');

      if (!instance.blockMouseMove && (!latestOpen || isOverInactive)) {
        store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
      }
    }

    if (instance.pointerType === 'touch') {
      handleMouseMove();
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
