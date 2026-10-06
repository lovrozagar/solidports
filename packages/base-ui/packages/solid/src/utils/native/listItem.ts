/*
 * Composite list registration for native parts (plan 8 step 3.2): `useCompositeListItem` for an
 * item with an automatic index, no label and no text ref. The registration data is read once when
 * it is static; a reactive metadata accessor re-registers from one effect. One signal (the index)
 * instead of the hook's signal + effect + render effect; the list sees the same registrations in
 * the same order. An optional index guess from the creation order avoids the post-flush re-render.
 */
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import {
  useCompositeListContext,
  type CompositeListRegistration,
} from '../../internals/composite/list/CompositeListContext';

export interface NativeListItem {
  /** Registers the element (with `null`: unregisters it), as the hook's ref. */
  setRef: (node: HTMLElement | null | undefined) => void;
  /** The item's index in the list (`-1` until the list's first flush). */
  index: Accessor<number>;
}

export function createNativeListItem<Metadata>(
  metadata: Metadata | null | Accessor<Metadata | null>,
  options?: { guessIndex?: boolean | undefined },
): NativeListItem {
  const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();
  // `guessIndex`: the index is guessed from the creation order (`IndexGuessBehavior.GuessFromOrder`)
  // so a list rendered in DOM order is right on its first render and the list's flush confirms it
  // (no effect re-runs); a wrong guess is corrected by the flush.
  let guessed = -1;
  if (options?.guessIndex) {
    guessed = nextIndexRef.current;
    nextIndexRef.current += 1;
  }
  const [index, setIndex] = createSignal(guessed);
  // Identifies this item's registration when nested items share one DOM node.
  const owner = {};
  let element: Element | null = null;
  const reactive = typeof metadata === 'function';
  const readMetadata = reactive ? (metadata as Accessor<Metadata | null>) : () => metadata;
  let registration: CompositeListRegistration<Metadata> | null = null;

  const registerNode = (node: Element, data: Metadata | null) => {
    registration = { metadata: data, index: null, label: undefined, textRef: undefined };
    register(node, registration, owner);
  };

  const setRef = (node: HTMLElement | null | undefined) => {
    if (element && element !== node) {
      unregister(element, owner);
    }
    element = node ?? null;
    if (node) {
      registerNode(node, untrack(readMetadata));
    }
  };

  if (reactive) {
    createEffect(readMetadata, (data) => {
      if (element && (registration === null || registration.metadata !== data)) {
        registerNode(element, data);
      }
    });
  }

  const unsubscribe = subscribeMapChange((map: Map<Element, CompositeMetadata<Metadata>>) => {
    const next = element ? map.get(element)?.index : null;
    if (next != null) {
      setIndex(next);
    }
  });

  onCleanup(() => {
    unsubscribe();
    if (element) {
      unregister(element, owner);
    }
  });

  return { setRef, index };
}
