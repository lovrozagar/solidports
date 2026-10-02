/* eslint-disable typescript/no-explicit-any -- empty virtual reference placeholder cast */
import { getWindow } from '@floating-ui/utils/dom';
import { createTrackedEffect, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { defaultProps } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import type { ContextData, ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget, isMouseLikePointerType } from '../utils';
import { on } from '../../solid-1-compat';

function createVirtualElement(
  domElement: Element | null | undefined,
  data: {
    axis: 'x' | 'y' | 'both';
    dataRef: ContextData;
    pointerType: string | undefined;
    x: number | null;
    y: number | null;
  },
) {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: domElement || undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() || {
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      };

      const isXAxis = data.axis === 'x' || data.axis === 'both';
      const isYAxis = data.axis === 'y' || data.axis === 'both';
      const canTrackCursorOnAutoUpdate =
        ['mouseenter', 'mousemove'].includes(data.dataRef.openEvent?.type || '') &&
        data.pointerType !== 'touch';

      let width = domRect.width;
      let height = domRect.height;
      let x = domRect.x;
      let y = domRect.y;

      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }

      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;
      width = 0;
      height = 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        width = data.axis === 'y' ? domRect.width : 0;
        height = data.axis === 'x' ? domRect.height : 0;
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      } else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
        height = data.axis === 'x' ? domRect.height : height;
        width = data.axis === 'y' ? domRect.width : width;
      }

      isAutoUpdateEvent = true;

      return {
        bottom: y + height,
        height,
        left: x,
        right: x + width,
        top: y,
        width,
        x,
        y,
      };
    },
  };
}

function isMouseBasedEvent(event: Event | null): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

export interface UseClientPointProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to restrict the client point to an axis and use the reference
   * element (if it exists) as the other axis. This can be useful if the
   * floating element is also interactive.
   * @default 'both'
   */
  axis?: 'x' | 'y' | 'both' | undefined;
}

/**
 * Positions the floating element relative to a client point (in the viewport),
 * such as the mouse position. By default, it follows the mouse cursor.
 * @see https://floating-ui.com/docs/useClientPoint
 */
export function useClientPoint(parameters: {
  context: FloatingRootContext | FloatingContext;
  props?: UseClientPointProps;
}): ElementProps {
  const props = defaultProps(parameters.props ?? {}, {
    axis: 'both',
    enabled: true,
  });

  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const open = createMemo(() => store().select('open'));
  const floating = createMemo(() => store().select('floatingElement'));
  const domReference = createMemo(() => store().select('domReferenceElement'));

  let initialRef = false;
  let cleanupListenerRef: (() => void) | null = null;

  const [pointerType, setPointerType] = createSignal<string | undefined>();

  const setReference = (
    newX: number | null,
    newY: number | null,
    referenceElement?: Element | null | undefined,
  ) => {
    if (initialRef) {
      return;
    }

    // Prevent setting if the open event was not a mouse-like one
    // (e.g. focus to open, then hover over the reference element).
    // Only apply if the event exists.
    const openEvent = store().context.dataRef.openEvent;
    if (openEvent && !isMouseBasedEvent(openEvent as Event | null)) {
      return;
    }

    const newVirtualElement = createVirtualElement(referenceElement ?? domReference(), {
      axis: props.axis,
      dataRef: store().context.dataRef,
      pointerType: pointerType(),
      x: newX,
      y: newY,
    });

    store().set('positionReference', newVirtualElement);
  };

  const handleReferenceEnterOrMove = (event: MouseEvent) => {
    if (!open()) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    }
  };

  // If the pointer is a mouse-like pointer, we want to continue following the
  // mouse even if the floating element is transitioning out. On touch
  // devices, this is undesirable because the floating element will move to
  // the dismissal touch point.
  const openCheck = () => {
    return isMouseLikePointerType(pointerType()) ? floating() : open();
  };

  function handleMouseMove(event: MouseEvent) {
    const target = getTarget(event) as Element | null;

    if (!contains(floating(), target)) {
      setReference(event.clientX, event.clientY);
    } else {
      cleanupListenerRef?.();
      cleanupListenerRef = null;
    }
  }

  createEffect(...on([open, floating, () => props.enabled], () => {
      if (!openCheck() || !props.enabled) {
        return;
      }

      const win = getWindow(floating());

      const openEvent = store().context.dataRef.openEvent;
      if (!openEvent || isMouseBasedEvent(openEvent)) {
        const cleanup = () => {
          cleanupListenerRef?.();
          cleanupListenerRef = null;
        };
        cleanupListenerRef = addEventListener(win, 'mousemove', handleMouseMove);
        return cleanup;
      }

      store().set('positionReference', domReference());
    }),
  );

  createTrackedEffect(() => {
    if (props.enabled && !floating()) {
      initialRef = false;
    }
  });

  createTrackedEffect(() => {
    if (!props.enabled && open()) {
      initialRef = true;
    }
  });

  function setPointerTypeRef(event: PointerEvent) {
    setPointerType(event.pointerType);
  }

  const reference: ElementProps['reference'] = {
    onMouseEnter: handleReferenceEnterOrMove,
    onMouseMove: handleReferenceEnterOrMove,
    onPointerDown: setPointerTypeRef,
    onPointerEnter: setPointerTypeRef,
  };

  /* When `enabled` is false the hook must not expose any reference/trigger event handlers — otherwise `onMouseEnter` still attaches and overwrites `positionReference` with a 0-sized virtual point element on first hover, which anchors the popup to the cursor instead of the trigger. */
  const empty = {} as const;
  return {
    get floating() {
      if (!props.enabled) return empty as any;
      return {
        ref: () => {
          onCleanup(() => store().set('floatingElement', null));
        },
      };
    },
    get reference() {
      return props.enabled ? reference : (empty as any);
    },
    get trigger() {
      return props.enabled ? reference : (empty as any);
    },
  };
}
