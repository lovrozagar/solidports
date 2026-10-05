import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access, type MaybeAccessor, createLayoutEffect } from '../../../solid-helpers';
import type { CompositeMetadata } from './CompositeList';
import { useCompositeListContext, type CompositeListRegistration } from './CompositeListContext';

export interface UseCompositeListItemParameters<Metadata> {
  /**
   * Solid: how to guess the initial index (React's boolean `guess`). Guessing from the render
   * order avoids a re-render after mount for flat lists.
   * @default IndexGuessBehavior.None
   */
  indexGuessBehavior?: IndexGuessBehavior | undefined;
  index?: MaybeAccessor<number | undefined>;
  label?: MaybeAccessor<string | null | undefined>;
  /**
   * Metadata published with the item.
   */
  metadata?: MaybeAccessor<Metadata | undefined>;
  textRef?: MaybeAccessor<HTMLElement | null | undefined>;
}

interface UseCompositeListItemReturnValue {
  setRef: (node: HTMLElement | null | undefined) => void;
  index: Accessor<number>;
}

export enum IndexGuessBehavior {
  None,
  GuessFromOrder,
}

/**
 * Used to register a list item and its index (DOM position) in the `CompositeList`.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const externalIndex = () => access(params.index);

  const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();

  // Guess the index from the render order. This avoids a re-render after mount for
  // flat lists rendered in DOM order; when the guess is wrong (grouped or out-of-order
  // rendering), the list flush corrects it.
  const [internalIndex, setInternalIndex] = createSignal<number>(
    untrack(() => {
      if (
        externalIndex() == null &&
        params.indexGuessBehavior === IndexGuessBehavior.GuessFromOrder
      ) {
        const newIndex = nextIndexRef.current;
        nextIndexRef.current += 1;
        return newIndex;
      }
      return -1;
    }),
  );
  const index = () => externalIndex() ?? internalIndex();

  // Identifies this item's registration when nested items share one DOM node.
  const owner = {};
  let componentRef: Element | null = null;

  // `MaybeAccessor<Metadata>` cannot narrow a generic `Metadata`, so name the resolved type.
  const readMetadata = () => access(params.metadata) as Metadata | undefined;

  const getRegistration = (): CompositeListRegistration<Metadata> =>
    untrack(() => ({
      metadata: readMetadata() ?? null,
      index: externalIndex() ?? null,
      label: access(params.label),
      textRef: access(params.textRef),
    }));

  // The registration last handed to the list, to skip re-registering unchanged data.
  let lastRegistration: CompositeListRegistration<Metadata> | null = null;

  function registerNode(node: Element, registration: CompositeListRegistration<Metadata>) {
    lastRegistration = registration;
    register(node, registration, owner);
  }

  // Solid: refs are applied once and never with `null`, so the ref registers and the unmount
  // cleanup unregisters.
  const setRef = (node: HTMLElement | null | undefined) => {
    const previousNode = componentRef;

    if (previousNode && previousNode !== node) {
      unregister(previousNode, owner);
    }

    componentRef = node ?? null;

    if (node) {
      registerNode(node, getRegistration());
    }
  };

  // React re-attaches the callback ref when its registration data changes; re-register then.
  // Solid: the first compute can run after the mount flush, so compare with the data the ref
  // registered rather than skipping the first run.
  createEffect(
    () => ({
      metadata: readMetadata() ?? null,
      index: externalIndex() ?? null,
      label: access(params.label),
      textRef: access(params.textRef),
    }),
    (registration) => {
      if (
        !componentRef ||
        (lastRegistration !== null &&
          lastRegistration.metadata === registration.metadata &&
          lastRegistration.index === registration.index &&
          lastRegistration.label === registration.label &&
          lastRegistration.textRef === registration.textRef)
      ) {
        return;
      }
      registerNode(componentRef, registration);
    },
  );

  onCleanup(() => {
    if (componentRef) {
      unregister(componentRef, owner);
    }
  });

  // Render-effect timing: subscribed before the list's first flush, as React's child layout
  // effects run before the parent's.
  createLayoutEffect(externalIndex, (currentExternalIndex) => {
    if (currentExternalIndex != null) {
      return undefined;
    }

    return subscribeMapChange((map: Map<Element, CompositeMetadata<Metadata>>) => {
      const i = componentRef ? map.get(componentRef)?.index : null;

      if (i != null) {
        setInternalIndex(i);
      }
    });
  });

  return { setRef, index };
}
