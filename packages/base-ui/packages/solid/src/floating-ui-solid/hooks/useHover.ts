import { isElement } from '@floating-ui/utils/dom';
import { createTrackedEffect, createEffect, createMemo, onCleanup, onSettled } from 'solid-js';
import { access, defaultProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { FloatingUIOpenChangeDetails } from '../../utils/types';
import { addEventListener } from '../../utils/addEventListener';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { useTimeout } from '../../utils/useTimeout';
import { useFloatingParentNodeId, useFloatingTree } from '../components/FloatingTree';
import type {
  Delay,
  ElementProps,
  FloatingContext,
  FloatingRootContext,
} from '../types';
import { contains, getTarget, isInteractiveElement } from '../utils';
import type { HandleClose } from './useHoverShared';
import { on, mergeProps as solidMergeProps } from '../../solid-1-compat';

export type { HandleClose, HandleCloseContext } from './useHoverShared';

export function getDelay(
  value: UseHoverProps['delay'],
  prop: 'open' | 'close',
  pointerType?: PointerEvent['pointerType'],
) {
  if (pointerType && !isMouseLikePointerType(pointerType)) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'function') {
    const result = value();
    if (typeof result === 'number') {
      return result;
    }
    return result?.[prop];
  }

  return value?.[prop];
}

function getRestMs(value: number | (() => number)) {
  if (typeof value === 'function') {
    return value();
  }
  return value;
}

function isMouseLikePointerType(pointerType: string | undefined, strict?: boolean) {
  /* On some devices, the pointer type is not determined. For the purpose of
   * this hook, treat it as mouse. */
  const values: string[] = ['mouse', 'pen'];
  if (!strict) {
    values.push('');
  }

  return values.includes(pointerType ?? '');
}

export interface UseHoverProps {
  /**
   * Accepts an event handler that runs on `mousemove` to control when the
   * floating element closes once the cursor leaves the reference element.
   * @default null
   */
  handleClose?: HandleClose | null | undefined;
  /**
   * Waits until the user's cursor is at "rest" over the reference element
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

  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const open = createMemo(() => store().select('open'));
  const floatingElement = createMemo(() => store().select('floatingElement'));
  const domReferenceElement = createMemo(() => store().select('domReferenceElement'));
  const dataRef = () => store().context.dataRef;
  const events = () => store().context.events;

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  let pointerTypeRef: string | undefined;
  let interactedInsideRef = false;
  const timeout = useTimeout();
  const restTimeout = useTimeout();
  let blockMouseMoveRef = true;
  let performedPointerEventsMutationRef = false;
  let restTimeoutPendingRef = false;
  let unbindMouseMoveRef = () => {};

  const isHoverOpen = () => {
    const type = dataRef().openEvent?.type;
    return type?.includes('mouse') && type !== 'mousedown';
  };

  const isClickLikeOpenEvent = () => {
    if (interactedInsideRef) {
      return true;
    }

    const openEvent = dataRef().openEvent;
    return openEvent ? ['click', 'mousedown'].includes(openEvent.type) : false;
  };

  function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
    if (!details.open) {
      timeout.clear();
      restTimeout.clear();
      blockMouseMoveRef = true;
      restTimeoutPendingRef = false;
    }
  }

  /* When closing before opening, clear the delay timeouts to cancel it from showing. */
  onSettled(() => {
    const _c: Array<() => void> = [];
    (() => {

    events().on('openchange', onOpenChangeLocal);
    _c.push(() => {
      events().off('openchange', onOpenChangeLocal);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

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

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!props.handleClose) {
      return;
    }
    if (!open()) {
      return;
    }

    const floating = floatingElement() ?? null;
    const html = ownerDocument(floating).documentElement;
    _c.push(addEventListener(html, 'mouseleave', onLeave));
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const closeWithDelay = (event: MouseEvent, runElseBranch = true) => {
    const closeDelay = getDelay(props.delay, 'close', pointerTypeRef);
    const fn = () => store().setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
    if (closeDelay) {
      timeout.start(closeDelay, fn);
    } else if (runElseBranch) {
      timeout.clear();
      fn();
    }
  };

  const cleanupMouseMoveHandler = () => {
    unbindMouseMoveRef();
  };

  const clearPointerEvents = () => {
    if (performedPointerEventsMutationRef) {
      const floating = floatingElement() ?? null;
      const body = ownerDocument(floating).body;
      body.style.pointerEvents = '';
      performedPointerEventsMutationRef = false;
    }
  };

  const handleInteractInside = (event: PointerEvent) => {
    const target = getTarget(event) as Element | null;
    if (!isInteractiveElement(target)) {
      interactedInsideRef = false;
      return;
    }

    interactedInsideRef = true;
  };

  function onReferenceMouseEnter(event: MouseEvent) {
    timeout.clear();
    blockMouseMoveRef = false;

    if (getRestMs(props.restMs) > 0 && !getDelay(props.delay, 'open')) {
      return;
    }

    const openDelay = getDelay(props.delay, 'open', pointerTypeRef);
    const trigger = (event.currentTarget as HTMLElement) ?? undefined;

    const domReference = store().select('domReferenceElement');

    const isOverInactiveTrigger = domReference && trigger && !contains(domReference, trigger);

    const fn = () => {
      if (!store().select('open')) {
        store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
      }
    };
    if (openDelay) {
      timeout.start(openDelay, fn);
    } else if (!open() || isOverInactiveTrigger) {
      store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
    }
  }

  function onReferenceMouseLeave(event: MouseEvent) {
    if (isClickLikeOpenEvent()) {
      clearPointerEvents();
      return;
    }

    unbindMouseMoveRef();

    const floating = floatingElement() ?? null;
    const doc = ownerDocument(floating);
    restTimeout.clear();
    restTimeoutPendingRef = false;

    const triggers = store().context.triggerElements;

    if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
      /* Moving to another trigger — don't close, the trigger's open handler will take over. */
      return;
    }

    const ctx = dataRef().floatingContext;
    if (props.handleClose && ctx) {
      /* Prevent clearing `onScrollMouseLeave` timeout. */
      if (!open()) {
        timeout.clear();
      }

      const mergedProps = solidMergeProps(ctx, {
        onClose() {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event, true);
          }
        },
        tree,
        x: () => event.clientX,
        y: () => event.clientY,
      });

      const handler = props.handleClose(mergedProps);

      unbindMouseMoveRef = addEventListener(doc, 'mousemove', handler);

      return;
    }

    /* Allow interactivity without `safePolygon` on touch devices. */
    const shouldClose =
      pointerTypeRef === 'touch'
        ? !contains(floatingElement(), event.relatedTarget as Element | null)
        : true;
    if (shouldClose) {
      closeWithDelay(event);
    }
  }

  /* Ensure the floating element closes after scrolling even if the pointer did not move.
   * https://github.com/floating-ui/floating-ui/discussions/1692 */
  function onScrollMouseLeave(event: MouseEvent) {
    const ctx = dataRef().floatingContext;
    if (isClickLikeOpenEvent() || !ctx || !store().select('open')) {
      return;
    }

    const triggers = store().context.triggerElements;

    if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
      return;
    }

    const mergedProps = solidMergeProps(ctx, {
      onClose() {
        clearPointerEvents();
        cleanupMouseMoveHandler();
        if (!isClickLikeOpenEvent()) {
          closeWithDelay(event);
        }
      },
      tree,
      x: () => event.clientX,
      y: () => event.clientY,
    });
    props.handleClose?.(mergedProps)(event);
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

  /* Registering the mouse events on the reference directly to bypass Solid's delegation system.
   * If the cursor was on a disabled element and then entered the reference (no gap),
   * `mouseenter` doesn't fire in the delegation system. */
  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const trigger = domReferenceElement() as HTMLElement | null;
    if (isElement(trigger)) {
      const floating = floatingElement();

      _c.push(
        mergeCleanups(
          open() && addEventListener(trigger, 'mouseleave', onScrollMouseLeave),
          props.move && addEventListener(trigger, 'mousemove', onReferenceMouseEnter, { once: true }),
          addEventListener(trigger, 'mouseenter', onReferenceMouseEnter),
          addEventListener(trigger, 'mouseleave', onReferenceMouseLeave),
          floating && addEventListener(floating, 'mouseleave', onScrollMouseLeave),
          floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
          floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
          floating && addEventListener(floating, 'pointerdown', handleInteractInside, true),
        ),
      );
    }
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  /* Block pointer-events of every element other than the reference and floating
   * while the floating element is open and has a `handleClose` handler.
   * https://github.com/floating-ui/floating-ui/issues/1722 */
  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (open() && props.handleClose?.__options?.blockPointerEvents && isHoverOpen()) {
      performedPointerEventsMutationRef = true;
      const floatingEl = floatingElement() ?? null;

      const domEl = domReferenceElement();
      if (isElement(domEl) && floatingEl) {
        const body = ownerDocument(floatingEl).body;

        const ref = domEl as HTMLElement | SVGSVGElement;

        const parentNode = tree?.nodesRef.find((node) => node.id === parentId);
        const parentFloating = parentNode
          ? access(parentNode.context)?.elements.floating()
          : undefined;

        if (parentFloating) {
          parentFloating.style.pointerEvents = '';
        }

        body.style.pointerEvents = 'none';
        ref.style.pointerEvents = 'auto';
        floatingEl.style.pointerEvents = 'auto';

        _c.push(() => {
          body.style.pointerEvents = '';
          ref.style.pointerEvents = '';
          floatingEl.style.pointerEvents = '';
        });
      }
    }
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    if (!open()) {
      pointerTypeRef = undefined;
      restTimeoutPendingRef = false;
      interactedInsideRef = false;
      cleanupMouseMoveHandler();
      clearPointerEvents();
    }
  });

  function cleanup() {
    cleanupMouseMoveHandler();
    timeout.clear();
    restTimeout.clear();
    clearPointerEvents();
    interactedInsideRef = false;
  }

  createEffect(...on(domReferenceElement, () => cleanup));

  onCleanup(() => {
    clearPointerEvents();
  });

  function setPointerRef(event: PointerEvent) {
    pointerTypeRef = event.pointerType;
  }

  const reference: ElementProps['reference'] = {
    onMouseMove(event) {
      const trigger = event.currentTarget as HTMLElement;

      /* `true` when there are multiple triggers per floating element and user hovers over the one
       * that wasn't used to open the floating element. */
      const isOverInactiveTrigger =
        store().select('domReferenceElement') &&
        !contains(store().select('domReferenceElement'), event.target as Element);

      function handleMouseMove() {
        if (!blockMouseMoveRef && (!store().select('open') || isOverInactiveTrigger)) {
          store().setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      if ((store().select('open') && !isOverInactiveTrigger) || getRestMs(props.restMs) === 0) {
        return;
      }

      /* Ignore insignificant movements to account for tremors. */
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
        restTimeout.start(getRestMs(props.restMs), handleMouseMove);
      }
    },
    onPointerDown: setPointerRef,
    onPointerEnter: setPointerRef,
    ref: () => {
      onCleanup(cleanup);
    },
  };
  return {
    get reference() {
      return reference;
    },
  };
}
