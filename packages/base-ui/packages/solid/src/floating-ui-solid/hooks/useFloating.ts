/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { type VirtualElement } from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { access } from '../../solid-helpers';
import { FloatingRootStore } from '../components/FloatingRootStoreV2';
import { useFloatingTree } from '../components/FloatingTree';
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
  const internalRootStore = useFloatingRootContext(options);
  const rootContext = createMemo(() => options.rootContext || internalRootStore);

  const rootContextElements = {
    domReference: () => rootContext().useState('domReferenceElement')(),
    floating: () => rootContext().useState('floatingElement')(),
    reference: () => rootContext().useState('referenceElement')(),
  };

  const [positionReference, setPositionReferenceRaw] = createSignal<
    ReferenceType | null | undefined
  >(null);

  const domReference = createMemo(() => {
    const ref = rootContextElements.domReference();
    return (ref ?? null) as NarrowedElement<ReferenceType> | null | undefined;
  });

  const tree = useFloatingTree();

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
  const [localFloatingElement, setLocalFloatingElement] = createSignal<
    HTMLElement | null | undefined
  >(null);

  const store = untrack(() => rootContext());
  store.useSyncedValue('referenceElement', () => localDomReference() ?? null);
  store.useSyncedValue('domReferenceElement', () => {
    const local = localDomReference();
    if (local === undefined) {
      return rootContextElements.domReference();
    }
    return isElement(local) ? (local as Element) : null;
  });
  store.useSyncedValue('floatingElement', localFloatingElement);

  const setReference = (node: ReferenceType | null | undefined) => {
    if (isElement(node) || node == null) {
      setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
    }

    // Backwards-compatibility for passing a virtual element to `reference`
    // after it has set the DOM reference.
    const reference = position.refs.reference();
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

  const open = () => rootContext().useState('open')();
  const floatingId = () => rootContext().useState('floatingId')();

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

  createEffect(
    () => ({
      store: rootContext(),
      nodeId: access(options.nodeId),
    }),
    ({ store, nodeId }) => {
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
