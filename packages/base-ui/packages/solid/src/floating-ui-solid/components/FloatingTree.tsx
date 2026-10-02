import { createContext, createRenderEffect, useContext, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access, live, type MaybeAccessor } from '../../solid-helpers';
import { useId } from '../../utils/useId';
import type { FloatingContext, FloatingNodeType, FloatingTreeType } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';

const FloatingNodeContext = createContext<{
  id: Accessor<string | undefined>;
  parentId: Accessor<string | null>;
  context?: FloatingContext;
} | null>(null);
const FloatingTreeContext = createContext<Accessor<FloatingTreeType | null> | null>(null);

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export const useFloatingParentNodeId = () => {
  const context = useContext(FloatingNodeContext);
  // Node ids are generated once per node, so the parent id is a constant for this hook's owner
  // (as in React, where it is read during render).
  return untrack(() => access(context?.id)) || null;
};

/**
 * Returns the nearest floating tree context, if available.
 */
export const useFloatingTree = (externalTree?: FloatingTreeStore): FloatingTreeType | null => {
  const contextTree = useContext(FloatingTreeContext);
  return externalTree ?? untrack(() => contextTree?.()) ?? null;
};

/**
 * `useFloatingTree` as a live accessor: it follows a changing `externalTree`, as React reads it
 * on every render. Tracks inside computations and reads untracked elsewhere.
 */
export const useFloatingTreeAccessor = (
  externalTree?: MaybeAccessor<FloatingTreeStore | undefined>,
): Accessor<FloatingTreeType | null> => {
  const contextTree = useContext(FloatingTreeContext);
  return live(() => access(externalTree) ?? contextTree?.() ?? null);
};

/**
 * Registers a node into the `FloatingTree`, returning its id.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function useFloatingNodeId(
  externalTree?: MaybeAccessor<FloatingTreeStore | undefined>,
): Accessor<string | undefined> {
  const id = useId();
  const tree = useFloatingTreeAccessor(externalTree);
  const parentContext = useContext(FloatingNodeContext);
  // `useFloating` attaches its context to the node once. React re-attaches it on every render;
  // here a node re-created for a new parent carries the context over instead.
  let nodeContext: FloatingNodeType['context'];

  createRenderEffect(
    () => {
      const nodeId = id();
      const parentId = access(parentContext?.id) || null;
      return { nodeId, parentId, tree: tree() };
    },
    ({ nodeId, parentId, tree: currentTree }) => {
      if (!nodeId) {
        return;
      }

      const node: FloatingNodeType = { id: nodeId, parentId, context: nodeContext };
      currentTree?.addNode(node);

      return () => {
        nodeContext = node.context;
        currentTree?.removeNode(node);
      };
    },
  );

  return id;
}

export interface FloatingNodeProps {
  children?: JSX.Element;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingNode(props: FloatingNodeProps): JSX.Element {
  const parentId = useFloatingParentNodeId();
  const contextValue = { id: () => props.id, parentId: () => parentId };

  return <FloatingNodeContext value={contextValue}>{props.children}</FloatingNodeContext>;
}

export interface FloatingTreeProps {
  children?: JSX.Element;
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 * This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
 * - The `bubbles` option in the `useDismiss()` Hook
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingTree(props: FloatingTreeProps): JSX.Element {
  // Fixed on creation, as React's `useRefWithInit`.
  const fixedTree = untrack(() => props.externalTree) ?? new FloatingTreeStore();
  const tree = () => fixedTree;
  return <FloatingTreeContext value={tree}>{props.children}</FloatingTreeContext>;
}
