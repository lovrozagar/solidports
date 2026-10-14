import type { VirtualElement } from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import { createMemo, createSignal } from 'solid-js';
import { createDepsEffect, access, live } from '../../solid-helpers';
import type { FloatingRootStore } from '../components/FloatingRootStoreV2';
import { useFloatingTreeAccessor } from '../components/FloatingTree';
import type {
  FloatingContext,
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
} from '../types';
import { useFloatingOriginal as usePosition } from './useFloatingOriginal';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Provides data to position a floating element and context to add interactions.
 * The caller supplies the root store, which owns the reference and floating elements.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useBaseUIFloating(
  options: UseFloatingOptions & { rootContext: FloatingRootStore },
): UseFloatingReturn {
  // Live: the context's getters and element accessors are also read imperatively (handlers,
  // effect callbacks, tree traversals). Solid: a memo, since parts may swap the store.
  const rootContext = live(createMemo(() => options.rootContext));

  const rootContextElements = {
    domReference: () => rootContext().select('domReferenceElement'),
    floating: () => rootContext().select('floatingElement'),
    reference: () => rootContext().select('referenceElement'),
  };

  const toPositionReference = (node: ReferenceType | null | undefined) =>
    isElement(node)
      ? ({
          contextElement: node,
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
        } satisfies VirtualElement)
      : node;

  // A writable memo: a derived `options.positionReference` sets it in the same flush, and
  // `refs.setPositionReference` writes it imperatively.
  const [positionReference, setPositionReferenceRaw] = createSignal<
    ReferenceType | null | undefined
  >((prev) => {
    const input = options.positionReference;
    return input ? toPositionReference(input.anchor) : (prev ?? null);
  });

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
    const computedPositionReference = toPositionReference(node);
    // Store the positionReference in state if the DOM reference is specified externally via the
    // `elements.reference` option. This ensures that it won't be overridden on future renders.
    setPositionReferenceRaw(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  };

  const refs = solidMergeProps(position.refs, {
    domReference,
    setPositionReference,
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
