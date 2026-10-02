import { onCleanup, untrack } from 'solid-js';
import type { Store } from 'solid-js';
import { useTimeout } from '../../utils/useTimeout';
import type { FloatingRootContext, SafePolygonOptions } from '../types';
import type { SetStoreFunction } from '../../solid-1-compat';

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

export type HoverInteractionSharedState = [
  Store<HoverInteraction>,
  SetStoreFunction<HoverInteraction>,
];

/**
 * The shared hover instance is plain mutable state, as React's `HoverInteraction` class: its
 * fields are timers and flags read imperatively by handlers, never rendered. (A Solid store
 * wrapped the `Timeout` instances, whose own writes then went through the store proxy.)
 */
/** Each plain state's own `[state, setState]` pair, so ownership can record the concrete pair. */
const concreteStatePairs = new WeakMap<HoverInteraction, HoverInteractionSharedState>();

function createHoverInteractionSharedState(): HoverInteractionSharedState {
  const state: HoverInteraction = {
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
  };

  // Store-setter call shapes, applied as plain mutations: `(key, value | updater)` or `(draftFn)`.
  const setState = ((...args: unknown[]) => {
    if (typeof args[0] === 'function') {
      (args[0] as (draft: HoverInteraction) => void)(state);
      return;
    }
    const key = args[0] as keyof HoverInteraction;
    const value = args[1];
    (state as any)[key] =
      typeof value === 'function' ? (value as (prev: unknown) => unknown)(state[key]) : value;
  }) as SetStoreFunction<HoverInteraction>;

  const pair: HoverInteractionSharedState = [state, setState];
  concreteStatePairs.set(state, pair);
  return pair;
}

const UNDERLYING_STATE = Symbol('hoverInteractionState');

/** The shared state behind a hook's live view, for identity checks across hooks. */
function underlyingState(instance: HoverInteraction): HoverInteraction {
  return (instance as any)[UNDERLYING_STATE] ?? instance;
}

export function useHoverInteractionSharedState(options: {
  store: FloatingRootContext;
}): HoverInteractionSharedState {
  // As React: one instance per hook, adopted by a store that has none yet. The store is resolved
  // on every access because parts like NavigationMenu swap it per active trigger.
  const ownState = createHoverInteractionSharedState();

  const current = (): HoverInteractionSharedState => {
    const dataRef = options.store.context.dataRef;
    if (!dataRef.hoverInteractionState) {
      dataRef.hoverInteractionState = ownState;
    }
    return dataRef.hoverInteractionState;
  };

  onCleanup(() => {
    for (const [state] of [ownState, untrack(current)]) {
      state.openChangeTimeout.clear();
      state.restTimeout.clear();
    }
  });

  const instance = new Proxy({} as HoverInteraction, {
    get: (_, key) => {
      // Resolving the current store is the only reactive read; the instance itself is plain.
      const instance = untrack(current)[0];
      return key === UNDERLYING_STATE ? instance : instance[key as keyof HoverInteraction];
    },
  });
  const setInstance = ((...args: unknown[]) =>
    (current()[1] as (...setArgs: unknown[]) => void)(
      ...args,
    )) as SetStoreFunction<HoverInteraction>;

  return [instance, setInstance];
}

/**
 * The concrete `[state, setState]` pair a hook's live view currently resolves to. Effects that
 * apply a mutation keep this pair so their cleanup clears the same instance, as React's effect
 * closes over the instance it applied with.
 */
export function resolveHoverInteractionSharedState(
  hoverState: HoverInteractionSharedState,
): HoverInteractionSharedState {
  return concreteStatePairs.get(underlyingState(hoverState[0])) ?? hoverState;
}

/* Keyed by scope element to handle ownership conflicts across concurrent hover instances. */
const pointerEventsMutationOwnerByScopeElement = new WeakMap<
  HTMLElement | SVGSVGElement,
  HoverInteractionSharedState
>();

function underlyingOwner(scopeElement: HTMLElement | SVGSVGElement) {
  const owner = pointerEventsMutationOwnerByScopeElement.get(scopeElement);
  return owner ? underlyingState(owner[0]) : undefined;
}

export function clearSafePolygonPointerEventsMutation([
  instance,
  setState,
]: HoverInteractionSharedState) {
  if (!instance.performedPointerEventsMutation) {
    return;
  }

  const scopeElement = instance.pointerEventsScopeElement;

  if (scopeElement && underlyingOwner(scopeElement) === underlyingState(instance)) {
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
  if (existingOwner && underlyingState(existingOwner[0]) !== underlyingState(instance)) {
    clearSafePolygonPointerEventsMutation(existingOwner);
  }

  clearSafePolygonPointerEventsMutation(hoverState);
  setState('performedPointerEventsMutation', true);
  setState('pointerEventsScopeElement', scopeElement);
  setState('pointerEventsReferenceElement', referenceElement);
  setState('pointerEventsFloatingElement', floatingElement);
  // Record the concrete pair: a hook's live view re-resolves when its store is swapped (the
  // Navigation Menu popup follows the active trigger), which would make a later owner look equal.
  pointerEventsMutationOwnerByScopeElement.set(
    scopeElement,
    resolveHoverInteractionSharedState(hoverState),
  );

  scopeElement.style.pointerEvents = 'none';
  referenceElement.style.pointerEvents = 'auto';
  floatingElement.style.pointerEvents = 'auto';
}
