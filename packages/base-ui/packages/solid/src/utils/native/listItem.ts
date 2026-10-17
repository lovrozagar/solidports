/*
 * Composite list registration for native parts: `useCompositeListItem` for an
 * item with an automatic index, no label and no text ref. The registration data is read once when
 * it is static; a reactive metadata accessor re-registers from one effect. One signal (the index)
 * instead of the hook's signal + effect + render effect; the list sees the same registrations in
 * the same order. An optional index guess from the creation order avoids the post-flush re-render.
 */
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';
import { useCompositeListContext } from '../../internals/composite/list/CompositeListContext';
import type { CompositeListRegistration } from '../../internals/composite/list/CompositeListContext';

const noop = () => {};

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
  const { register, unregister, nextIndexRef } = useCompositeListContext();
  // `guessIndex`: the index is guessed from the creation order (`IndexGuessBehavior.GuessFromOrder`)
  // so a list rendered in DOM order is right on its first render and the list's flush confirms it
  // (no effect re-runs); a wrong guess is corrected by the flush.
  let guessed = -1;
  if (options?.guessIndex) {
    guessed = nextIndexRef.current;
    nextIndexRef.current += 1;
  }
  const reactive = typeof metadata === 'function';
  if (isServer) {
    // The server never calls refs and its list never flushes: the index stays the guess. A
    // reactive metadata accessor still gets its effect, which takes a hydration id the client's
    // matches.
    if (reactive) {
      createEffect(metadata as Accessor<Metadata | null>, () => {});
    }
    return { setRef: noop, index: () => guessed };
  }
  const [index, setIndex] = createSignal(guessed);
  // The list sets the index only when a flush moves it.
  const sink = { current: guessed, set: setIndex };
  // Identifies this item's registration when nested items share one DOM node.
  const owner = {};
  let element: Element | null = null;
  const readMetadata = reactive ? (metadata as Accessor<Metadata | null>) : () => metadata;
  let registration: CompositeListRegistration<Metadata> | null = null;

  const registerNode = (node: Element, data: Metadata | null) => {
    registration = { metadata: data, index: null, label: undefined, textRef: undefined };
    register(node, registration, owner, sink);
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

  void onCleanup(() => {
    if (element) {
      unregister(element, owner);
    }
  });

  return { setRef, index };
}
