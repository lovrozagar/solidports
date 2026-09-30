import { isElement } from '@floating-ui/utils/dom';
import { createEffect, on, onCleanup, untrack } from 'solid-js';
import { produce } from 'solid-js/store';
import { defaultProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { addEventListener } from '../../utils/addEventListener';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { useTimeout } from '../../utils/useTimeout';
import { useFloatingParentNodeId, useFloatingTree } from '../components/FloatingTree';
import type { FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget } from '../utils';
import { getNodeChildren } from '../utils/nodes';
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  useHoverInteractionSharedState,
} from './useHoverInteractionSharedState';
import { getDelay, isClickLikeOpenEvent as isClickLikeOpenEventShared } from './useHoverShared';

export type UseHoverFloatingInteractionProps = {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  closeDelay?: number | (() => number) | undefined;
  /**
   * Tree node id override for floating elements that participate in the tree
   * without a `FloatingContext`, such as inline nested navigation menus.
   */
  nodeId?: string | undefined;
};

/**
 * Provides hover interactions that should be attached to the floating element.
 */
export function useHoverFloatingInteraction(parameters: {
  context: FloatingRootContext | FloatingContext;
  parameters: UseHoverFloatingInteractionProps;
}): void {
  const props = defaultProps(parameters.parameters, { closeDelay: 0, enabled: true });
  const store =
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;

  const open = store.useState('open');
  const floatingElement = store.useState('floatingElement');
  const domReferenceElement = store.useState('domReferenceElement');

  const hoverState = useHoverInteractionSharedState({
    get store() {
      return store;
    },
  });
  const [instance, setInstanceState] = hoverState;

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  const isClickLikeOpenEvent = () =>
    isClickLikeOpenEventShared(store.context.dataRef.openEvent?.type, instance.interactedInside);

  const isHoverOpen = () =>
    store.context.dataRef.openEvent?.type?.includes('mouse') &&
    store.context.dataRef.openEvent.type !== 'mousedown';

  

  const closeWithDelay = (event: MouseEvent) => {
    const closeDelay = getDelay(props.closeDelay, 'close', instance.pointerType);
    const close = () => {
      store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      tree?.events.emit('floating.closed', event);
    };
    if (closeDelay) {
      instance.openChangeTimeout.start(closeDelay, close);
    } else {
      instance.openChangeTimeout.clear();
      close();
    }
  };

  const clearPointerEvents = () => {
    clearSafePolygonPointerEventsMutation(hoverState);
  };

  const handleInteractInside = (event: PointerEvent) => {
    const target = getTarget(event) as Element | null;
    setInstanceState('interactedInside', target?.closest('[aria-haspopup]') != null);
  };

  createEffect(() => {
    if (!open()) {
      /* untrack: setInstanceState and clearPointerEvents both read from the
       * hoverState Solid store. Those reads must not establish tracking
       * dependencies here — they're write-only side effects in response to
       * open() going false. Without untrack, any subsequent store write
       * (e.g. performedPointerEventsMutation false→true) re-triggers this
       * effect, creating a reactive cycle that overflows the call stack. */
      untrack(() => {
        setInstanceState(
          produce((i) => {
            i.pointerType = undefined;
            i.restTimeoutPending = false;
            i.interactedInside = false;
          }),
        );
        clearPointerEvents();
      });
    }
  });

  onCleanup(() => {
    clearPointerEvents();
  });

  createEffect(
    on(
      [() => props.enabled, open, domReferenceElement, floatingElement],
      ([enabled, isOpen, domReference, floatingEl]) => {
        if (!enabled) {
          return;
        }
        const resolvedFloatingEl = floatingEl ?? null;
        if (
          isOpen &&
          untrack(() => instance.handleCloseOptions?.blockPointerEvents) &&
          isHoverOpen() &&
          isElement(domReference) &&
          resolvedFloatingEl
        ) {
          const ref = domReference as HTMLElement | SVGSVGElement;
          const doc = ownerDocument(resolvedFloatingEl);

          const parentFloating = tree?.nodesRef
            .find((node) => node.id === parentId)
            ?.context?.elements.floating() as HTMLElement | null;

          if (parentFloating) {
            parentFloating.style.pointerEvents = '';
          }

          const scopeElement =
            untrack(() => instance.handleCloseOptions?.getScope?.()) ??
            untrack(() => instance.pointerEventsScopeElement) ??
            parentFloating ??
            (ref.closest('[data-rootownerid]') as HTMLElement | SVGSVGElement | null) ??
            doc.body;

          applySafePolygonPointerEventsMutation(hoverState, {
            floatingElement: resolvedFloatingEl,
            referenceElement: ref,
            scopeElement,
          });

          return () => {
            clearPointerEvents();
          };
        }
      },
    ),
  );

  const childClosedTimeout = useTimeout();

  createEffect(
    on([() => props.enabled, floatingElement], ([enabled, floating]) => {
      if (!enabled) {
        return;
      }

      function onFloatingMouseEnter() {
        instance.openChangeTimeout.clear();
        childClosedTimeout.clear();
        tree?.events.off('floating.closed', onNodeClosed);
        clearPointerEvents();
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (tree && parentId && getNodeChildren(tree.nodesRef, parentId).length > 0) {
          tree.events.on('floating.closed', onNodeClosed);
          return;
        }

        const currentNodeId = store.context.dataRef.floatingContext?.nodeId?.() ?? props.nodeId;
        const relatedTarget = event.relatedTarget;
        const isMovingIntoDescendantFloating =
          tree &&
          currentNodeId &&
          isElement(relatedTarget) &&
          getNodeChildren(tree.nodesRef, currentNodeId, false).some((node) =>
            contains(node.context?.elements.floating(), relatedTarget as Element),
          );

        if (isMovingIntoDescendantFloating) {
          return;
        }

        /* If the safePolygon handler is active, let it handle the close logic. */
        if (instance.handler) {
          instance.handler(event);
          return;
        }

        clearPointerEvents();
        if (!isClickLikeOpenEvent()) {
          closeWithDelay(event);
        }
      }

      function onNodeClosed(event: MouseEvent) {
        if (!tree || !parentId || getNodeChildren(tree.nodesRef, parentId).length > 0) {
          return;
        }
        childClosedTimeout.start(0, () => {
          tree.events.off('floating.closed', onNodeClosed);
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree.events.emit('floating.closed', event);
        });
      }

      return mergeCleanups(
        floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
        floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
        floating && addEventListener(floating, 'pointerdown', handleInteractInside, true),
        () => {
          tree?.events.off('floating.closed', onNodeClosed);
        },
      );
    }),
  );
}
