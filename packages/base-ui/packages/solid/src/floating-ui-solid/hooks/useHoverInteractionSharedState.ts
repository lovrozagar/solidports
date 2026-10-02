import { createRenderEffect, onCleanup } from 'solid-js';
import type { Store } from 'solid-js';
import { useTimeout } from '../../utils/useTimeout';
import type { FloatingRootContext, SafePolygonOptions } from '../types';
import { createStore, type SetStoreFunction } from '../../solid-1-compat';

export { isInteractiveElement } from '../utils';

export interface HoverInteraction {
  pointerType: string | undefined;
  interactedInside: boolean;
  handler: ((event: MouseEvent) => void) | undefined;
  blockMouseMove: boolean;
  performedPointerEventsMutation: boolean;
  pointerEventsScopeElement: HTMLElement | SVGSVGElement | null;
  pointerEventsReferenceElement: HTMLElement | SVGSVGElement | null;
  pointerEventsFloatingElement: HTMLElement | null;
  restTimeoutPending: boolean;
  openChangeTimeout: ReturnType<typeof useTimeout>;
  restTimeout: ReturnType<typeof useTimeout>;
  handleCloseOptions: SafePolygonOptions | undefined;
}

export type HoverInteractionSharedState = [Store<HoverInteraction>, SetStoreFunction<HoverInteraction>];

function createHoverInteractionSharedState(): HoverInteractionSharedState {
  const [state, setState] = createStore<HoverInteraction>({
    blockMouseMove: true,
    handleCloseOptions: undefined,
    handler: undefined,
    interactedInside: false,
    openChangeTimeout: useTimeout(),
    performedPointerEventsMutation: false,
    pointerEventsFloatingElement: null,
    pointerEventsReferenceElement: null,
    pointerEventsScopeElement: null,
    pointerType: undefined,
    restTimeout: useTimeout(),
    restTimeoutPending: false,
  });

  return [state, setState] as const;
}

export function useHoverInteractionSharedState(options: {
  store: FloatingRootContext;
}): HoverInteractionSharedState {
  createRenderEffect(
    () => options.store.context.dataRef,
    (dataRef) => {
      if (!dataRef.hoverInteractionState) {
        dataRef.hoverInteractionState = createHoverInteractionSharedState();
      }
    },
  );

  onCleanup(() => {
    options.store.context.dataRef.hoverInteractionState?.[0].openChangeTimeout.clear();
    options.store.context.dataRef.hoverInteractionState?.[0].restTimeout.clear();
  });

  return options.store.context.dataRef.hoverInteractionState;
}

/* Keyed by scope element to handle ownership conflicts across concurrent hover instances. */
const pointerEventsMutationOwnerByScopeElement = new WeakMap<
  HTMLElement | SVGSVGElement,
  HoverInteractionSharedState
>();

export function clearSafePolygonPointerEventsMutation(
  [instance, setState]: HoverInteractionSharedState,
) {
  if (!instance.performedPointerEventsMutation) {
    return;
  }

  const scopeElement = instance.pointerEventsScopeElement;

  if (scopeElement && pointerEventsMutationOwnerByScopeElement.get(scopeElement)?.[0] === instance) {
    instance.pointerEventsScopeElement?.style.removeProperty('pointer-events');
    instance.pointerEventsReferenceElement?.style.removeProperty('pointer-events');
    instance.pointerEventsFloatingElement?.style.removeProperty('pointer-events');
    pointerEventsMutationOwnerByScopeElement.delete(scopeElement);
  }

  setState('performedPointerEventsMutation', false);
  setState('pointerEventsScopeElement', null);
  setState('pointerEventsReferenceElement', null);
  setState('pointerEventsFloatingElement', null);
}

export function applySafePolygonPointerEventsMutation(
  hoverState: HoverInteractionSharedState,
  options: {
    scopeElement: HTMLElement | SVGSVGElement;
    referenceElement: HTMLElement | SVGSVGElement;
    floatingElement: HTMLElement;
  },
) {
  const [instance, setState] = hoverState;
  const { scopeElement, referenceElement, floatingElement } = options;

  const existingOwner = pointerEventsMutationOwnerByScopeElement.get(scopeElement);
  if (existingOwner && existingOwner[0] !== instance) {
    clearSafePolygonPointerEventsMutation(existingOwner);
  }

  clearSafePolygonPointerEventsMutation(hoverState);
  setState('performedPointerEventsMutation', true);
  setState('pointerEventsScopeElement', scopeElement);
  setState('pointerEventsReferenceElement', referenceElement);
  setState('pointerEventsFloatingElement', floatingElement);
  pointerEventsMutationOwnerByScopeElement.set(scopeElement, hoverState);

  scopeElement.style.pointerEvents = 'none';
  referenceElement.style.pointerEvents = 'auto';
  floatingElement.style.pointerEvents = 'auto';
}
