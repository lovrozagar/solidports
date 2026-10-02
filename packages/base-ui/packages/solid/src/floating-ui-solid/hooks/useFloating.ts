/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { type VirtualElement } from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import { createMemo, createSignal, untrack } from 'solid-js';
import { createDepsEffect, access, live } from '../../solid-helpers';
import { FloatingRootStore } from '../components/FloatingRootStoreV2';
import { useFloatingTreeAccessor } from '../components/FloatingTree';
import type {
  FloatingContext,
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
} from '../types';
import { useFloatingOriginal as usePosition } from './useFloatingOriginal';
import { useFloatingRootContext } from './useFloatingRootContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Provides data to position a floating element and context to add interactions.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
  const internalStore = useFloatingRootContext(options);

  return useFloatingWithStore(options, () => options.rootContext || internalStore);
}

/**
 * Base UI's private `useFloating` path. The caller must supply the root store, so this skips the
 * internal root-context hook used by the public Floating UI-compatible API.
 */
export function useBaseUIFloating(
  options: UseFloatingOptions & { rootContext: FloatingRootStore },
): UseFloatingReturn {
  return useFloatingWithStore(options, () => options.rootContext);
}

function useFloatingWithStore(
  options: UseFloatingOptions,
  getStore: () => FloatingRootStore,
): UseFloatingReturn {
  // Live: the context's getters and element accessors are also read imperatively (handlers,
  // effect callbacks, tree traversals). Solid: a memo, since parts may swap the store.
  const rootContext = live(createMemo(getStore));

  const rootContextElements = {
    domReference: () => rootContext().select('domReferenceElement'),
    floating: () => rootContext().select('floatingElement'),
    reference: () => rootContext().select('referenceElement'),
  };

  const [positionReference, setPositionReferenceRaw] = createSignal<
    ReferenceType | null | undefined
  >(null);

  const domReference = createMemo(() => {
    const ref = rootContextElements.domReference();
    return (ref ?? null) as NarrowedElement<ReferenceType> | null | undefined;
  });

  const getTree = useFloatingTreeAccessor(() => options.externalTree);

  const positionOptions = solidMergeProps(options, {
    elements: {
      get floating() {
        return rootContextElements.floating();
      },
      get reference() {
        return positionReference() ?? rootContextElements.reference();
      },
    },
  });
  const position = usePosition(positionOptions);

  const setPositionReference = (node: ReferenceType | null | undefined) => {
    const computedPositionReference = isElement(node)
      ? ({
          contextElement: node,
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
        } satisfies VirtualElement)
      : node;
    // Store the positionReference in state if the DOM reference is specified externally via the
    // `elements.reference` option. This ensures that it won't be overridden on future renders.
    setPositionReferenceRaw(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  };

  const [localDomReference, setLocalDomReference] = createSignal<
    NarrowedElement<ReferenceType> | null | undefined
  >(undefined);
  // `undefined` keeps the store's floating element, as in React.
  const [localFloatingElement, setLocalFloatingElement] = createSignal<
    HTMLElement | null | undefined
  >(undefined);

  // React's three `useSyncedValue` calls: each key is written only when its own value changes.
  // The store is part of each value because parts like NavigationMenu swap it per active trigger.
  createDepsEffect(
    () => ({ store: rootContext(), value: localDomReference() ?? null }),
    ({ store, value }) => {
      store.set('referenceElement', value);
    },
  );

  // With no local reference, React writes the store's own value back (a no-op). Solid would write
  // the value committed when the effect computed, over a newer one written in the same flush.
  createDepsEffect(
    () => ({ store: rootContext(), local: localDomReference() }),
    ({ store, local }) => {
      if (local !== undefined) {
        store.set('domReferenceElement', isElement(local) ? (local as Element) : null);
      }
    },
  );

  createDepsEffect(
    () => ({ store: rootContext(), value: localFloatingElement() }),
    ({ store, value }) => {
      if (value !== undefined) {
        store.set('floatingElement', value);
      }
    },
  );

  const setReference = (node: ReferenceType | null | undefined) => {
    if (isElement(node) || node == null) {
      setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
    }

    // Backwards-compatibility for passing a virtual element to `reference`
    // after it has set the DOM reference.
    // A ref setter: read the current reference without subscribing.
    const reference = untrack(position.refs.reference);
    if (
      isElement(reference) ||
      reference == null ||
      // Don't allow setting virtual elements using the old technique back to
      // `null` to support `positionReference` + an unstable `reference`
      // callback ref.
      (node != null && !isElement(node))
    ) {
      position.refs.setReference(node);
    }
  };

  const setFloating = (node: HTMLElement | null | undefined) => {
    setLocalFloatingElement(node);
    position.refs.setFloating(node);
  };

  const refs = solidMergeProps(position.refs, {
    domReference,
    setFloating,
    setPositionReference,
    setReference,
  });

  const elements = solidMergeProps(position.elements, {
    domReference: rootContextElements.domReference,
  });

  const open = () => rootContext().select('open');
  const floatingId = () => rootContext().select('floatingId');

  const context: FloatingContext = {
    // from UsePositionFloatingReturn
    update: position.update,
    floatingStyles: () => position.floatingStyles,
    isPositioned: () => position.isPositioned,
    placement: () => position.placement,
    strategy: () => position.strategy,
    middlewareData: () => position.middlewareData,
    x: () => position.x,
    y: () => position.y,

    // from FloatingRootContext
    get dataRef() {
      return rootContext().context.dataRef;
    },
    open,
    onOpenChange: (...args) => rootContext().setOpen(...args),
    get events() {
      return rootContext().context.events;
    },
    floatingId,

    // additional
    refs,
    elements,
    nodeId: () => access(options.nodeId),
    get rootStore() {
      return rootContext();
    },
  };

  createDepsEffect(
    () => ({
      store: rootContext(),
      nodeId: access(options.nodeId),
      // React re-attaches on every render; here a tree change re-attaches.
      tree: getTree(),
    }),
    ({ store, nodeId, tree }) => {
      store.context.dataRef.floatingContext = context;

      if (!tree) {
        return;
      }

      const nodeIdx = tree.nodesRef.findIndex((n) => n.id === nodeId);
      if (nodeIdx !== -1) {
        tree.nodesRef[nodeIdx].context = context as any;
      }
    },
  );

  return {
    context,
    elements,
    floatingStyles: () => position.floatingStyles,
    isPositioned: () => position.isPositioned,
    middlewareData: () => position.middlewareData,
    placement: () => position.placement,
    refs,
    get rootStore() {
      return rootContext() as unknown as FloatingRootStore;
    },
    strategy: () => position.strategy,
    update: position.update,
    x: () => position.x,
    y: () => position.y,
  } as UseFloatingReturn;
}
